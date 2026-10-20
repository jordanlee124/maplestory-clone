import { CLASS_STATS } from '@cindervale/content';
import { statsForLevel, type Body, type Stats } from '@cindervale/game-core';
import type { InputMessage } from '@cindervale/protocol';

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
  stats: Stats;
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
}

export const statsFor = (classId: string, level: number) =>
  statsForLevel(CLASS_STATS[classId] ?? CLASS_STATS['ember-knight']!, level);

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
  },
  now = 0,
): Session {
  const stats = statsFor(c.classId, c.level);
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
    stats,
    hp,
    mp,
    dead: hp <= 0,
    deadAt: hp <= 0 ? now : 0,
    invulnUntil: 0,
    nextAttackAt: 0,
    cooldowns: new Map(),
    pickupPending: false,
  };
}

/** Applies a persisted level/EXP; a level-up recomputes stats and heals fully. */
export function applyProgress(s: Session, level: number, exp: number) {
  // Grants can resolve out of order; progress only ever moves forward.
  if (level < s.level || (level === s.level && exp < s.exp)) return false;
  const leveled = level > s.level;
  s.level = level;
  s.exp = exp;
  if (leveled) {
    s.stats = statsFor(s.classId, level);
    if (!s.dead) {
      s.hp = s.stats.maxHp;
      s.mp = s.stats.maxMp;
    }
  }
  return leveled;
}
