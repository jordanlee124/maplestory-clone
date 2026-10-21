// End-to-end combat through a real Colyseus server and SDK clients (Phase 1B completion).
import { DROP_TABLES, LEVELING, LOOT, MAPS } from '@cindervale/content';
import {
  accounts,
  characters,
  createDb,
  eq,
  grantedRewards,
  inventoryItems,
} from '@cindervale/database';
import { startTestDatabase } from '@cindervale/database/testing';
import { expToNext } from '@cindervale/game-core';
import {
  ClientMessage,
  PROTOCOL_VERSION,
  ROOM_MAP,
  ServerMessage,
  type AttackRejected,
  type AttackResult,
  type AutoGrindStatus,
  type CharacterStats,
  type DropView,
  type EnhanceResult,
  type ExpGained,
  type Inventory,
  type ItemPickedUp,
  type ItemRejected,
  type LevelUp,
  type MonsterKilled,
  type MonsterView,
  type PickupRejected,
  type SkillRejected,
} from '@cindervale/protocol';
import { signToken } from '@cindervale/protocol/token';
import { Server } from '@colyseus/core';
import { Client, type Room } from '@colyseus/sdk';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createMapRoom } from './map-room';

const secret = new TextEncoder().encode('test-secret-test-secret-test-secret');
const PORT = 26000 + Math.floor(Math.random() * 1000);
const MAP = 'fernreach-fields';
const TWIG = { id: 'm0', x: MAPS[MAP]!.monsterSpawns[0]!.x }; // twig-creature on the ground

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let conn: ReturnType<typeof createDb>;
let server: Server;
const open: Room[] = [];
let n = 0;

/**
 * rng 0.01: every hit crits, variance is minimal, every drop-table entry drops, and idle
 * timers are minimal: fully deterministic outcomes.
 */
beforeAll(async () => {
  testDb = await startTestDatabase();
  conn = createDb(testDb.url);
  server = new Server({ transport: new WebSocketTransport(), gracefullyShutdown: false });
  server
    .define(
      ROOM_MAP,
      createMapRoom({ db: conn.db, jwtSecret: secret, reconnectSeconds: 1, rng: () => 0.01 }),
    )
    .filterBy(['mapId']);
  await server.listen(PORT);
});
afterEach(async () => {
  await Promise.all(open.splice(0).map((r) => r.leave().catch(() => {})));
  await new Promise((r) => setTimeout(r, 100));
});
afterAll(async () => {
  await server.gracefullyShutdown(false);
  await conn.pool.end();
  await testDb.stop();
});

interface Seed {
  classId?: string;
  level?: number;
  exp?: number;
  /** Offset from the twig's spawn x (absolute x on other maps). */
  dx?: number;
  mapId?: string;
}

function connect(token: string, characterId: string, mapId = MAP) {
  const client = new Client(`ws://localhost:${PORT}`);
  client.auth.token = token;
  return client.joinOrCreate(ROOM_MAP, {
    characterId,
    mapId,
    protocolVersion: PROTOCOL_VERSION,
  });
}

async function join({
  classId = 'runewaver',
  level = 1,
  exp = 0,
  dx = -15,
  mapId = MAP,
}: Seed = {}) {
  const [account] = await conn.db
    .insert(accounts)
    .values({ username: `cb${++n}_${Date.now() % 1e6}`, passwordHash: 'x' })
    .returning();
  const [c] = await conn.db
    .insert(characters)
    .values({
      accountId: account!.id,
      name: `Cb${n}x${Date.now() % 1e4}`,
      classId,
      mapId,
      x: mapId === MAP ? TWIG.x + dx : dx,
      y: 640,
      level,
      exp,
    })
    .returning();
  const token = await signToken(account!.id, secret);
  const room = await connect(token, c!.id, mapId);
  open.push(room);
  return { room, characterId: c!.id, token, got: watch(room) };
}

function watch(room: Room) {
  const inbox: Record<string, unknown[]> = {};
  room.onMessage('*', (type, payload) => (inbox[String(type)] ??= []).push(payload));
  const got = <T>(type: string) => (inbox[type] ?? []) as T[];
  return got;
}

async function waitFor(check: () => boolean, ms = 4000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}

const monster = (room: Room, id: string) =>
  (room.state?.monsters as Map<string, MonsterView> | undefined)?.get(id);
const drops = (room: Room) => [...((room.state?.drops as Map<string, DropView>)?.values() ?? [])];
const attack = (room: Room, requestId: number, skillId = 'basic-attack', facing = 'right') =>
  room.send(ClientMessage.Attack, { requestId, skillId, facing });
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const me = (room: Room) => (room.state?.players as Map<string, { x: number }>)?.get(room.sessionId);

/** Walks with real-time inputs (server-validated movement) until within `range` of x. */
async function walkTo(room: Room, x: number, range = LOOT.pickupRange.x - 10) {
  for (let seq = 0; Math.abs(me(room)!.x - x) > range; seq++) {
    const right = me(room)!.x < x;
    room.send(ClientMessage.Input, {
      seq,
      left: !right,
      right,
      up: false,
      down: false,
      jump: false,
    });
    await delay(1000 / 60);
    if (seq > 600) throw new Error('walk timed out');
  }
}

describe('combat in a map room', () => {
  it('restores earned progression and inventory on reconnect without replaying rewards', async () => {
    const a = await join({ level: 10, exp: expToNext(10, LEVELING) - 1 });
    const b = await join({ dx: -400 });
    await waitFor(() => monster(a.room, TWIG.id)?.hp === 40);
    attack(a.room, 1);
    await waitFor(() => a.got<ExpGained>(ServerMessage.ExpGained).some((e) => e.level === 11));
    await waitFor(() => monster(b.room, TWIG.id)?.mode === 'dead');
    const loot = drops(a.room).find((d) => d.itemId === '')!;
    expect(loot).toBeDefined();
    a.room.send(ClientMessage.Pickup, { dropId: loot.dropId });
    await waitFor(() => a.got<Inventory>(ServerMessage.Inventory).some((i) => i.currency === 3));
    const before = await conn.db.select().from(characters).where(eq(characters.id, a.characterId));
    const ledgerBefore = await conn.db
      .select()
      .from(grantedRewards)
      .where(eq(grantedRewards.characterId, a.characterId));

    const reconnectToken = a.room.reconnectionToken;
    a.room.reconnection.enabled = false;
    a.room.connection.close(3000);
    open.splice(open.indexOf(a.room), 1);
    await delay(150);
    const rejoined = await new Client(`ws://localhost:${PORT}`).reconnect(reconnectToken);
    open.push(rejoined);
    const got = watch(rejoined);
    expect(rejoined.sessionId).toBe(a.room.sessionId);
    await waitFor(() => got<ExpGained>(ServerMessage.ExpGained).length === 1);
    expect(got<ExpGained>(ServerMessage.ExpGained)[0]).toMatchObject({
      amount: 0,
      level: 11,
      exp: 3,
    });
    await waitFor(() => got<Inventory>(ServerMessage.Inventory).length === 1);
    expect(got<Inventory>(ServerMessage.Inventory)[0]).toMatchObject({ currency: 3 });

    rejoined.send(ClientMessage.Pickup, { dropId: loot.dropId });
    await waitFor(() => got<PickupRejected>(ServerMessage.PickupRejected).length === 1);
    expect(got<PickupRejected>(ServerMessage.PickupRejected)[0]!.reason).toBe('not_found');
    await delay(550);
    attack(rejoined, 1); // Replaying a request cannot pay a dead monster's rewards again.
    await waitFor(() => got<AttackResult>(ServerMessage.AttackResult).length === 1);
    expect(got<AttackResult>(ServerMessage.AttackResult)[0]!.hits).toEqual([]);
    const after = await conn.db.select().from(characters).where(eq(characters.id, a.characterId));
    expect(after[0]).toMatchObject({
      level: before[0]!.level,
      exp: before[0]!.exp,
      currency: before[0]!.currency,
    });
    const ledgerAfter = await conn.db
      .select()
      .from(grantedRewards)
      .where(eq(grantedRewards.characterId, a.characterId));
    expect(ledgerAfter).toEqual(ledgerBefore);
    expect(got(ServerMessage.ExpGained)).toHaveLength(1);
    expect(b.got(ServerMessage.MonsterKilled)).toHaveLength(1);
  });

  it('two players damage a monster, kill it, and both earn persisted EXP', async () => {
    const a = await join({ dx: -15 });
    const b = await join({ dx: -25 });
    await waitFor(() => monster(b.room, TWIG.id)?.hp === 40);

    attack(a.room, 1);
    await waitFor(() => a.got<AttackResult>(ServerMessage.AttackResult).length === 1);
    const first = a.got<AttackResult>(ServerMessage.AttackResult)[0]!;
    // runewaver L1: 13 × crit 1.5 × defense 100/102 × variance 0.902 → 17
    expect(first.hits).toEqual([{ monsterId: TWIG.id, damage: 17, crit: true, killed: false }]);
    // B sees A's damage numbers too, and the monster's HP in synced state.
    await waitFor(() => b.got<AttackResult>(ServerMessage.AttackResult).length === 1);
    await waitFor(() => monster(b.room, TWIG.id)?.hp === 23);

    attack(b.room, 1);
    await delay(550); // basic-attack cooldown
    attack(a.room, 2);
    await waitFor(() => monster(a.room, TWIG.id)?.mode === 'dead');
    await waitFor(() => b.got(ServerMessage.MonsterKilled).length === 1);

    // 4 EXP split by damage: A dealt 17 + 6 = 23, B 17 → floor(4·23/40) = 2, floor(4·17/40) = 1
    await waitFor(() => a.got(ServerMessage.ExpGained).length === 2);
    await waitFor(() => b.got(ServerMessage.ExpGained).length === 2);
    expect(a.got<ExpGained>(ServerMessage.ExpGained)[1]).toMatchObject({
      amount: 2,
      exp: 2,
      level: 1,
    });
    expect(b.got<ExpGained>(ServerMessage.ExpGained)[1]).toMatchObject({
      amount: 1,
      exp: 1,
      level: 1,
    });
    const rows = await conn.db.select().from(characters).where(eq(characters.id, a.characterId));
    expect(rows[0]!.exp).toBe(2);
  });

  it('levels up, broadcasts it, recomputes stats and persists the level', async () => {
    const a = await join({ level: 10, exp: expToNext(10, LEVELING) - 1, dx: -15 });
    const b = await join({ dx: -400 });
    await waitFor(
      () => monster(a.room, TWIG.id)?.mode !== 'dead' && monster(a.room, TWIG.id)?.hp === 40,
      10_000,
    );
    attack(a.room, 1);
    await waitFor(() => b.got<LevelUp>(ServerMessage.LevelUp).length === 1, 10_000);
    expect(b.got<LevelUp>(ServerMessage.LevelUp)[0]).toEqual({
      sessionId: a.room.sessionId,
      level: 11,
    });
    const me = (a.room.state.players as Map<string, { level: number; maxHp: number }>).get(
      a.room.sessionId,
    );
    await waitFor(() => me?.level === 11);
    expect(me!.maxHp).toBe(40 + 7 * 10); // runewaver growth
    const rows = await conn.db.select().from(characters).where(eq(characters.id, a.characterId));
    expect(rows[0]).toMatchObject({ level: 11, exp: 3 });
  });

  it('spawns owned loot; only the owner picks it up, once, and it persists', async () => {
    const a = await join({ level: 10, dx: -15 });
    const b = await join({ dx: 15 });
    await waitFor(() => monster(a.room, TWIG.id)?.hp === 40, 10_000);
    attack(a.room, 1);
    const table = DROP_TABLES['twig-creature']!;
    const count = table.items.filter((e) => 0.01 < e.chance).length + 1;
    await waitFor(() => drops(a.room).length === count, 10_000); // rng 0.01: every entry drops
    expect(drops(a.room).every((d) => d.ownerId === a.characterId)).toBe(true);

    const x = me(a.room)!.x;
    const near = drops(a.room)
      .filter((d) => d.itemId !== '')
      .sort((d, e) => Math.abs(d.x - x) - Math.abs(e.x - x))[0]!;
    expect(Math.abs(near.x - x)).toBeLessThanOrEqual(LOOT.pickupRange.x);
    b.room.send(ClientMessage.Pickup, { dropId: near.dropId });
    await waitFor(() => b.got(ServerMessage.PickupRejected).length === 1);
    expect(b.got<PickupRejected>(ServerMessage.PickupRejected)[0]).toEqual({
      dropId: near.dropId,
      reason: 'not_owner',
    });

    // Double-send: exactly one pickup succeeds.
    a.room.send(ClientMessage.Pickup, { dropId: near.dropId });
    a.room.send(ClientMessage.Pickup, { dropId: near.dropId });
    await waitFor(() => b.got(ServerMessage.ItemPickedUp).length === 1);
    await waitFor(() => a.got(ServerMessage.PickupRejected).length === 1);
    // The second arrives while the first is still being persisted.
    expect(a.got<PickupRejected>(ServerMessage.PickupRejected)[0]!.reason).toBe('invalid_state');
    expect(b.got<ItemPickedUp>(ServerMessage.ItemPickedUp)[0]).toMatchObject({
      itemId: near.itemId,
      quantity: 1,
    });

    const currency = drops(a.room).find((d) => d.itemId === '')!;
    await walkTo(a.room, currency.x);
    a.room.send(ClientMessage.Pickup, { dropId: currency.dropId });
    await waitFor(() => a.got<Inventory>(ServerMessage.Inventory).some((i) => i.currency === 3));
    const inv = await conn.db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.characterId, a.characterId));
    expect(inv).toMatchObject([{ itemId: near.itemId, quantity: 1 }]);
    const ledger = await conn.db
      .select()
      .from(grantedRewards)
      .where(eq(grantedRewards.key, `drop:${near.dropId}`));
    expect(ledger).toHaveLength(1);
  }, 20_000);

  it('rejects invalid and malicious combat commands', async () => {
    const a = await join({ classId: 'runewaver', dx: -15 });
    const reasons = () => a.got<AttackRejected>(ServerMessage.AttackRejected).map((r) => r.reason);

    attack(a.room, 1, 'not-a-skill');
    attack(a.room, 2, '__proto__');
    attack(a.room, 3, 'flame-cleave'); // another class's skill
    await waitFor(() => reasons().length === 3);
    expect(reasons()).toEqual(['unknown_skill', 'unknown_skill', 'skill_not_owned']);

    attack(a.room, 4);
    attack(a.room, 5); // spam inside the attack lock
    await waitFor(() => reasons().length === 4);
    expect(reasons()[3]).toBe('too_fast');
    expect(a.got(ServerMessage.AttackResult)).toHaveLength(1);

    a.room.send(ClientMessage.Pickup, { dropId: 'does-not-exist' });
    await waitFor(() => a.got(ServerMessage.PickupRejected).length === 1);
    a.room.send(ClientMessage.Respawn, {}); // not dead: silently ignored
  });

  it('ignores forged attack results and positions, and rejects a distant loot pickup', async () => {
    const a = await join({ dx: -400 });
    await waitFor(() => monster(a.room, TWIG.id)?.hp === 40);
    a.room.send(ClientMessage.Attack, {
      requestId: 1,
      skillId: 'basic-attack',
      facing: 'right',
      x: TWIG.x - 15,
      y: 640,
      damage: 999999,
      monsterId: TWIG.id,
      hits: [{ monsterId: TWIG.id, damage: 999999, killed: true }],
    });
    await waitFor(() => a.got<AttackResult>(ServerMessage.AttackResult).length === 1);
    expect(a.got<AttackResult>(ServerMessage.AttackResult)[0]!.hits).toEqual([]);
    expect(monster(a.room, TWIG.id)?.hp).toBe(40);

    const owner = await join({ level: 10 });
    attack(owner.room, 1);
    await waitFor(() => drops(a.room).length === 4);
    const loot = drops(a.room)[0]!;
    a.room.send(ClientMessage.Pickup, {
      dropId: loot.dropId,
      x: loot.x,
      y: loot.y,
      ownerId: a.characterId,
    });
    await waitFor(() => a.got<PickupRejected>(ServerMessage.PickupRejected).length === 1);
    expect(a.got<PickupRejected>(ServerMessage.PickupRejected)[0]!.reason).toBe('out_of_range');
    expect(drops(a.room).some((d) => d.dropId === loot.dropId)).toBe(true);
    const rows = await conn.db.select().from(characters).where(eq(characters.id, a.characterId));
    expect(rows[0]).toMatchObject({ x: TWIG.x - 400, exp: 0, currency: 0 });
    expect(
      await conn.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, a.characterId)),
    ).toEqual([]);
  });

  it('disconnects a client that sends a malformed payload, and frees the character', async () => {
    const a = await join({ dx: -15 });
    open.splice(open.indexOf(a.room), 1); // the server closes it; leave() would never settle
    let left = false;
    a.room.onLeave(() => (left = true));
    a.room.send(ClientMessage.Attack, {
      requestId: 1,
      skillId: 'basic-attack',
      facing: 'up',
      damage: 9999,
    });
    await waitFor(() => left);
    expect(monster(a.room, TWIG.id)?.hp ?? 40).toBe(40);

    // The kicked session ended normally, so the character can join again.
    let again: Room | undefined;
    for (let i = 0; i < 20 && !again; i++) {
      again = await connect(a.token, a.characterId).catch(() => delay(250).then(() => undefined));
    }
    expect(again).toBeDefined();
    open.push(again!);
  });

  it('an aggressive monster kills a player, who stays dead across a rejoin until respawning', async () => {
    // Crystal Beetle (aggroRange 220, attack 60) vs a level-1 Runewaver (40 HP).
    const a = await join({ mapId: 'duskmire-caverns', dx: 560 });
    await waitFor(() => a.got(ServerMessage.PlayerDied).length === 1, 10_000);
    expect(a.got(ServerMessage.PlayerHit)).toHaveLength(1);

    // Leaving and rejoining must not revive or heal (vitals are persisted).
    await a.room.leave();
    open.splice(open.indexOf(a.room), 1);
    let room: Room | undefined;
    for (let i = 0; i < 20 && !room; i++) {
      room = await connect(a.token, a.characterId, 'duskmire-caverns').catch(() =>
        delay(250).then(() => undefined),
      );
    }
    open.push(room!);
    let respawned = false;
    room!.onMessage(ServerMessage.PlayerRespawned, () => (respawned = true));
    const me = () =>
      (room!.state?.players as Map<string, { hp: number; maxHp: number; dead: boolean }>)?.get(
        room!.sessionId,
      );
    await waitFor(() => me()?.dead === true);
    expect(me()!.hp).toBe(0);

    room!.send(ClientMessage.Respawn, {}); // too early after (re)joining dead: ignored
    await delay(2100);
    expect(respawned).toBe(false);
    room!.send(ClientMessage.Respawn, {});
    await waitFor(() => respawned);
    await waitFor(() => me()?.dead === false);
    expect(me()!.hp).toBe(me()!.maxHp);
  });

  it('learns skills with skill points, applies passives and buffs, and keeps them on rejoin', async () => {
    const a = await join({ level: 5, dx: -400 });
    const stats = () => a.got<CharacterStats>(ServerMessage.CharacterStats);
    await waitFor(() => stats().length === 1);
    const first = stats()[0]!;
    expect(first.skillPoints).toBe(12);
    expect(first.skills).toContainEqual({ skillId: 'rune-burst', level: 1 });
    expect(first.skills).toContainEqual({ skillId: 'runic-insight', level: 0 });

    a.room.send(ClientMessage.LearnSkill, { skillId: 'runic-insight', level: 1 });
    await waitFor(() => stats().length === 2);
    expect(stats()[1]!.skillPoints).toBe(11);
    expect(stats()[1]!.stats.maxMp).toBe(first.stats.maxMp + 15);

    const rejected = () => a.got<SkillRejected>(ServerMessage.SkillRejected).map((r) => r.reason);
    a.room.send(ClientMessage.LearnSkill, { skillId: 'runic-insight', level: 1 }); // resent
    await waitFor(() => rejected().length === 1);
    a.room.send(ClientMessage.LearnSkill, { skillId: 'flame-cleave', level: 2 });
    await waitFor(() => rejected().length === 2);
    expect(rejected()).toEqual(['stale', 'wrong_class']);

    attack(a.room, 1, 'mana-weave'); // not learned yet
    await waitFor(() => a.got<AttackRejected>(ServerMessage.AttackRejected).length === 1);
    expect(a.got<AttackRejected>(ServerMessage.AttackRejected)[0]!.reason).toBe('skill_not_owned');

    a.room.send(ClientMessage.LearnSkill, { skillId: 'mana-weave', level: 1 });
    await waitFor(() => stats().length === 3);
    attack(a.room, 2, 'mana-weave');
    await waitFor(() => stats().length === 4);
    expect(stats()[3]!.buffs).toEqual([
      { skillId: 'mana-weave', remainingMs: expect.closeTo(120_000, -3) },
    ]);
    expect(stats()[3]!.stats.magic).toBe(stats()[2]!.stats.magic + 5);

    await a.room.leave();
    open.splice(open.indexOf(a.room), 1);
    await delay(200); // let the leave-save free the character
    const rejoined = await connect(a.token, a.characterId);
    open.push(rejoined);
    const snapshot = await new Promise<CharacterStats>((r) =>
      rejoined.onMessage(ServerMessage.CharacterStats, r),
    );
    expect(snapshot.skills).toContainEqual({ skillId: 'runic-insight', level: 1 });
    expect(snapshot.skills).toContainEqual({ skillId: 'mana-weave', level: 1 });
    expect(snapshot.skillPoints).toBe(10);
    expect(snapshot.buffs).toEqual([]); // buffs end with the session
  });

  it('equips through the room, recomputing stats, and uses a potion server-side', async () => {
    const a = await join({ classId: 'ember-knight', level: 5, dx: -400 });
    const [blade] = await conn.db
      .insert(inventoryItems)
      .values([
        { characterId: a.characterId, slot: 0, itemId: 'ember-brand', quantity: 1 },
        { characterId: a.characterId, slot: 1, itemId: 'ember-tonic', quantity: 2 },
      ])
      .returning();
    // Rejoin so the seeded vitals and items load.
    await a.room.leave();
    open.splice(open.indexOf(a.room), 1);
    await delay(200);
    await conn.db
      .update(characters)
      .set({ currency: 500, hp: 10 })
      .where(eq(characters.id, a.characterId));
    const room = await connect(a.token, a.characterId);
    open.push(room);
    const inbox: Record<string, unknown[]> = {};
    room.onMessage('*', (type, payload) => (inbox[String(type)] ??= []).push(payload));
    const got = <T>(type: string) => (inbox[type] ?? []) as T[];
    const stats = () => got<CharacterStats>(ServerMessage.CharacterStats);
    await waitFor(() => stats().length === 1);
    const before = stats()[0]!.stats.attack;

    room.send(ClientMessage.Equip, { instanceId: blade!.id });
    await waitFor(() => stats().length === 2);
    expect(stats()[1]!.stats.attack).toBe(before + 10);
    await waitFor(() =>
      got<Inventory>(ServerMessage.Inventory).some((i) => i.equipped.length === 1),
    );

    room.send(ClientMessage.Forge, { instanceId: blade!.id, fromAttempts: 0 });
    await waitFor(() => got<EnhanceResult>(ServerMessage.EnhanceResult).length === 1);
    expect(got<EnhanceResult>(ServerMessage.EnhanceResult)[0]).toMatchObject({
      kind: 'forge',
      success: true, // rng 0.01
      forgeLevel: 1,
    });
    await waitFor(() => stats().length === 3);
    expect(stats()[2]!.stats.attack).toBe(before + 12);

    const hp = () => (room.state.players as Map<string, { hp: number }>).get(room.sessionId)!.hp;
    const hpBefore = hp();
    room.send(ClientMessage.UseItem, { itemId: 'ember-tonic' });
    room.send(ClientMessage.UseItem, { itemId: 'ember-tonic' }); // inside the use cooldown
    await waitFor(() => got<ItemRejected>(ServerMessage.ItemRejected).length === 1);
    expect(got<ItemRejected>(ServerMessage.ItemRejected)[0]!.reason).toMatch(/cooldown|busy/);
    await waitFor(() => hp() >= hpBefore + 50);
    const left = await conn.db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.itemId, 'ember-tonic'));
    expect(left.filter((r) => r.characterId === a.characterId)[0]!.quantity).toBe(1);
  });

  it('auto-grinds: kills monsters and collects only permitted loot through the normal paths', async () => {
    const a = await join({ level: 10, dx: -100 });
    const status = () => a.got<AutoGrindStatus>(ServerMessage.AutoGrind);
    await waitFor(() => status().length === 1); // sent on join
    expect(status()[0]!.state).toBe('DISABLED');

    a.room.send(ClientMessage.AutoGrindConfig, {
      skills: ['basic-attack'],
      target: 'nearest',
      hpPotionPct: 0,
      mpPotionPct: 0,
      loot: 'currency',
      bounds: { minX: 300, maxX: 1000 },
    });
    await waitFor(() => status().length === 2);
    a.room.send(ClientMessage.AutoGrindToggle, { enabled: true });

    const killed = () => a.got<MonsterKilled>(ServerMessage.MonsterKilled);
    await waitFor(() => killed().length >= 1, 15_000);
    await waitFor(
      () => a.got<Inventory>(ServerMessage.Inventory).some((i) => i.currency > 0),
      15_000,
    );
    a.room.send(ClientMessage.AutoGrindToggle, { enabled: false });
    await waitFor(() => status().at(-1)!.reason === 'disabled');

    // Rewards went through the keyed grants: exactly one EXP ledger entry per kill.
    const expKeys = async () =>
      (
        await conn.db
          .select()
          .from(grantedRewards)
          .where(eq(grantedRewards.characterId, a.characterId))
      ).filter((r) => r.key.startsWith('exp:')).length;
    await delay(300); // let in-flight grants commit
    expect(await expKeys()).toBe(killed().length);
    // loot: 'currency' never picks up items.
    const items = await conn.db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.characterId, a.characterId));
    expect(items).toEqual([]);
    // Movement stayed inside the configured bounds.
    expect(me(a.room)!.x).toBeGreaterThanOrEqual(300 - 5);
    expect(me(a.room)!.x).toBeLessThanOrEqual(1000 + 5);
    expect(a.got<AutoGrindStatus>(ServerMessage.AutoGrind).map((st) => st.state)).toEqual(
      expect.arrayContaining(['SEARCHING', 'ATTACKING']),
    );
  }, 40_000);

  it('manual input overrides automation, and a disconnect stops it', async () => {
    const a = await join({ level: 10, dx: -300 });
    const status = () => a.got<AutoGrindStatus>(ServerMessage.AutoGrind);
    await waitFor(() => status().length === 1);
    a.room.send(ClientMessage.AutoGrindToggle, { enabled: true });
    await waitFor(() => status().some((st) => st.state !== 'DISABLED'));

    a.room.send(ClientMessage.Input, {
      seq: 0,
      left: true,
      right: false,
      up: false,
      down: false,
      jump: false,
    });
    await waitFor(() => status().at(-1)!.state === 'PAUSED');
    expect(status().at(-1)!.reason).toBe('manual_input');

    const client = new Client(`ws://localhost:${PORT}`);
    const token = a.room.reconnectionToken;
    a.room.reconnection.enabled = false;
    open.splice(open.indexOf(a.room), 1); // closed below; cleanup leaves the rejoined room
    a.room.connection.close(3000); // network drop
    await delay(200);
    const rejoined = await client.reconnect(token);
    open.push(rejoined);
    const after = await new Promise<AutoGrindStatus>((r) =>
      rejoined.onMessage(ServerMessage.AutoGrind, r),
    );
    expect(after).toMatchObject({ state: 'DISABLED', reason: 'disconnected' });
  }, 20_000);
});
