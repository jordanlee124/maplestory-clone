// Player item operations: equip, unequip, forge, imprint, use. Each runs in one transaction that
// locks the character row, validates against stored state, writes the change and an
// item_transactions entry together. A failed check changes nothing.
import { FORGE, IMPRINTS, ITEMS, LOOT, type EquipSlot, type StatLine } from '@cindervale/content';
import {
  and,
  characters,
  eq,
  inventoryItems,
  itemTransactions,
  sql,
  type Db,
} from '@cindervale/database';
import type { Rng } from '@cindervale/game-core';
import type { ItemRejectReason } from '@cindervale/protocol';
import {
  checkEquip,
  equipDef,
  forgeStep,
  imprintCost,
  rollForge,
  rollImprint,
  type EquipInstance,
} from './equipment';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Row = typeof inventoryItems.$inferSelect;
type Fail = { ok: false; reason: ItemRejectReason };
const fail = (reason: ItemRejectReason): Fail => ({ ok: false, reason });

async function lockCharacter(tx: Tx, characterId: string) {
  const [c] = await tx
    .select({ classId: characters.classId, level: characters.level, currency: characters.currency })
    .from(characters)
    .where(eq(characters.id, characterId))
    .for('update');
  if (!c) throw new Error(`Character ${characterId} not found`);
  return c;
}

const rowsOf = (tx: Tx, characterId: string) =>
  tx.select().from(inventoryItems).where(eq(inventoryItems.characterId, characterId));

const toInstance = (r: Row): EquipInstance => ({
  itemId: r.itemId,
  bonus: r.bonus as StatLine[],
  forgeLevel: r.forgeLevel,
  imprints: r.imprints as StatLine[],
});

/** Worn equipment, for stat calculation. */
export async function loadEquipped(db: Db, characterId: string): Promise<EquipInstance[]> {
  const rows = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.characterId, characterId));
  return rows.filter((r) => r.equipSlot !== null).map(toInstance);
}

const log = (
  tx: Tx,
  characterId: string,
  kind: string,
  inventoryItemId: string | null,
  detail: Record<string, unknown>,
  currencyDelta = 0,
) =>
  tx.insert(itemTransactions).values({ characterId, kind, inventoryItemId, detail, currencyDelta });

/** Wears a bag item. An item already in that slot moves to the bag slot it frees. */
export function equipItem(
  db: Db,
  characterId: string,
  instanceId: string,
): Promise<{ ok: true } | Fail> {
  return db.transaction(async (tx) => {
    const c = await lockCharacter(tx, characterId);
    const rows = await rowsOf(tx, characterId);
    const row = rows.find((r) => r.id === instanceId);
    if (!row) return fail('not_found');
    if (row.slot === null) return fail('stale'); // already worn
    const invalid = checkEquip(row.itemId, c.classId, c.level);
    if (invalid) return fail(invalid);
    const slot = equipDef(row.itemId)!.slot;
    const worn = rows.find((r) => r.equipSlot === slot);
    // Three steps keep both unique indexes and the one-place check valid after each statement.
    await tx
      .update(inventoryItems)
      .set({ slot: null, equipSlot: `swap:${slot}` })
      .where(eq(inventoryItems.id, row.id));
    if (worn) {
      await tx
        .update(inventoryItems)
        .set({ slot: row.slot, equipSlot: null })
        .where(eq(inventoryItems.id, worn.id));
    }
    await tx.update(inventoryItems).set({ equipSlot: slot }).where(eq(inventoryItems.id, row.id));
    await log(tx, characterId, 'equip', row.id, { slot, replaced: worn?.id ?? null });
    return { ok: true };
  });
}

/** Moves a worn item to the first free bag slot. */
export function unequipItem(
  db: Db,
  characterId: string,
  slot: EquipSlot,
): Promise<{ ok: true } | Fail> {
  return db.transaction(async (tx) => {
    await lockCharacter(tx, characterId);
    const rows = await rowsOf(tx, characterId);
    const worn = rows.find((r) => r.equipSlot === slot);
    if (!worn) return fail('not_found');
    const used = new Set(rows.map((r) => r.slot));
    const free = Array.from({ length: LOOT.inventoryCapacity }, (_, i) => i).find(
      (i) => !used.has(i),
    );
    if (free === undefined) return fail('inventory_full');
    await tx
      .update(inventoryItems)
      .set({ slot: free, equipSlot: null })
      .where(eq(inventoryItems.id, worn.id));
    await log(tx, characterId, 'unequip', worn.id, { slot, bagSlot: free });
    return { ok: true };
  });
}

export interface EnhanceOutcome {
  ok: true;
  success: boolean;
  cost: number;
  row: Row;
  /** Worn items change the owner's stats. */
  worn: boolean;
}

async function ownedEquipment(tx: Tx, characterId: string, instanceId: string) {
  const [row] = await tx
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, instanceId), eq(inventoryItems.characterId, characterId)));
  return row && equipDef(row.itemId) ? row : undefined;
}

const charge = (tx: Tx, characterId: string, cost: number) =>
  tx
    .update(characters)
    .set({ currency: sql`${characters.currency} - ${cost}`, updatedAt: new Date() })
    .where(eq(characters.id, characterId));

/** One Forge Ascension attempt, paid in currency whatever the outcome. */
export function forgeItem(
  db: Db,
  characterId: string,
  instanceId: string,
  fromAttempts: number,
  rng: Rng,
): Promise<EnhanceOutcome | Fail> {
  return db.transaction(async (tx) => {
    const c = await lockCharacter(tx, characterId);
    const row = await ownedEquipment(tx, characterId, instanceId);
    if (!row) return fail('not_found');
    if (row.forgeAttempts !== fromAttempts) return fail('stale');
    const step = forgeStep(row.forgeLevel);
    if (!step) return fail('max_level');
    if (c.currency < step.cost) return fail('insufficient_currency');
    const { success, level } = rollForge(row.forgeLevel, rng);
    const [updated] = await tx
      .update(inventoryItems)
      .set({ forgeLevel: level, forgeAttempts: row.forgeAttempts + 1 })
      .where(eq(inventoryItems.id, row.id))
      .returning();
    await charge(tx, characterId, step.cost);
    await log(
      tx,
      characterId,
      'forge',
      row.id,
      { version: FORGE.version, from: row.forgeLevel, to: level, success },
      -step.cost,
    );
    return { ok: true, success, cost: step.cost, row: updated!, worn: row.equipSlot !== null };
  });
}

/** One Arcane Imprint reroll, paid in currency. */
export function imprintItem(
  db: Db,
  characterId: string,
  instanceId: string,
  fromRolls: number,
  rng: Rng,
): Promise<EnhanceOutcome | Fail> {
  return db.transaction(async (tx) => {
    const c = await lockCharacter(tx, characterId);
    const row = await ownedEquipment(tx, characterId, instanceId);
    if (!row) return fail('not_found');
    if (row.imprintRolls !== fromRolls) return fail('stale');
    const cost = imprintCost(row.imprintTier);
    if (c.currency < cost) return fail('insufficient_currency');
    const { tier, lines } = rollImprint(row.imprintTier, rng);
    const [updated] = await tx
      .update(inventoryItems)
      .set({ imprintTier: tier, imprints: lines, imprintRolls: row.imprintRolls + 1 })
      .where(eq(inventoryItems.id, row.id))
      .returning();
    await charge(tx, characterId, cost);
    await log(
      tx,
      characterId,
      'imprint',
      row.id,
      { version: IMPRINTS.version, fromTier: row.imprintTier, tier, lines },
      -cost,
    );
    return {
      ok: true,
      success: tier > row.imprintTier,
      cost,
      row: updated!,
      worn: row.equipSlot !== null,
    };
  });
}

/** Consumes one consumable from its lowest bag slot and returns what it restores. */
export function useItem(
  db: Db,
  characterId: string,
  itemId: string,
): Promise<{ ok: true; restore: { hp?: number; mp?: number } } | Fail> {
  return db.transaction(async (tx) => {
    await lockCharacter(tx, characterId);
    const item = Object.hasOwn(ITEMS, itemId) ? ITEMS[itemId] : undefined;
    if (!item?.use) return fail('not_usable');
    const rows = await tx
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.characterId, characterId), eq(inventoryItems.itemId, itemId)))
      .orderBy(inventoryItems.slot)
      .limit(1);
    const row = rows[0];
    if (!row) return fail('not_found');
    if (row.quantity > 1) {
      await tx
        .update(inventoryItems)
        .set({ quantity: row.quantity - 1 })
        .where(eq(inventoryItems.id, row.id));
    } else {
      await tx.delete(inventoryItems).where(eq(inventoryItems.id, row.id));
    }
    await log(tx, characterId, 'use', row.quantity > 1 ? row.id : null, { itemId });
    return { ok: true, restore: item.use };
  });
}
