import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accounts, characters, createDb, eq, type Db } from './index';
import { startTestDatabase } from './testing';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let conn: ReturnType<typeof createDb>;
let db: Db;

beforeAll(async () => {
  testDb = await startTestDatabase();
  conn = createDb(testDb.url);
  db = conn.db;
});
afterAll(async () => {
  await conn.pool.end();
  await testDb.stop();
});

describe('schema', () => {
  it('stores an account with characters', async () => {
    const [account] = await db
      .insert(accounts)
      .values({ username: 'tester', passwordHash: 'x' })
      .returning();
    await db.insert(characters).values({
      accountId: account!.id,
      name: 'Ash',
      classId: 'runewaver',
      mapId: 'm',
      x: 1.5,
      y: 2,
    });
    const rows = await db.select().from(characters).where(eq(characters.accountId, account!.id));
    expect(rows).toMatchObject([{ name: 'Ash', level: 1, exp: 0, x: 1.5, y: 2 }]);
  });

  it('enforces case-insensitive unique character names', async () => {
    const [account] = await db
      .insert(accounts)
      .values({ username: 'tester2', passwordHash: 'x' })
      .returning();
    const row = {
      accountId: account!.id,
      name: 'ASH',
      classId: 'runewaver',
      mapId: 'm',
      x: 0,
      y: 0,
    };
    await expect(db.insert(characters).values(row)).rejects.toThrow();
  });
});
