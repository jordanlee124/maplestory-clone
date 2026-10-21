import { LEVELING, LOOT } from '@cindervale/content';
import { accounts, characters, createDb, eq, inventoryItems } from '@cindervale/database';
import { startTestDatabase } from '@cindervale/database/testing';
import { expToNext } from '@cindervale/game-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { grantExp, grantLoot, loadInventory } from './rewards';

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

async function character(level = 1, exp = 0) {
  const [a] = await conn.db
    .insert(accounts)
    .values({ username: `rw${++n}`, passwordHash: 'x' })
    .returning();
  const [c] = await conn.db
    .insert(characters)
    .values({
      accountId: a!.id,
      name: `Rw${n}`,
      classId: 'runewaver',
      mapId: 'm',
      x: 0,
      y: 0,
      level,
      exp,
    })
    .returning();
  return c!.id;
}

/** Bag contents as { slot, itemId, quantity }. */
const bag = async (id: string) =>
  (await loadInventory(conn.db, id)).items.map(({ slot, itemId, quantity }) => ({
    slot,
    itemId,
    quantity,
  }));

const row = async (id: string) =>
  (await conn.db.select().from(characters).where(eq(characters.id, id)))[0]!;

describe('grantExp', () => {
  it('adds EXP and levels up, persisting both', async () => {
    const id = await character(1, expToNext(1, LEVELING) - 1);
    expect(await grantExp(conn.db, id, 'k1', 3)).toEqual({ level: 2, exp: 2, levelsGained: 1 });
    expect(await row(id)).toMatchObject({ level: 2, exp: 2 });
  });

  it('ignores a duplicate key, even when both grants race', async () => {
    const id = await character();
    const results = await Promise.all([
      grantExp(conn.db, id, 'dup', 5),
      grantExp(conn.db, id, 'dup', 5),
      grantExp(conn.db, id, 'dup', 5),
    ]);
    expect(results.filter((r) => r !== null)).toHaveLength(1);
    expect((await row(id)).exp).toBe(5);
    expect(await grantExp(conn.db, id, 'dup', 5)).toBeNull();
  });

  it('applies concurrent distinct grants without losing any', async () => {
    const id = await character();
    await Promise.all(Array.from({ length: 5 }, (_, i) => grantExp(conn.db, id, `c${i}`, 2)));
    expect((await row(id)).exp).toBe(10);
  });
});

describe('grantLoot', () => {
  it('stacks items, then fills free slots', async () => {
    const id = await character();
    expect(await grantLoot(conn.db, id, 'l1', { itemId: 'ember-tonic', quantity: 30 })).toBe('ok');
    expect(await grantLoot(conn.db, id, 'l2', { itemId: 'ember-tonic', quantity: 30 })).toBe('ok');
    expect(await bag(id)).toEqual([
      { slot: 0, itemId: 'ember-tonic', quantity: 50 },
      { slot: 1, itemId: 'ember-tonic', quantity: 10 },
    ]);
  });

  it('adds currency', async () => {
    const id = await character();
    await grantLoot(conn.db, id, 'cur-1', { currency: 7 });
    await grantLoot(conn.db, id, 'cur-2', { currency: 5 });
    expect((await loadInventory(conn.db, id)).currency).toBe(12);
  });

  it('refuses a duplicate pickup key', async () => {
    const id = await character();
    const grants = await Promise.all([
      grantLoot(conn.db, id, 'drop-x', { itemId: 'fern-frond', quantity: 1 }),
      grantLoot(conn.db, id, 'drop-x', { itemId: 'fern-frond', quantity: 1 }),
    ]);
    expect(grants.sort()).toEqual(['duplicate', 'ok']);
    expect(await bag(id)).toEqual([{ slot: 0, itemId: 'fern-frond', quantity: 1 }]);
  });

  it('is all-or-nothing when the inventory is full, and the key stays reusable', async () => {
    const id = await character();
    await conn.db.insert(inventoryItems).values(
      Array.from({ length: LOOT.inventoryCapacity }, (_, slot) => ({
        characterId: id,
        slot,
        itemId: 'sprout-cap',
        quantity: 1,
      })),
    );
    expect(await grantLoot(conn.db, id, 'full', { itemId: 'sprout-cap', quantity: 1 })).toBe(
      'inventory_full',
    );
    expect((await loadInventory(conn.db, id)).items).toHaveLength(LOOT.inventoryCapacity);
    // Currency never needs a slot.
    expect(await grantLoot(conn.db, id, 'full-c', { currency: 3 })).toBe('ok');

    await conn.db.delete(inventoryItems).where(eq(inventoryItems.slot, 0));
    expect(await grantLoot(conn.db, id, 'full', { itemId: 'sprout-cap', quantity: 1 })).toBe('ok');
  });
});
