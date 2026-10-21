import { randomUUID } from 'node:crypto';
import {
  COMBAT,
  DROP_TABLES,
  ITEMS,
  ITEM_USE_COOLDOWN_MS,
  LEVELING,
  LOOT,
  MAPS,
  type MapDef,
} from '@cindervale/content';
import { and, characters, eq, type Character, type Db } from '@cindervale/database';
import {
  expToNext,
  rollDrops,
  spawnBody,
  splitExp,
  stepBody,
  stepMonsterAi,
  TICK_RATE,
  type MoveInput,
  type Rng,
} from '@cindervale/game-core';
import {
  AttackRequest,
  AutoGrindConfig,
  AutoGrindToggle,
  ClientMessage,
  EquipRequest,
  ForgeRequest,
  ImprintRequest,
  InputMessage,
  JoinOptions,
  LearnSkillRequest,
  PickupRequest,
  RespawnRequest,
  ServerMessage,
  UnequipRequest,
  UseItemRequest,
  type AttackRejected,
  type AttackResult,
  type AutoGrindStatus,
  type CharacterStats,
  type DropView,
  type EnhanceResult,
  type ExpGained,
  type ItemAction,
  type ItemPickedUp,
  type ItemRejected,
  type ItemRejectReason,
  type LevelUp,
  type LootSpawned,
  type MonsterKilled,
  type PickupRejected,
  type PickupRejectReason,
  type PlayerHit,
  type SkillRejected,
} from '@cindervale/protocol';
import { verifyToken } from '@cindervale/protocol/token';
import { Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import { monsterHitsPlayer, resolveAttack, validatePickup, type Drop } from './combat';
import { resetMonsterLife, spawnMonsters, topDamager, type Monster } from './monsters';
import {
  equipItem,
  forgeItem,
  imprintItem,
  loadEquipped,
  unequipItem,
  useItem,
  type EnhanceOutcome,
} from './items';
import { grantExp, grantLoot, loadInventory } from './rewards';
import {
  disabledAuto,
  isIdle,
  isRunning,
  loadAutoConfig,
  normalizeConfig,
  pauseAuto,
  saveAutoConfig,
  skipDrop,
  startAuto,
  stepAuto,
  type AutoAction,
} from './autogrind';
import type { EquipInstance } from './equipment';
import {
  checkLearn,
  classSkills,
  learnSkill,
  loadSkills,
  skillDef,
  skillPoints,
} from './progression';
import { applyProgress, createSession, expireBuffs, refreshStats, type Session } from './session';
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

type MapClient = Client<{
  auth: Character & {
    skills: Map<string, number>;
    equipment: EquipInstance[];
    autoConfig: AutoGrindConfig;
  };
}>;

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
        if (s && !isIdle(input)) this.manualOverride(s); // even when the input itself is dropped
        if (!s || input.seq <= s.lastQueuedSeq || s.inputs.length >= MAX_QUEUED_INPUTS) return;
        s.inputs.push(input);
        s.lastQueuedSeq = input.seq;
      });
      this.onMessage(ClientMessage.Attack, AttackRequest, (client, req) => {
        this.manualOverride(this.sessions.get(client.sessionId));
        this.handleAttack(client, req);
      });
      this.onMessage(ClientMessage.Pickup, PickupRequest, (client, req) => {
        this.manualOverride(this.sessions.get(client.sessionId));
        void this.handlePickup(client, req.dropId);
      });
      this.onMessage(ClientMessage.Respawn, RespawnRequest, (client) => this.handleRespawn(client));
      this.onMessage(ClientMessage.LearnSkill, LearnSkillRequest, (client, req) => {
        void this.handleLearnSkill(client, req);
      });
      this.onMessage(ClientMessage.Equip, EquipRequest, (client, req) => {
        void this.itemOp(client, 'equip', (s) => equipItem(db, s.characterId, req.instanceId));
      });
      this.onMessage(ClientMessage.Unequip, UnequipRequest, (client, req) => {
        void this.itemOp(client, 'unequip', (s) => unequipItem(db, s.characterId, req.slot));
      });
      this.onMessage(ClientMessage.Forge, ForgeRequest, (client, req) => {
        void this.itemOp(client, 'forge', (s) =>
          forgeItem(db, s.characterId, req.instanceId, req.fromAttempts, rng),
        );
      });
      this.onMessage(ClientMessage.Imprint, ImprintRequest, (client, req) => {
        void this.itemOp(client, 'imprint', (s) =>
          imprintItem(db, s.characterId, req.instanceId, req.fromRolls, rng),
        );
      });
      this.onMessage(ClientMessage.UseItem, UseItemRequest, (client, req) => {
        this.manualOverride(this.sessions.get(client.sessionId));
        void this.handleUseItem(client, req.itemId);
      });
      this.onMessage(ClientMessage.AutoGrindConfig, AutoGrindConfig, (client, config) => {
        void this.handleAutoConfig(client, config);
      });
      this.onMessage(ClientMessage.AutoGrindToggle, AutoGrindToggle, (client, { enabled }) => {
        const s = this.sessions.get(client.sessionId);
        if (!s) return;
        s.auto = enabled
          ? startAuto(s.auto, s, this.map, now())
          : disabledAuto(s.auto.config, 'disabled');
        this.sendAuto(s, true);
      });

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
      return {
        ...character,
        skills: await loadSkills(db, character.id),
        equipment: await loadEquipped(db, character.id),
        autoConfig: await loadAutoConfig(
          db,
          character.id,
          character.classId,
          this.map.geometry.width,
        ),
      };
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
      this.sendStats(s);
      this.sendAuto(s, true);
      void this.sendInventory(client, c.id);
    }

    override onDrop(client: MapClient) {
      // Automation never runs for a player who isn't connected.
      const s = this.sessions.get(client.sessionId);
      if (s) s.auto = disabledAuto(s.auto.config, 'disconnected');
      // Not awaited: an expired window rejects the deferred, and onLeave handles cleanup.
      this.allowReconnection(client, reconnectSeconds);
    }

    override onReconnect(client: MapClient) {
      // A reloaded client resumes its input seq from the synced lastSeq + 1.
      const s = this.sessions.get(client.sessionId);
      if (!s) return;
      s.inputs = [];
      s.lastQueuedSeq = s.lastSeq;
      // Reloaded clients have no owner snapshots even though their session survived.
      client.send(ServerMessage.ExpGained, this.progress(s, 0));
      this.sendStats(s);
      this.sendAuto(s, true);
      void this.sendInventory(client, s.characterId);
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
      if (skillDef(req.skillId)?.kind === 'buff') this.sendStats(s);
      for (const h of outcome.hits) if (h.killed) this.onMonsterKilled(h.monster, s.sessionId);
    }

    private async handleLearnSkill(client: MapClient, req: LearnSkillRequest) {
      const s = this.sessions.get(client.sessionId);
      if (!s) return;
      const reject = (reason: SkillRejected['reason']) =>
        client.send(ServerMessage.SkillRejected, {
          skillId: req.skillId,
          reason,
        } satisfies SkillRejected);
      if (s.learnPending) return reject('busy');
      // Cheap pre-check so junk requests never reach the DB. The session never runs ahead of
      // the DB, so this can only reject early; the transaction re-checks as the authority.
      const early = checkLearn(s.classId, s.level, s.skills, req.skillId, req.level);
      if (early) return reject(early);
      s.learnPending = true;
      try {
        const result = await learnSkill(db, s.characterId, req.skillId, req.level);
        if (!result.ok) return reject(result.reason);
        s.skills = result.learned;
        refreshStats(s);
        this.sendStats(s);
      } catch (err) {
        console.error(`Learning ${req.skillId} for ${s.characterId} failed`, err);
        reject('error');
      } finally {
        s.learnPending = false;
      }
    }

    // ---- Automation ----

    /** Manual play takes over from automation immediately. */
    private manualOverride(s: Session | undefined) {
      if (!s || s.auto.state === 'DISABLED') return;
      s.auto = pauseAuto(s.auto, now());
      this.sendAuto(s);
    }

    private async handleAutoConfig(client: MapClient, requested: AutoGrindConfig) {
      const s = this.sessions.get(client.sessionId);
      if (!s) return;
      const config = normalizeConfig(requested, s.classId, this.map.geometry.width);
      const refuse = (reason: AutoGrindStatus['reason']) =>
        client.send(ServerMessage.AutoGrind, {
          state: s.auto.state,
          config: s.auto.config,
          reason,
        } satisfies AutoGrindStatus);
      if (!config) return refuse('invalid_config');
      // One save at a time, so the session and the stored row can't end up different.
      if (s.autoConfigPending) return refuse('busy');
      s.autoConfigPending = true;
      try {
        await saveAutoConfig(db, s.characterId, config);
      } catch (err) {
        console.error(`Saving auto-grind config for ${s.characterId} failed`, err);
        return refuse('error');
      } finally {
        s.autoConfigPending = false;
      }
      s.auto = { ...s.auto, config };
      this.sendAuto(s, true);
    }

    /** Runs one automation decision; returns the movement input for this tick, if running. */
    private stepAutomation(s: Session, t: number): MoveInput | undefined {
      if (s.auto.state === 'DISABLED') return undefined;
      const r = stepAuto(s.auto, s, {
        map: this.map,
        monsters: this.monsters,
        drops: this.drops.values(),
        now: t,
      });
      s.auto = r.auto;
      this.sendAuto(s);
      if (!isRunning(s.auto)) return undefined;
      const client = this.clients.getById(s.sessionId);
      if (client && r.action) this.runAutoAction(client, s, r.action);
      return r.input;
    }

    /** Automated commands go through the same handlers, and checks, as a client's. */
    private runAutoAction(client: MapClient, s: Session, action: AutoAction) {
      if (action.type === 'attack') {
        s.autoRequestId = s.autoRequestId >= 2 ** 31 - 1 ? 2 ** 30 : s.autoRequestId + 1;
        this.handleAttack(client, {
          requestId: s.autoRequestId,
          skillId: action.skillId,
          facing: action.facing,
        });
      } else if (action.type === 'pickup') {
        // A refused pickup (bag full, error) is skipped, not retried every tick.
        void this.handlePickup(client, action.dropId).then((refused) => {
          if (refused) s.auto = skipDrop(s.auto, action.dropId);
        });
      } else {
        void this.handleUseItem(client, action.itemId);
      }
    }

    /** Sends the automation status to the owner when it changed (or always, if forced). */
    private sendAuto(s: Session, force = false) {
      const key = s.auto.state + ':' + (s.auto.reason ?? '');
      if (!force && key === s.autoSent) return;
      s.autoSent = key;
      const status: AutoGrindStatus = { state: s.auto.state, config: s.auto.config };
      if (s.auto.reason) status.reason = s.auto.reason;
      this.clients.getById(s.sessionId)?.send(ServerMessage.AutoGrind, status);
    }

    /** Returns the rejection reason, or null once the pickup is granted. */
    private async handlePickup(client: MapClient, dropId: string) {
      const s = this.sessions.get(client.sessionId);
      if (!s) return null;
      const drop = this.drops.get(dropId);
      const reject = (reason: PickupRejectReason) => {
        client.send(ServerMessage.PickupRejected, { dropId, reason } satisfies PickupRejected);
        return reason;
      };
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
          rng,
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
        return null;
      }
      if (result === 'duplicate') return reject('not_found');
      // Not granted: put the drop back for this player (or someone else) to take later.
      if (now() < drop.expiresAt) this.addDrop(drop);
      return reject(result);
    }

    /**
     * Runs one item transaction for the client (one at a time per player), then refreshes
     * whatever it changed: worn equipment and stats, the enhance result, the inventory.
     */
    private async itemOp(
      client: MapClient,
      action: ItemAction,
      run: (
        s: Session,
      ) => Promise<{ ok: true } | EnhanceOutcome | { ok: false; reason: ItemRejectReason }>,
    ) {
      const s = this.sessions.get(client.sessionId);
      if (!s) return;
      const reject = (reason: ItemRejectReason) =>
        client.send(ServerMessage.ItemRejected, { action, reason } satisfies ItemRejected);
      if (s.itemPending) return reject('busy');
      s.itemPending = true;
      let result: Awaited<ReturnType<typeof run>>;
      try {
        result = await run(s);
      } catch (err) {
        console.error(`Item ${action} for ${s.characterId} failed`, err);
        s.itemPending = false;
        return reject('error');
      }
      if (!result.ok) {
        s.itemPending = false;
        return reject(result.reason);
      }
      // Committed: a refresh failure below must not be reported as "nothing changed".
      try {
        if ('row' in result) {
          client.send(ServerMessage.EnhanceResult, {
            kind: action === 'forge' ? 'forge' : 'imprint',
            instanceId: result.row.id,
            success: result.success,
            cost: result.cost,
            forgeLevel: result.row.forgeLevel,
            forgeAttempts: result.row.forgeAttempts,
            imprintTier: result.row.imprintTier,
            imprints: result.row.imprints as EnhanceResult['imprints'],
          } satisfies EnhanceResult);
        }
        if (!('row' in result) || result.worn) {
          s.equipment = await loadEquipped(db, s.characterId);
          refreshStats(s);
          this.sendStats(s);
        }
        await this.sendInventory(client, s.characterId);
      } catch (err) {
        console.error(`Refreshing after item ${action} for ${s.characterId} failed`, err);
      } finally {
        s.itemPending = false;
      }
    }

    private async handleUseItem(client: MapClient, itemId: string) {
      const s = this.sessions.get(client.sessionId);
      if (!s) return;
      const reject = (reason: ItemRejectReason) =>
        client.send(ServerMessage.ItemRejected, {
          action: 'useItem',
          reason,
        } satisfies ItemRejected);
      const t = now();
      if (s.dead) return reject('invalid_state');
      if (t < s.nextItemUseAt) return reject('cooldown');
      if (s.itemPending) return reject('busy');
      s.nextItemUseAt = t + ITEM_USE_COOLDOWN_MS;
      s.itemPending = true;
      try {
        const result = await useItem(db, s.characterId, itemId);
        if (!result.ok) return reject(result.reason);
        // A player who died while the transaction ran stays dead; the item is still spent.
        if (!s.dead) {
          s.hp = Math.min(s.stats.maxHp, s.hp + (result.restore.hp ?? 0));
          s.mp = Math.min(s.stats.maxMp, s.mp + (result.restore.mp ?? 0));
        }
        await this.sendInventory(client, s.characterId);
      } catch (err) {
        console.error(`Using ${itemId} for ${s.characterId} failed`, err);
        reject('error');
      } finally {
        s.itemPending = false;
      }
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
          this.sendStats(s);
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

    /** Stats, skill levels, skill points and buffs, to the owner. */
    private sendStats(s: Session) {
      const t = now();
      this.clients.getById(s.sessionId)?.send(ServerMessage.CharacterStats, {
        stats: s.stats,
        skillPoints: skillPoints(s.level, s.skills),
        skills: classSkills(s.classId, s.skills),
        buffs: [...s.buffs].map(([skillId, b]) => ({ skillId, remainingMs: b.until - t })),
      } satisfies CharacterStats);
    }

    private async sendInventory(client: MapClient, characterId: string) {
      try {
        const inventory = await loadInventory(db, characterId);
        const s = this.sessions.get(client.sessionId);
        if (s) {
          s.potions = new Map();
          for (const i of inventory.items) {
            if (!ITEMS[i.itemId]?.use) continue;
            s.potions.set(i.itemId, (s.potions.get(i.itemId) ?? 0) + i.quantity);
          }
        }
        client.send(ServerMessage.Inventory, inventory);
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
        // Automation spends the same step credits as client input, through the same stepBody,
        // so it can't move faster than real time or through collision.
        const auto = this.stepAutomation(s, t);
        while (s.credits >= 1 && (s.inputs.length > 0 || auto)) {
          const input = s.inputs.shift();
          const move = auto && (!input || isIdle(input)) ? auto : input!;
          // Dead players' inputs are acknowledged but don't move them.
          if (!s.dead) s.body = stepBody(s.body, move, this.map.geometry);
          if (input) s.lastSeq = input.seq;
          s.credits--;
        }
        const p = this.state.players.get(sessionId);
        if (p) this.syncPlayer(s, p);
      }
      this.tickMonsters(t, deltaMs);
      this.tickDrops(t);
      this.tickRegen(deltaMs);
      this.tickBuffs(t);
    }

    private tickBuffs(t: number) {
      for (const s of this.sessions.values()) if (expireBuffs(s, t)) this.sendStats(s);
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
      if (!hit.died) return;
      this.broadcast(ServerMessage.PlayerDied, { sessionId: s.sessionId });
      // Buffs end on death, as they do on leave.
      if (s.buffs.size > 0) {
        s.buffs.clear();
        refreshStats(s);
        this.sendStats(s);
      }
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
