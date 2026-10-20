// Persistent rewards. Every grant runs in one transaction with an idempotency-ledger insert,
// so a duplicated or replayed grant (same key) changes nothing.
import { ITEMS, LEVELING, LOOT } from '@cindervale/content';
import {
  asc,
  characters,
  eq,
  grantedRewards,
  inventoryItems,
  sql,
  type Db,
} from '@cindervale/database';
import { addExp } from '@cindervale/game-core';
import type { Inventory } from '@cindervale/protocol';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

class InventoryFull extends Error {}

/** Inserts the ledger key; false if this reward was already granted. */
async function claim(tx: Tx, key: string, characterId: string) {
  const rows = await tx
    .insert(grantedRewards)
    .values({ key, characterId })
    .onConflictDoNothing()
    .returning({ key: grantedRewards.key });
  return rows.length > 0;
}

/** Locks the character row so concurrent grants for one character apply in sequence. */
async function lockCharacter(tx: Tx, characterId: string) {
  const [c] = await tx
    .select({ level: characters.level, exp: characters.exp })
    .from(characters)
    .where(eq(characters.id, characterId))
    .for('update');
  if (!c) throw new Error(`Character ${characterId} not found`);
  return c;
}

export interface ExpGrantResult {
  level: number;
  exp: number;
  levelsGained: number;
}

/** Adds EXP once per `key`. Returns null if the key was already granted. */
export function grantExp(
  db: Db,
  characterId: string,
  key: string,
  amount: number,
): Promise<ExpGrantResult | null> {
  return db.transaction(async (tx) => {
    if (!(await claim(tx, key, characterId))) return null;
    const current = await lockCharacter(tx, characterId);
    const next = addExp(current, amount, LEVELING);
    await tx
      .update(characters)
      .set({ level: next.level, exp: next.exp, updatedAt: new Date() })
      .where(eq(characters.id, characterId));
    return next;
  });
}

export type LootGrant = { itemId: string; quantity: number } | { currency: number };
export type LootGrantResult = 'ok' | 'duplicate' | 'inventory_full';

/**
 * Adds an item stack (merging into partial stacks first, then free slots) or currency, once
 * per `key`. All-or-nothing: if the whole quantity doesn't fit, nothing changes.
 */
export async function grantLoot(
  db: Db,
  characterId: string,
  key: string,
  loot: LootGrant,
): Promise<LootGrantResult> {
  try {
    return await db.transaction(async (tx) => {
      if (!(await claim(tx, key, characterId))) return 'duplicate';
      await lockCharacter(tx, characterId);
      if ('currency' in loot) {
        await tx
          .update(characters)
          .set({ currency: sql`${characters.currency} + ${loot.currency}` })
          .where(eq(characters.id, characterId));
        return 'ok';
      }

      const stackSize = ITEMS[loot.itemId]?.stackSize;
      if (!stackSize) throw new Error(`Unknown item ${loot.itemId}`);
      const rows = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, characterId));
      let remaining = loot.quantity;
      for (const row of rows) {
        if (remaining === 0) break;
        if (row.itemId !== loot.itemId || row.quantity >= stackSize) continue;
        const add = Math.min(remaining, stackSize - row.quantity);
        await tx
          .update(inventoryItems)
          .set({ quantity: row.quantity + add })
          .where(eq(inventoryItems.id, row.id));
        remaining -= add;
      }
      const used = new Set(rows.map((r) => r.slot));
      for (let slot = 0; remaining > 0 && slot < LOOT.inventoryCapacity; slot++) {
        if (used.has(slot)) continue;
        const add = Math.min(remaining, stackSize);
        await tx
          .insert(inventoryItems)
          .values({ characterId, slot, itemId: loot.itemId, quantity: add });
        remaining -= add;
      }
      if (remaining > 0) throw new InventoryFull();
      return 'ok';
    });
  } catch (e) {
    if (e instanceof InventoryFull) return 'inventory_full';
    throw e;
  }
}

export async function loadInventory(db: Db, characterId: string): Promise<Inventory> {
  const [c] = await db
    .select({ currency: characters.currency })
    .from(characters)
    .where(eq(characters.id, characterId));
  const items = await db
    .select({
      slot: inventoryItems.slot,
      itemId: inventoryItems.itemId,
      quantity: inventoryItems.quantity,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.characterId, characterId))
    .orderBy(asc(inventoryItems.slot));
  return { currency: c?.currency ?? 0, capacity: LOOT.inventoryCapacity, items };
}
