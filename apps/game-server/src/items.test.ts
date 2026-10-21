import { FORGE, IMPRINTS, LOOT } from '@cindervale/content';
import {
  accounts,
  characters,
  createDb,
  eq,
  inventoryItems,
  itemTransactions,
} from '@cindervale/database';
import { startTestDatabase } from '@cindervale/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { equipItem, forgeItem, imprintItem, loadEquipped, unequipItem, useItem } from './items';
import { loadInventory } from './rewards';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let conn: ReturnType<typeof createDb>;
let n = 0;

beforeAll(async () => {
  testDb = await startTestDatabase();
  conn = createDb(testDb.url);
});
afterAll(async () => {
  await conn.pool.end();
  await testDb.stop();
});

async function character(
  { classId = 'ember-knight', level = 10, currency = 0 } = {},
  items: string[] = [],
) {
  const [a] = await conn.db
    .insert(accounts)
    .values({ username: `it${++n}`, passwordHash: 'x' })
    .returning();
  const [c] = await conn.db
    .insert(characters)
    .values({ accountId: a!.id, name: `It${n}`, classId, mapId: 'm', x: 0, y: 0, level, currency })
    .returning();
  const rows = items.length
    ? await conn.db
        .insert(inventoryItems)
        .values(items.map((itemId, slot) => ({ characterId: c!.id, slot, itemId, quantity: 1 })))
        .returning()
    : [];
  return { id: c!.id, rows };
}

const currency = async (id: string) =>
  (await conn.db.select().from(characters).where(eq(characters.id, id)))[0]!.currency;
const logs = (id: string) =>
  conn.db.select().from(itemTransactions).where(eq(itemTransactions.characterId, id));

describe('equip and unequip', () => {
  it('equips, swaps the previous item into the freed bag slot, and unequips', async () => {
    const { id, rows } = await character({}, ['ember-brand', 'ember-brand']);
    expect(await equipItem(conn.db, id, rows[0]!.id)).toEqual({ ok: true });
    expect(await equipItem(conn.db, id, rows[1]!.id)).toEqual({ ok: true });
    let inv = await loadInventory(conn.db, id);
    expect(inv.equipped.map((e) => [e.id, e.equipSlot])).toEqual([[rows[1]!.id, 'weapon']]);
    expect(inv.items.map((i) => [i.id, i.slot])).toEqual([[rows[0]!.id, 1]]);

    expect(await unequipItem(conn.db, id, 'weapon')).toEqual({ ok: true });
    inv = await loadInventory(conn.db, id);
    expect(inv.equipped).toEqual([]);
    expect(inv.items.map((i) => i.slot).sort()).toEqual([0, 1]);
    expect((await logs(id)).map((l) => l.kind).sort()).toEqual(['equip', 'equip', 'unequip']);
  });

  it('rejects wrong class, low level, non-equipment, foreign items and re-equips', async () => {
    const { id, rows } = await character({ level: 2 }, [
      'runewood-staff',
      'cinder-ring',
      'ember-tonic',
      'ember-brand',
    ]);
    const other = await character({}, ['ember-brand']);
    expect(await equipItem(conn.db, id, rows[0]!.id)).toEqual({ ok: false, reason: 'wrong_class' });
    expect(await equipItem(conn.db, id, rows[1]!.id)).toEqual({
      ok: false,
      reason: 'level_too_low',
    });
    expect(await equipItem(conn.db, id, rows[2]!.id)).toEqual({
      ok: false,
      reason: 'not_equipment',
    });
    expect(await equipItem(conn.db, id, other.rows[0]!.id)).toEqual({
      ok: false,
      reason: 'not_found',
    });
    await equipItem(conn.db, id, rows[3]!.id);
    expect(await equipItem(conn.db, id, rows[3]!.id)).toEqual({ ok: false, reason: 'stale' });
    expect(await unequipItem(conn.db, id, 'hat')).toEqual({ ok: false, reason: 'not_found' });
  });

  it('refuses to unequip into a full bag', async () => {
    const { id, rows } = await character({}, ['ember-brand']);
    await equipItem(conn.db, id, rows[0]!.id);
    await conn.db.insert(inventoryItems).values(
      Array.from({ length: LOOT.inventoryCapacity }, (_, slot) => ({
        characterId: id,
        slot,
        itemId: 'twig-bundle',
        quantity: 1,
      })),
    );
    expect(await unequipItem(conn.db, id, 'weapon')).toEqual({
      ok: false,
      reason: 'inventory_full',
    });
    expect(await loadEquipped(conn.db, id)).toHaveLength(1);
  });

  it('never duplicates or loses items under concurrent equip/unequip', async () => {
    const { id, rows } = await character({}, ['ember-brand', 'ember-brand', 'sprout-cap']);
    await Promise.all([
      equipItem(conn.db, id, rows[0]!.id),
      equipItem(conn.db, id, rows[1]!.id),
      equipItem(conn.db, id, rows[2]!.id),
      unequipItem(conn.db, id, 'weapon'),
      equipItem(conn.db, id, rows[0]!.id),
    ]);
    const inv = await loadInventory(conn.db, id);
    const ids = [...inv.items, ...inv.equipped].map((i) => i.id).sort();
    expect(ids).toEqual(rows.map((r) => r.id).sort());
    expect(new Set(inv.items.map((i) => i.slot)).size).toBe(inv.items.length);
    expect(inv.equipped.filter((e) => e.equipSlot === 'weapon').length).toBeLessThanOrEqual(1);
  });
});

describe('Forge Ascension', () => {
  it('charges the configured cost on success and failure, and logs the table version', async () => {
    const cost = FORGE.levels[0]!.cost;
    const { id, rows } = await character({ currency: cost + FORGE.levels[1]!.cost }, [
      'ember-brand',
    ]);
    const win = await forgeItem(conn.db, id, rows[0]!.id, 0, () => 0);
    expect(win).toMatchObject({ ok: true, success: true, cost, row: { forgeLevel: 1 } });
    const lose = await forgeItem(conn.db, id, rows[0]!.id, 1, () => 0.999);
    expect(lose).toMatchObject({ ok: true, success: false, row: { forgeLevel: 1 } });
    expect(await currency(id)).toBe(0);
    const entries = await logs(id);
    expect(entries.map((l) => l.detail.version)).toEqual([FORGE.version, FORGE.version]);
    expect(entries.reduce((sum, l) => sum + l.currencyDelta, 0)).toBe(
      -(cost + FORGE.levels[1]!.cost),
    );
  });

  it('rejects without charging: stale level, insufficient currency, unknown item, max level', async () => {
    const { id, rows } = await character({ currency: 50 }, ['ember-brand', 'twig-bundle']);
    expect(await forgeItem(conn.db, id, rows[0]!.id, 3, () => 0)).toEqual({
      ok: false,
      reason: 'stale',
    });
    expect(await forgeItem(conn.db, id, rows[0]!.id, 0, () => 0)).toEqual({
      ok: false,
      reason: 'insufficient_currency',
    });
    expect(await forgeItem(conn.db, id, rows[1]!.id, 0, () => 0)).toEqual({
      ok: false,
      reason: 'not_found',
    });
    await conn.db
      .update(inventoryItems)
      .set({ forgeLevel: FORGE.levels.length })
      .where(eq(inventoryItems.id, rows[0]!.id));
    await conn.db.update(characters).set({ currency: 1e9 }).where(eq(characters.id, id));
    expect(await forgeItem(conn.db, id, rows[0]!.id, FORGE.levels.length, () => 0)).toEqual({
      ok: false,
      reason: 'max_level',
    });
    expect(await logs(id)).toEqual([]);
  });

  it('charges once when the same request races', async () => {
    const cost = FORGE.levels[0]!.cost;
    const { id, rows } = await character({ currency: cost * 10 }, ['ember-brand']);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => forgeItem(conn.db, id, rows[0]!.id, 0, () => 0)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await currency(id)).toBe(cost * 9);
  });

  it('rolls back everything when the operation throws mid-transaction', async () => {
    const { id, rows } = await character({ currency: 1000 }, ['ember-brand']);
    await expect(
      forgeItem(conn.db, id, rows[0]!.id, 0, () => {
        throw new Error('crash');
      }),
    ).rejects.toThrow('crash');
    expect(await currency(id)).toBe(1000);
    expect((await loadInventory(conn.db, id)).items[0]!.forgeLevel).toBe(0);
    expect(await logs(id)).toEqual([]);
  });
});

describe('Arcane Imprints', () => {
  it('awakens, rerolls with a request counter, and charges by tier', async () => {
    const cost = IMPRINTS.tiers[0]!.cost;
    const { id, rows } = await character({ currency: cost * 3 }, ['sprout-cap']);
    const first = await imprintItem(conn.db, id, rows[0]!.id, 0, () => 0);
    expect(first).toMatchObject({ ok: true, row: { imprintTier: 1, imprintRolls: 1 } });
    expect(await imprintItem(conn.db, id, rows[0]!.id, 0, () => 0)).toEqual({
      ok: false,
      reason: 'stale',
    });
    expect(await imprintItem(conn.db, id, rows[0]!.id, 1, () => 0.5)).toMatchObject({ ok: true });
    expect(await currency(id)).toBe(cost);
  });
});

describe('useItem', () => {
  it('consumes one from the lowest stack and reports the restore amount', async () => {
    const { id } = await character();
    await conn.db.insert(inventoryItems).values([
      { characterId: id, slot: 3, itemId: 'ember-tonic', quantity: 2 },
      { characterId: id, slot: 1, itemId: 'ember-tonic', quantity: 1 },
    ]);
    expect(await useItem(conn.db, id, 'ember-tonic')).toEqual({ ok: true, restore: { hp: 50 } });
    expect((await loadInventory(conn.db, id)).items.map((i) => [i.slot, i.quantity])).toEqual([
      [3, 2],
    ]);
    expect(await useItem(conn.db, id, 'dew-tonic')).toEqual({ ok: false, reason: 'not_found' });
    expect(await useItem(conn.db, id, 'twig-bundle')).toEqual({ ok: false, reason: 'not_usable' });
    expect(await useItem(conn.db, id, '__proto__')).toEqual({ ok: false, reason: 'not_usable' });
  });
});
