import { randomUUID } from 'node:crypto';
import { COMBAT, DROP_TABLES, LEVELING, LOOT, MAPS, type MapDef } from '@cindervale/content';
import { and, characters, eq, type Character, type Db } from '@cindervale/database';
import {
  expToNext,
  rollDrops,
  spawnBody,
  splitExp,
  stepBody,
  stepMonsterAi,
  TICK_RATE,
  type Rng,
} from '@cindervale/game-core';
import {
  AttackRequest,
  ClientMessage,
  InputMessage,
  JoinOptions,
  PickupRequest,
  RespawnRequest,
  ServerMessage,
  type AttackRejected,
  type AttackResult,
  type DropView,
  type ExpGained,
  type ItemPickedUp,
  type LevelUp,
  type LootSpawned,
  type MonsterKilled,
  type PickupRejected,
  type PickupRejectReason,
  type PlayerHit,
} from '@cindervale/protocol';
import { verifyToken } from '@cindervale/protocol/token';
import { Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import { monsterHitsPlayer, resolveAttack, validatePickup, type Drop } from './combat';
import { resetMonsterLife, spawnMonsters, topDamager, type Monster } from './monsters';
import { grantExp, grantLoot, loadInventory } from './rewards';
import { applyProgress, createSession, type Session } from './session';
import { DropState, MapState, MonsterState, PlayerState } from './state';

export interface MapRoomDeps {
  db: Db;
  jwtSecret: Uint8Array;
  /** Seconds a dropped client may take to reconnect before their session ends. */
  reconnectSeconds?: number;
  /** Injected for deterministic tests. */
  rng?: Rng;
  now?: () => number;
}

/** Max inputs a player may have queued; extras are dropped. */
const MAX_QUEUED_INPUTS = 30;
/** Step credits a player can bank to absorb network jitter. */
const MAX_STEP_CREDITS = 10;

type MapClient = Client<{ auth: Character }>;

/**
 * Builds the authoritative map room. A factory so deps are injected without globals.
 *
 * Movement: clients send one input per fixed step; the server replays them through the
 * shared game-core simulation. Step credits accrue with elapsed wall time (not tick count,
 * since timers can fire late), so a client can never move faster than real time.
 *
 * Combat: clients request a skill + facing; the server validates it and decides hits, damage
 * and kills. EXP and loot are persisted in transactions keyed for idempotency (rewards.ts).
 */
export function createMapRoom({
  db,
  jwtSecret,
  reconnectSeconds = 20,
  rng = Math.random,
  now = Date.now,
}: MapRoomDeps) {
  // Characters currently in any room of this process (including those awaiting reconnect).
  // shortcut: process-local; move to Redis/presence when running multiple game-server processes.
  const activeCharacters = new Set<string>();

  return class MapRoom extends Room<{ state: MapState; client: MapClient }> {
    override maxClients = 100;
    override maxMessagesPerSecond = TICK_RATE * 3;
    private map!: MapDef;
    private sessions = new Map<string, Session>();
    private monsters: Monster[] = [];
    private drops = new Map<string, Drop>();
    private regenMs = 0;

    // Options come from the first client's join (rooms are matched per mapId); untrusted.
    override onCreate(options: { mapId?: unknown }) {
      const mapId = String(options.mapId);
      const def = Object.hasOwn(MAPS, mapId) ? MAPS[mapId] : undefined;
      if (!def) throw new ServerError(400, 'Unknown map');
      this.map = def;
      this.state = new MapState({ mapId: def.id });

      this.monsters = spawnMonsters(def, now(), rng);
      for (const m of this.monsters) {
        this.state.monsters.set(
          m.id,
          new MonsterState({
            monsterId: m.def.id,
            x: m.ai.x,
            y: m.y,
            hp: m.hp,
            maxHp: m.def.hp,
            mode: m.ai.mode,
            facing: m.ai.facing,
          }),
        );
      }

      this.onMessage(ClientMessage.Input, InputMessage, (client, input) => {
        const s = this.sessions.get(client.sessionId);
        if (!s || input.seq <= s.lastQueuedSeq || s.inputs.length >= MAX_QUEUED_INPUTS) return;
        s.inputs.push(input);
        s.lastQueuedSeq = input.seq;
      });
      this.onMessage(ClientMessage.Attack, AttackRequest, (client, req) =>
        this.handleAttack(client, req),
      );
      this.onMessage(ClientMessage.Pickup, PickupRequest, (client, req) => {
        void this.handlePickup(client, req.dropId);
      });
      this.onMessage(ClientMessage.Respawn, RespawnRequest, (client) => this.handleRespawn(client));

      this.setTimestep((deltaMs) => this.tick(deltaMs), 1000 / TICK_RATE);
    }

    override async onAuth(_client: MapClient, rawOptions: unknown, context: AuthContext) {
      const options = JoinOptions.safeParse(rawOptions);
      if (!options.success) throw new ServerError(400, 'Invalid join options or protocol version');
      const accountId = context.token && (await verifyToken(context.token, jwtSecret));
      if (!accountId) throw new ServerError(401, 'Not authenticated');
      // Checked before the read: while the id is active its leave-save may not have committed,
      // and reading now would resume a stale row.
      if (activeCharacters.has(options.data.characterId))
        throw new ServerError(409, 'Character is already in game');

      const character = await db.query.characters.findFirst({
        where: and(
          eq(characters.id, options.data.characterId),
          eq(characters.accountId, accountId),
        ),
      });
      if (!character) throw new ServerError(403, 'Character not found');
      if (character.mapId !== this.map.id)
        throw new ServerError(400, 'Character is on another map');
      if (activeCharacters.has(character.id))
        throw new ServerError(409, 'Character is already in game');
      return character;
    }

    override onJoin(client: MapClient) {
      const c = client.auth!;
      // Re-checked here: two joins may pass onAuth concurrently.
      if (activeCharacters.has(c.id)) throw new ServerError(409, 'Character is already in game');
      activeCharacters.add(c.id);

      const s = createSession(client.sessionId, c, now());
      this.sessions.set(client.sessionId, s);
      const p = Object.assign(new PlayerState(), {
        characterId: c.id,
        name: c.name,
        classId: c.classId,
      });
      this.state.players.set(client.sessionId, p);
      this.syncPlayer(s, p);

      client.send(ServerMessage.ExpGained, this.progress(s, 0));
      void this.sendInventory(client, c.id);
    }

    override onDrop(client: MapClient) {
      // Not awaited: an expired window rejects the deferred, and onLeave handles cleanup.
      this.allowReconnection(client, reconnectSeconds);
    }

    override onReconnect(client: MapClient) {
      // A reloaded client resumes its input seq from the synced lastSeq + 1.
      const s = this.sessions.get(client.sessionId);
      if (!s) return;
      s.inputs = [];
      s.lastQueuedSeq = s.lastSeq;
    }

    override async onLeave(client: MapClient) {
      const s = this.sessions.get(client.sessionId);
      this.sessions.delete(client.sessionId);
      this.state.players.delete(client.sessionId);
      if (!s) return;
      // EXP, level, items and currency are persisted when granted; position and vitals here.
      // shortcut: a crash loses movement since join; add periodic position saves if that matters.
      try {
        await db
          .update(characters)
          .set({ x: s.body.x, y: s.body.y, hp: s.hp, mp: s.mp, updatedAt: new Date() })
          .where(eq(characters.id, s.characterId));
      } catch (err) {
        console.error(`Failed to save character ${s.characterId}`, err);
      } finally {
        activeCharacters.delete(s.characterId);
      }
    }

    // ---- Commands ----

    private handleAttack(client: MapClient, req: AttackRequest) {
      const s = this.sessions.get(client.sessionId);
      if (!s) return;
      const outcome = resolveAttack(s, req, this.monsters, now(), rng);
      if (!outcome.ok) {
        client.send(ServerMessage.AttackRejected, {
          requestId: req.requestId,
          reason: outcome.reason,
        } satisfies AttackRejected);
        return;
      }
      this.broadcast(ServerMessage.AttackResult, {
        sessionId: s.sessionId,
        requestId: req.requestId,
        skillId: req.skillId,
        facing: req.facing,
        hits: outcome.hits.map((h) => ({
          monsterId: h.monster.id,
          damage: h.damage,
          crit: h.crit,
          killed: h.killed,
        })),
      } satisfies AttackResult);
      for (const h of outcome.hits) if (h.killed) this.onMonsterKilled(h.monster, s.sessionId);
    }

    private async handlePickup(client: MapClient, dropId: string) {
      const s = this.sessions.get(client.sessionId);
      if (!s) return;
      const drop = this.drops.get(dropId);
      const reject = (reason: PickupRejectReason) =>
        client.send(ServerMessage.PickupRejected, { dropId, reason } satisfies PickupRejected);
      if (s.pickupPending) return reject('invalid_state');
      const invalid = validatePickup(s, drop, now());
      if (invalid || !drop) return reject(invalid ?? 'not_found');

      // Claim before awaiting, so a concurrent pickup of the same drop finds it gone.
      this.removeDrop(drop.id);
      s.pickupPending = true;
      let result: Awaited<ReturnType<typeof grantLoot>> | 'error';
      try {
        result = await grantLoot(
          db,
          s.characterId,
          `drop:${drop.id}`,
          drop.itemId
            ? { itemId: drop.itemId, quantity: drop.quantity }
            : { currency: drop.quantity },
        );
      } catch (err) {
        console.error(`Pickup of ${drop.id} failed`, err);
        result = 'error';
      } finally {
        s.pickupPending = false;
      }
      if (result === 'ok') {
        this.broadcast(ServerMessage.ItemPickedUp, {
          sessionId: client.sessionId,
          dropId,
          itemId: drop.itemId,
          quantity: drop.quantity,
        } satisfies ItemPickedUp);
        await this.sendInventory(client, s.characterId);
        return;
      }
      if (result === 'duplicate') return reject('not_found');
      // Not granted: put the drop back for this player (or someone else) to take later.
      if (now() < drop.expiresAt) this.addDrop(drop);
      reject(result);
    }

    private handleRespawn(client: MapClient) {
      const s = this.sessions.get(client.sessionId);
      const t = now();
      if (!s?.dead || t < s.deadAt + COMBAT.respawnDelayMs) return;
      s.dead = false;
      s.hp = s.stats.maxHp;
      s.mp = s.stats.maxMp;
      s.body = spawnBody(this.map.geometry);
      s.invulnUntil = t + COMBAT.hitInvulnMs;
      this.broadcast(ServerMessage.PlayerRespawned, { sessionId: s.sessionId });
    }

    // ---- Rewards ----

    private onMonsterKilled(m: Monster, killerSessionId: string) {
      this.broadcast(ServerMessage.MonsterKilled, {
        monsterId: m.id,
        killerSessionId,
      } satisfies MonsterKilled);

      const t = now();
      const owner = topDamager(m) ?? null;
      const rolled = rollDrops(DROP_TABLES[m.def.dropTableId]!, rng);
      const spawned = rolled.map((d, i): Drop => {
        const offset = (i - (rolled.length - 1) / 2) * LOOT.spreadPx;
        return {
          id: randomUUID(),
          itemId: d.itemId,
          quantity: d.quantity,
          x: Math.min(Math.max(m.ai.x + offset, 0), this.map.geometry.width),
          y: m.y,
          ownerId: owner,
          ownerUntil: t + LOOT.ownershipMs,
          expiresAt: t + LOOT.lifetimeMs,
        };
      });
      for (const d of spawned) this.addDrop(d);
      if (spawned.length > 0) {
        this.broadcast(ServerMessage.LootSpawned, {
          drops: spawned.map(toDropView),
        } satisfies LootSpawned);
      }

      // Keyed by the monster's life, so this death pays each contributor exactly once.
      for (const [characterId, amount] of splitExp(m.def.exp, m.damageBy)) {
        if (amount > 0) void this.grantExpTo(characterId, `exp:${m.lifeId}:${characterId}`, amount);
      }
    }

    private async grantExpTo(characterId: string, key: string, amount: number) {
      try {
        const result = await grantExp(db, characterId, key, amount);
        if (!result) return;
        const s = [...this.sessions.values()].find((x) => x.characterId === characterId);
        if (!s) return; // Left already; the grant is persisted regardless.
        const leveled = applyProgress(s, result.level, result.exp);
        this.clients.getById(s.sessionId)?.send(ServerMessage.ExpGained, this.progress(s, amount));
        if (leveled) {
          this.broadcast(ServerMessage.LevelUp, {
            sessionId: s.sessionId,
            level: s.level,
          } satisfies LevelUp);
        }
      } catch (err) {
        console.error(`EXP grant ${key} failed`, err);
      }
    }

    private progress(s: Session, amount: number): ExpGained {
      const next = expToNext(s.level, LEVELING);
      // 0 = max level (Infinity doesn't serialize).
      return { amount, level: s.level, exp: s.exp, expToNext: Number.isFinite(next) ? next : 0 };
    }

    private async sendInventory(client: MapClient, characterId: string) {
      try {
        client.send(ServerMessage.Inventory, await loadInventory(db, characterId));
      } catch (err) {
        console.error(`Inventory load for ${characterId} failed`, err);
      }
    }

    private addDrop(d: Drop) {
      this.drops.set(d.id, d);
      this.state.drops.set(d.id, new DropState(toDropView(d)));
    }

    private removeDrop(id: string) {
      this.drops.delete(id);
      this.state.drops.delete(id);
    }

    // ---- Simulation ----

    private tick(deltaMs: number) {
      const t = now();
      for (const [sessionId, s] of this.sessions) {
        s.credits = Math.min(s.credits + (deltaMs * TICK_RATE) / 1000, MAX_STEP_CREDITS);
        while (s.credits >= 1 && s.inputs.length > 0) {
          const input = s.inputs.shift()!;
          // Dead players' inputs are acknowledged but don't move them.
          if (!s.dead) s.body = stepBody(s.body, input, this.map.geometry);
          s.lastSeq = input.seq;
          s.credits--;
        }
        const p = this.state.players.get(sessionId);
        if (p) this.syncPlayer(s, p);
      }
      this.tickMonsters(t, deltaMs);
      this.tickDrops(t);
      this.tickRegen(deltaMs);
    }

    private tickMonsters(t: number, deltaMs: number) {
      const targets = [...this.sessions.values()].map((s) => ({
        id: s.sessionId,
        x: s.body.x,
        y: s.body.y,
        alive: !s.dead,
      }));
      for (const m of this.monsters) {
        const r = stepMonsterAi(m.ai, m.def.behavior, {
          now: t,
          dtMs: deltaMs,
          spawnX: m.spawnX,
          y: m.y,
          bounds: m.bounds,
          players: targets,
          rng,
        });
        m.ai = r.ai;
        if (r.respawned) resetMonsterLife(m);
        // Leashed home: heal, and contributions so far no longer earn a share.
        if (r.returnedHome) {
          m.hp = m.def.hp;
          m.damageBy.clear();
        }
        const target = r.attackTargetId ? this.sessions.get(r.attackTargetId) : undefined;
        if (target) this.monsterAttack(m, target, t);
        const ms = this.state.monsters.get(m.id);
        if (ms) Object.assign(ms, { x: m.ai.x, hp: m.hp, mode: m.ai.mode, facing: m.ai.facing });
      }
    }

    private monsterAttack(m: Monster, s: Session, t: number) {
      const hit = monsterHitsPlayer(m, s, t, rng, this.map.geometry.width);
      if (!hit) return;
      this.broadcast(ServerMessage.PlayerHit, {
        sessionId: s.sessionId,
        monsterId: m.id,
        damage: hit.damage,
        hp: s.hp,
      } satisfies PlayerHit);
      if (hit.died) this.broadcast(ServerMessage.PlayerDied, { sessionId: s.sessionId });
    }

    private tickDrops(t: number) {
      for (const d of this.drops.values()) {
        if (t >= d.expiresAt) this.removeDrop(d.id);
        else if (d.ownerId && t >= d.ownerUntil) {
          d.ownerId = null;
          this.state.drops.get(d.id)!.ownerId = '';
        }
      }
    }

    private tickRegen(deltaMs: number) {
      this.regenMs += deltaMs;
      if (this.regenMs < 1000) return;
      this.regenMs -= 1000;
      const { hp, mp } = COMBAT.regenPercentPerSec;
      for (const s of this.sessions.values()) {
        if (s.dead) continue;
        s.hp = Math.min(s.stats.maxHp, s.hp + Math.ceil((s.stats.maxHp * hp) / 100));
        s.mp = Math.min(s.stats.maxMp, s.mp + Math.ceil((s.stats.maxMp * mp) / 100));
      }
    }

    private syncPlayer(s: Session, p: PlayerState) {
      Object.assign(p, s.body, {
        lastSeq: s.lastSeq,
        level: s.level,
        hp: s.hp,
        maxHp: s.stats.maxHp,
        mp: s.mp,
        maxMp: s.stats.maxMp,
        dead: s.dead,
      });
    }
  };
}

const toDropView = (d: Drop): DropView => ({
  dropId: d.id,
  itemId: d.itemId ?? '',
  quantity: d.quantity,
  x: d.x,
  y: d.y,
  ownerId: d.ownerId ?? '',
});
