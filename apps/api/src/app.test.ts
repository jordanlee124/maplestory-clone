import { START_MAP_ID } from '@cindervale/content';
import { createDb } from '@cindervale/database';
import { startTestDatabase } from '@cindervale/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, MAX_CHARACTERS_PER_ACCOUNT } from './app';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let conn: ReturnType<typeof createDb>;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  testDb = await startTestDatabase();
  conn = createDb(testDb.url);
  app = await buildApp({
    db: conn.db,
    jwtSecret: new TextEncoder().encode('test-secret-test-secret-test-secret'),
    webOrigin: 'http://localhost:3000',
  });
});
afterAll(async () => {
  await app.close();
  await conn.pool.end();
  await testDb.stop();
});

const post = (url: string, payload: object, token?: string) =>
  app.inject({
    method: 'POST',
    url,
    payload,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

describe('auth', () => {
  it('registers, rejects duplicates case-insensitively, and logs in', async () => {
    const reg = await post('/auth/register', { username: 'Alice', password: 'password123' });
    expect(reg.statusCode).toBe(201);
    expect(reg.json().token).toBeTypeOf('string');

    expect(
      (await post('/auth/register', { username: 'alice', password: 'password123' })).statusCode,
    ).toBe(409);
    expect(
      (await post('/auth/login', { username: 'ALICE', password: 'password123' })).statusCode,
    ).toBe(200);
    expect(
      (await post('/auth/login', { username: 'alice', password: 'wrongpass1' })).statusCode,
    ).toBe(401);
  });

  it('rejects invalid input', async () => {
    expect((await post('/auth/register', { username: 'a', password: 'x' })).statusCode).toBe(400);
  });
});

describe('characters', () => {
  it('requires auth', async () => {
    expect((await app.inject({ method: 'GET', url: '/characters' })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/characters',
          headers: { authorization: 'Bearer junk' },
        })
      ).statusCode,
    ).toBe(401);
  });

  it('creates and lists characters, enforcing unique names and the per-account limit', async () => {
    const { token } = (
      await post('/auth/register', { username: 'bob', password: 'password123' })
    ).json();
    const created = await post('/characters', { name: 'Bobby', classId: 'ember-knight' }, token);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      name: 'Bobby',
      classId: 'ember-knight',
      level: 1,
      mapId: START_MAP_ID,
    });

    expect(
      (await post('/characters', { name: 'BOBBY', classId: 'runewaver' }, token)).statusCode,
    ).toBe(409);
    expect((await post('/characters', { name: 'Bad', classId: 'pirate' }, token)).statusCode).toBe(
      400,
    );

    for (let i = 1; i < MAX_CHARACTERS_PER_ACCOUNT; i++) {
      expect(
        (await post('/characters', { name: `Bob${i}`, classId: 'thornblade' }, token)).statusCode,
      ).toBe(201);
    }
    expect(
      (await post('/characters', { name: 'BobMax', classId: 'thornblade' }, token)).statusCode,
    ).toBe(409);

    const list = await app.inject({
      method: 'GET',
      url: '/characters',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json()).toHaveLength(MAX_CHARACTERS_PER_ACCOUNT);
  });
});
