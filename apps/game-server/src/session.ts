import type { Body, Stats } from '@cindervale/game-core';
import type { AutoGrindConfig, InputMessage } from '@cindervale/protocol';
import { DEFAULT_AUTO_CONFIG, disabledAuto, type AutoGrind } from './autogrind';
import { equipmentBonuses, type EquipInstance } from './equipment';
import { computeStats } from './progression';

/** Everything the server knows about one connected player. Never trusted from the client. */
export interface Session {
  sessionId: string;
  characterId: string;
  classId: string;
  // Movement
  body: Body;
  inputs: InputMessage[];
  lastQueuedSeq: number;
  lastSeq: number;
  credits: number;
  /** Last facing chosen for an attack, or from movement. */
  facing: 1 | -1;
  // Progression
  level: number;
  exp: number;
  /** Learned skill levels, mirrored from the database. */
  skills: Map<string, number>;
  buffs: Map<string, { level: number; until: number }>;
  /** Worn equipment, mirrored from the database. */
  equipment: EquipInstance[];
  /** Class, level, passives and buffs combined; recompute with refreshStats. */
  stats: Stats;
  /** One skill-learn transaction at a time per player. */
  learnPending: boolean;
  /** One item transaction (equip, forge, imprint, use) at a time per player. */
  itemPending: boolean;
  nextItemUseAt: number;
  // Combat
  hp: number;
  mp: number;
  dead: boolean;
  deadAt: number;
  invulnUntil: number;
  nextAttackAt: number;
  cooldowns: Map<string, number>;
  /** One pickup transaction at a time per player. */
  pickupPending: boolean;
  // Automation
  auto: AutoGrind;
  /** Consumables held (item id → count), refreshed with every inventory snapshot. */
  potions: Map<string, number>;
  /** Request ids for automated attacks, kept apart from client ids (which start at 0). */
  autoRequestId: number;
  /** Last automation status sent to the owner, to send only changes. */
  autoSent: string;
}

/** Recomputes stats after a level, skill or buff change; vitals are capped, not healed. */
export function refreshStats(s: Session) {
  s.stats = computeStats(s.classId, s.level, s.skills, s.buffs, equipmentBonuses(s.equipment));
  s.hp = Math.min(s.hp, s.stats.maxHp);
  s.mp = Math.min(s.mp, s.stats.maxMp);
}

export function createSession(
  sessionId: string,
  c: {
    id: string;
    classId: string;
    x: number;
    y: number;
    level: number;
    exp: number;
    hp?: number | null;
    mp?: number | null;
    skills?: ReadonlyMap<string, number>;
    equipment?: readonly EquipInstance[];
    autoConfig?: AutoGrindConfig;
  },
  now = 0,
): Session {
  const skills = new Map(c.skills);
  const equipment = [...(c.equipment ?? [])];
  const stats = computeStats(c.classId, c.level, skills, new Map(), equipmentBonuses(equipment));
  // Vitals carry over from the last session (null = never saved = full), so leaving and
  // rejoining can't heal; a character that left dead comes back dead.
  const hp = Math.min(c.hp ?? stats.maxHp, stats.maxHp);
  const mp = Math.min(c.mp ?? stats.maxMp, stats.maxMp);
  return {
    sessionId,
    characterId: c.id,
    classId: c.classId,
    body: { x: c.x, y: c.y, vx: 0, vy: 0, grounded: false, climbing: false },
    inputs: [],
    lastQueuedSeq: -1,
    lastSeq: -1,
    credits: 0,
    facing: 1,
    level: c.level,
    exp: c.exp,
    skills,
    buffs: new Map(),
    equipment,
    stats,
    learnPending: false,
    itemPending: false,
    nextItemUseAt: 0,
    hp,
    mp,
    dead: hp <= 0,
    deadAt: hp <= 0 ? now : 0,
    invulnUntil: 0,
    nextAttackAt: 0,
    cooldowns: new Map(),
    pickupPending: false,
    auto: disabledAuto(c.autoConfig ?? DEFAULT_AUTO_CONFIG),
    potions: new Map(),
    autoRequestId: 2 ** 30,
    autoSent: '',
  };
}

/** Drops buffs that ended by `now`; true if any did (stats are then recomputed). */
export function expireBuffs(s: Session, now: number) {
  let expired = false;
  for (const [id, b] of s.buffs) {
    if (now < b.until) continue;
    s.buffs.delete(id);
    expired = true;
  }
  if (expired) refreshStats(s);
  return expired;
}

/** Applies a persisted level/EXP; a level-up recomputes stats and heals fully. */
export function applyProgress(s: Session, level: number, exp: number) {
  // Grants can resolve out of order; progress only ever moves forward.
  if (level < s.level || (level === s.level && exp < s.exp)) return false;
  const leveled = level > s.level;
  s.level = level;
  s.exp = exp;
  if (leveled) {
    refreshStats(s);
    if (!s.dead) {
      s.hp = s.stats.maxHp;
      s.mp = s.stats.maxMp;
    }
  }
  return leveled;
}
