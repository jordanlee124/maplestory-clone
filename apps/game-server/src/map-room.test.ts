import { MAPS, START_MAP_ID } from '@cindervale/content';
import { accounts, characters, createDb, eq } from '@cindervale/database';
import { startTestDatabase } from '@cindervale/database/testing';
import { ClientMessage, PROTOCOL_VERSION, ROOM_MAP, type PlayerView } from '@cindervale/protocol';
import { signToken } from '@cindervale/protocol/token';
import { matchMaker, Server } from '@colyseus/core';
import { Client, type Room } from '@colyseus/sdk';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMapRoom } from './map-room';

const secret = new TextEncoder().encode('test-secret-test-secret-test-secret');
const PORT = 25000 + Math.floor(Math.random() * 1000);
const spawn = MAPS[START_MAP_ID]!.geometry.spawn;

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let conn: ReturnType<typeof createDb>;
let server: Server;

async function seedPlayer(name: string) {
  const [account] = await conn.db
    .insert(accounts)
    .values({ username: name.toLowerCase(), passwordHash: 'x' })
    .returning();
  const [character] = await conn.db
    .insert(characters)
    .values({
      accountId: account!.id,
      name,
      classId: 'gale-ranger',
      mapId: START_MAP_ID,
      x: spawn.x,
      y: spawn.y,
    })
    .returning();
  return { token: await signToken(account!.id, secret), characterId: character!.id };
}

function connect(token: string, characterId: string) {
  const client = new Client(`ws://localhost:${PORT}`);
  client.auth.token = token;
  return client.joinOrCreate(ROOM_MAP, { characterId, protocolVersion: PROTOCOL_VERSION });
}

// State arrives asynchronously after join, so players may briefly be undefined.
const players = (room: Room): PlayerView[] => [
  ...((room.state?.players as Map<string, PlayerView>)?.values() ?? []),
];

async function waitFor(check: () => boolean, ms = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}

function walkRight(room: Room, steps: number, fromSeq = 0) {
  for (let i = 0; i < steps; i++) {
    room.send(ClientMessage.Input, { seq: fromSeq + i, left: false, right: true, jump: false });
  }
}

beforeAll(async () => {
  testDb = await startTestDatabase();
  conn = createDb(testDb.url);
  server = new Server({ transport: new WebSocketTransport(), gracefullyShutdown: false });
  server.define(ROOM_MAP, createMapRoom({ db: conn.db, jwtSecret: secret, reconnectSeconds: 2 }), {
    mapId: START_MAP_ID,
  });
  await server.listen(PORT);
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
  await conn.pool.end();
  await testDb.stop();
});

describe('MapRoom', () => {
  it('rejects bad tokens, foreign characters, and stale protocol versions', async () => {
    const a = await seedPlayer('Reject1');
    const b = await seedPlayer('Reject2');
    await expect(connect('junk', a.characterId)).rejects.toThrow();
    await expect(connect(b.token, a.characterId)).rejects.toThrow();
    const client = new Client(`ws://localhost:${PORT}`);
    client.auth.token = a.token;
    await expect(
      client.joinOrCreate(ROOM_MAP, { characterId: a.characterId, protocolVersion: 0 }),
    ).rejects.toThrow();
  });

  it('lets two players see each other move, server-authoritatively', async () => {
    const a = await seedPlayer('Alpha');
    const b = await seedPlayer('Bravo');
    const roomA = await connect(a.token, a.characterId);
    const roomB = await connect(b.token, b.characterId);
    expect(roomA.roomId).toBe(roomB.roomId);

    await waitFor(() => players(roomA).length === 2 && players(roomB).length === 2);
    walkRight(roomA, 30);
    await waitFor(() => players(roomB).find((p) => p.name === 'Alpha')?.lastSeq === 29);
    const alpha = players(roomB).find((p) => p.name === 'Alpha')!;
    expect(alpha.x).toBeCloseTo(spawn.x + 30 * (180 / 60), 5);

    await roomA.leave();
    await roomB.leave();
  });

  it('rejects a second session for a character already in game', async () => {
    const a = await seedPlayer('Dupe');
    const room = await connect(a.token, a.characterId);
    await expect(connect(a.token, a.characterId)).rejects.toThrow();
    await room.leave();
  });

  it('keeps the session across a dropped connection', async () => {
    const a = await seedPlayer('Dropper');
    const room = await connect(a.token, a.characterId);
    walkRight(room, 10);
    await waitFor(() => players(room)[0]?.lastSeq === 9);
    const before = { sessionId: room.sessionId, x: players(room)[0]!.x };

    const client = new Client(`ws://localhost:${PORT}`);
    const token = room.reconnectionToken;
    room.reconnection.enabled = false; // reconnect manually, as a reloaded page would
    room.connection.close(3000); // non-consented close == network drop (4000 means CONSENTED)
    await new Promise((r) => setTimeout(r, 200));
    const rejoined = await client.reconnect(token);

    expect(rejoined.sessionId).toBe(before.sessionId);
    await waitFor(() => players(rejoined).some((p) => p.name === 'Dropper'));
    expect(players(rejoined).find((p) => p.name === 'Dropper')!.x).toBe(before.x);
    await rejoined.leave();
  });

  it('removes a dropped player who never reconnects and frees the character', async () => {
    const a = await seedPlayer('Ghost');
    const b = await seedPlayer('Watcher');
    const ghost = await connect(a.token, a.characterId);
    const watcher = await connect(b.token, b.characterId);
    await waitFor(() => players(watcher).some((p) => p.name === 'Ghost'));

    ghost.reconnection.enabled = false;
    ghost.connection.close(3000);
    await waitFor(() => !players(watcher).some((p) => p.name === 'Ghost'), 4000); // reconnectSeconds = 2
    const again = await connect(a.token, a.characterId);
    await again.leave();
    await watcher.leave();
  });

  it('persists position on leave and restores it on the next join', async () => {
    const a = await seedPlayer('Saver');
    const room = await connect(a.token, a.characterId);
    walkRight(room, 20);
    await waitFor(() => players(room)[0]?.lastSeq === 19);
    const x = players(room)[0]!.x;
    await room.leave();

    await waitFor(() => matchMaker.stats.local.ccu === 0);
    const [row] = await conn.db.select().from(characters).where(eq(characters.id, a.characterId));
    expect(row!.x).toBe(x);

    const again = await connect(a.token, a.characterId);
    await waitFor(() => players(again).some((p) => p.name === 'Saver'));
    expect(players(again).find((p) => p.name === 'Saver')!.x).toBe(x);
    await again.leave();
  });

  it('keeps up with a client sending inputs in real time', async () => {
    const a = await seedPlayer('Pacer');
    const room = await connect(a.token, a.characterId);
    // Pace by wall clock (like the client's accumulator), not timer callbacks.
    const start = Date.now();
    for (let sent = 0; sent < 120; await new Promise((r) => setTimeout(r, 5))) {
      const due = Math.min(120, Math.floor(((Date.now() - start) * 60) / 1000));
      for (; sent < due; sent++)
        room.send(ClientMessage.Input, { seq: sent, left: false, right: true, jump: false });
    }
    // Timers fire late on some platforms (~38Hz on Windows); the server must not fall behind.
    await waitFor(() => players(room)[0]?.lastSeq === 119, 250);
    await room.leave();
  });

  it('never resumes a stale position when rejoining while the leave is still saving', async () => {
    const a = await seedPlayer('Quick');
    const room = await connect(a.token, a.characterId);
    walkRight(room, 20);
    await waitFor(() => players(room)[0]?.lastSeq === 19);
    const x = players(room)[0]!.x;
    void room.leave();

    // Rejoin immediately, retrying 409s like the real client does.
    let again: Room | undefined;
    while (!again) again = await connect(a.token, a.characterId).catch(() => undefined);
    await waitFor(() => players(again!).some((p) => p.name === 'Quick'));
    expect(players(again).find((p) => p.name === 'Quick')!.x).toBe(x);
    await again.leave();
  });

  it('throttles clients that send inputs faster than real time', async () => {
    const a = await seedPlayer('Speedy');
    const room = await connect(a.token, a.characterId);
    const start = Date.now();
    walkRight(room, 30); // 0.5s of input sent instantly
    await new Promise((r) => setTimeout(r, 100));
    const ticks = ((Date.now() - start) / 1000) * 60;
    // At most one step per elapsed tick plus the burst allowance.
    expect(players(room)[0]!.lastSeq + 1).toBeLessThanOrEqual(Math.ceil(ticks) + 10 + 2);
    await room.leave();
  });
});
