// Typed, validated, versioned contracts between web client, API, and game server.
// See docs/protocols/NETWORK_PROTOCOL.md. Bump PROTOCOL_VERSION on any breaking change.
import { CLASS_IDS, type Stats } from '@cindervale/content';
import { z } from 'zod';

export const PROTOCOL_VERSION = 3;

// ---- HTTP API ----

export const Credentials = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{3,16}$/, '3-16 letters, digits or _'),
  password: z.string().min(8).max(128),
});
export type Credentials = z.infer<typeof Credentials>;

export const AuthResponse = z.object({ token: z.string() });
export type AuthResponse = z.infer<typeof AuthResponse>;

export const CreateCharacter = z.object({
  name: z.string().regex(/^[a-zA-Z0-9]{3,12}$/, '3-12 letters or digits'),
  classId: z.enum(CLASS_IDS),
});
export type CreateCharacter = z.infer<typeof CreateCharacter>;

export const CharacterSummary = z.object({
  id: z.uuid(),
  name: z.string(),
  classId: z.enum(CLASS_IDS),
  level: z.number().int(),
  mapId: z.string(),
});
export type CharacterSummary = z.infer<typeof CharacterSummary>;

// ---- Game server (Colyseus) ----

export const ROOM_MAP = 'map';

export const JoinOptions = z.object({
  characterId: z.uuid(),
  /** The character's current map; rooms are matched per map. */
  mapId: z.string().min(1),
  protocolVersion: z.literal(PROTOCOL_VERSION),
});
export type JoinOptions = z.infer<typeof JoinOptions>;

export const ClientMessage = {
  Input: 'input',
  Attack: 'attack',
  Pickup: 'pickup',
  Respawn: 'respawn',
  LearnSkill: 'learnSkill',
} as const;

/** One fixed simulation step of input. `seq` increases by 1 per step. */
export const InputMessage = z.object({
  seq: z
    .number()
    .int()
    .nonnegative()
    .max(2 ** 31 - 1), // synced back as int32 lastSeq
  left: z.boolean(),
  right: z.boolean(),
  up: z.boolean(),
  down: z.boolean(),
  jump: z.boolean(),
});
export type InputMessage = z.infer<typeof InputMessage>;

/** Synced per-player state (mirrors the server's Colyseus schema). */
export interface PlayerView {
  characterId: string;
  name: string;
  classId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  climbing: boolean;
  /** Last input seq the server applied; used for client reconciliation. */
  lastSeq: number;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  dead: boolean;
}

// ---- Combat, progression, loot (v3) ----

const int32 = z
  .number()
  .int()
  .nonnegative()
  .max(2 ** 31 - 1);

/** Ask to use a skill. The server decides hits and damage from its own state. */
export const AttackRequest = z.object({
  /** Client-chosen id echoed back in the result/rejection. */
  requestId: int32,
  skillId: z.string().min(1).max(64),
  facing: z.enum(['left', 'right']),
});
export type AttackRequest = z.infer<typeof AttackRequest>;

export const PickupRequest = z.object({ dropId: z.string().min(1).max(64) });
export type PickupRequest = z.infer<typeof PickupRequest>;

/** Respawn after death; no payload. */
export const RespawnRequest = z.object({}).strict();

/**
 * Spend one skill point raising `skillId` to `level` (its current level + 1). Naming the target
 * level makes a resent request a no-op instead of a second level.
 */
export const LearnSkillRequest = z.object({
  skillId: z.string().min(1).max(64),
  level: z.number().int().min(1).max(100),
});
export type LearnSkillRequest = z.infer<typeof LearnSkillRequest>;

export const ServerMessage = {
  AttackResult: 'attackResult',
  AttackRejected: 'attackRejected',
  PlayerHit: 'playerHit',
  PlayerDied: 'playerDied',
  PlayerRespawned: 'playerRespawned',
  MonsterKilled: 'monsterKilled',
  LootSpawned: 'lootSpawned',
  ItemPickedUp: 'itemPickedUp',
  PickupRejected: 'pickupRejected',
  ExpGained: 'expGained',
  LevelUp: 'levelUp',
  Inventory: 'inventory',
  CharacterStats: 'characterStats',
  SkillRejected: 'skillRejected',
} as const;

export type AttackRejectReason =
  | 'unknown_skill'
  | 'skill_not_owned'
  | 'invalid_state'
  | 'too_fast'
  | 'cooldown'
  | 'insufficient_mp'
  /** Passive skills can't be used. */
  | 'not_usable';

export type SkillRejectReason =
  | 'unknown_skill'
  | 'wrong_class'
  | 'level_too_low'
  | 'prerequisite'
  | 'max_level'
  | 'no_skill_points'
  /** `level` isn't current + 1 (usually a resent request). */
  | 'stale'
  | 'busy'
  | 'error';

export type PickupRejectReason =
  'not_found' | 'invalid_state' | 'out_of_range' | 'not_owner' | 'inventory_full' | 'error';

/** Broadcast. Damage numbers for everyone to render. */
export interface AttackResult {
  sessionId: string;
  requestId: number;
  skillId: string;
  facing: 'left' | 'right';
  hits: { monsterId: string; damage: number; crit: boolean; killed: boolean }[];
}
/** To the attacker only. */
export interface AttackRejected {
  requestId: number;
  reason: AttackRejectReason;
}
/** Broadcast. */
export interface PlayerHit {
  sessionId: string;
  monsterId: string;
  damage: number;
  hp: number;
}
export interface PlayerDied {
  sessionId: string;
}
export interface PlayerRespawned {
  sessionId: string;
}
export interface MonsterKilled {
  monsterId: string;
  /** May be '' if the killer left. */
  killerSessionId: string;
}
export interface LootSpawned {
  drops: DropView[];
}
export interface ItemPickedUp {
  sessionId: string;
  dropId: string;
  itemId: string | null;
  quantity: number;
}
/** To the requester only. */
export interface PickupRejected {
  dropId: string;
  reason: PickupRejectReason;
}
/** To the earner only. */
export interface ExpGained {
  amount: number;
  level: number;
  exp: number;
  expToNext: number;
}
/** Broadcast. */
export interface LevelUp {
  sessionId: string;
  level: number;
}
/** To the owner only: sent on join and after every change. */
export interface Inventory {
  currency: number;
  capacity: number;
  items: { slot: number; itemId: string; quantity: number }[];
}

/**
 * To the owner only: sent on join/reconnect and whenever stats, skills or buffs change.
 * `skills` lists effective levels (innate skills report at least 1).
 */
export interface CharacterStats {
  stats: Stats;
  skillPoints: number;
  skills: { skillId: string; level: number }[];
  buffs: { skillId: string; remainingMs: number }[];
}
/** To the requester only. */
export interface SkillRejected {
  skillId: string;
  reason: SkillRejectReason;
}

/** Synced monster state (MapState.monsters, keyed by monster id). */
export interface MonsterView {
  monsterId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mode: string;
  facing: number;
}

/** Synced drop state (MapState.drops, keyed by drop id). itemId '' means currency. */
export interface DropView {
  dropId: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  /** Character id that may pick it up now; '' once anyone may. */
  ownerId: string;
}
