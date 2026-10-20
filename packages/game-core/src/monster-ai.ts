// Monster AI state machine. Pure: time comes in as `now`, randomness through the injected rng.
import type { MonsterBehavior, Rng } from './rules';

export type MonsterMode = 'idle' | 'patrol' | 'chase' | 'return' | 'dead';

export interface MonsterAi {
  mode: MonsterMode;
  /** y never changes: monsters stay on their spawn platform. */
  x: number;
  facing: 1 | -1;
  targetId: string | null;
  /** idle: when to start patrolling. dead: when to respawn. */
  until: number;
  patrolX: number;
  nextAttackAt: number;
}

export interface AiTarget {
  id: string;
  x: number;
  y: number;
  alive: boolean;
}

export interface AiContext {
  /** ms */
  now: number;
  /** ms since last step */
  dtMs: number;
  spawnX: number;
  /** The monster's (platform) y. */
  y: number;
  /** Walkable x range on its platform. */
  bounds: { min: number; max: number };
  players: readonly AiTarget[];
  rng: Rng;
}

export interface AiResult {
  ai: MonsterAi;
  /** Set when the monster attacks this step; the server resolves damage. */
  attackTargetId?: string;
  /** True on the step the monster arrives home from 'return' (server heals it). */
  returnedHome?: boolean;
  /** True on the step a dead monster respawns (server resets HP). */
  respawned?: boolean;
}

const DETECT_DY = 60;
const LOSE_DY = 200;
const ATTACK_DY = 40;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const idleUntil = (now: number, b: MonsterBehavior, rng: Rng) =>
  now + b.idleMs[0] + rng() * (b.idleMs[1] - b.idleMs[0]);

/** Moves toward `to` without overshooting; keeps the previous facing when it does not move. */
function moveToward(ai: MonsterAi, to: number, b: MonsterBehavior, ctx: AiContext): MonsterAi {
  const dx = to - ai.x;
  const step = Math.sign(dx) * Math.min(Math.abs(dx), (b.speed * ctx.dtMs) / 1000);
  const x = clamp(ai.x + step, ctx.bounds.min, ctx.bounds.max);
  return { ...ai, x, facing: x > ai.x ? 1 : x < ai.x ? -1 : ai.facing };
}

export function spawnMonsterAi(
  spawnX: number,
  now: number,
  b: MonsterBehavior,
  rng: Rng,
): MonsterAi {
  return {
    mode: 'idle',
    x: spawnX,
    facing: 1,
    targetId: null,
    until: idleUntil(now, b, rng),
    patrolX: spawnX,
    nextAttackAt: 0,
  };
}

export function stepMonsterAi(ai: MonsterAi, b: MonsterBehavior, ctx: AiContext): AiResult {
  const { now } = ctx;
  switch (ai.mode) {
    case 'dead':
      if (now < ai.until) return { ai };
      return { ai: spawnMonsterAi(ctx.spawnX, now, b, ctx.rng), respawned: true };

    case 'return': {
      const moved = moveToward(ai, ctx.spawnX, b, ctx);
      if (Math.abs(moved.x - ctx.spawnX) > 1) return { ai: moved };
      const until = idleUntil(now, b, ctx.rng);
      return { ai: { ...moved, x: ctx.spawnX, mode: 'idle', until }, returnedHome: true };
    }

    case 'chase': {
      const t = ctx.players.find((p) => p.id === ai.targetId);
      if (
        !t ||
        !t.alive ||
        Math.abs(t.y - ctx.y) > LOSE_DY ||
        Math.abs(ai.x - ctx.spawnX) > b.leashRange ||
        // Out of reach beyond the platform edge (e.g. standing on the ground below).
        t.x < ctx.bounds.min - b.attackRange ||
        t.x > ctx.bounds.max + b.attackRange
      ) {
        return stepMonsterAi({ ...ai, mode: 'return', targetId: null }, b, ctx);
      }
      const stopAt = b.attackRange * 0.8;
      const side = Math.sign(ai.x - t.x) || -ai.facing;
      let next = Math.abs(t.x - ai.x) > stopAt ? moveToward(ai, t.x + side * stopAt, b, ctx) : ai;
      if (t.x !== next.x) next = { ...next, facing: t.x > next.x ? 1 : -1 };
      const canHit =
        Math.abs(t.x - next.x) <= b.attackRange &&
        Math.abs(t.y - ctx.y) <= ATTACK_DY &&
        now >= next.nextAttackAt;
      if (!canHit) return { ai: next };
      return { ai: { ...next, nextAttackAt: now + b.attackCooldownMs }, attackTargetId: t.id };
    }

    case 'idle':
    case 'patrol': {
      const seen = detect(ai, b, ctx);
      if (seen) return stepMonsterAi({ ...ai, mode: 'chase', targetId: seen.id }, b, ctx);
      if (ai.mode === 'idle') {
        if (now < ai.until) return { ai };
        const patrolX = clamp(
          ctx.spawnX + (ctx.rng() * 2 - 1) * b.patrolRange,
          ctx.bounds.min,
          ctx.bounds.max,
        );
        return { ai: { ...ai, mode: 'patrol', patrolX } };
      }
      const moved = moveToward(ai, ai.patrolX, b, ctx);
      if (moved.x !== ai.patrolX) return { ai: moved };
      return { ai: { ...moved, mode: 'idle', until: idleUntil(now, b, ctx.rng) } };
    }
  }
}

function detect(ai: MonsterAi, b: MonsterBehavior, ctx: AiContext): AiTarget | undefined {
  if (b.aggroRange <= 0) return undefined;
  let best: AiTarget | undefined;
  for (const p of ctx.players) {
    const d = Math.abs(p.x - ai.x);
    if (!p.alive || d > b.aggroRange || Math.abs(p.y - ctx.y) > DETECT_DY) continue;
    if (!best || d < Math.abs(best.x - ai.x)) best = p;
  }
  return best;
}

/**
 * Called by the server when a player damages the monster: target that player. Dead and
 * homeward-bound monsters ignore it; otherwise a player out of its reach could keep hitting
 * a monster that never gets home to heal (safe-spotting).
 */
export function aggroMonster(ai: MonsterAi, playerId: string): MonsterAi {
  return ai.mode === 'dead' || ai.mode === 'return'
    ? ai
    : { ...ai, mode: 'chase', targetId: playerId };
}

/** Called by the server when HP reaches 0. */
export function killMonster(ai: MonsterAi, now: number, b: MonsterBehavior): MonsterAi {
  return { ...ai, mode: 'dead', until: now + b.respawnMs, targetId: null };
}
