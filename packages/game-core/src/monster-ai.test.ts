import { describe, expect, it } from 'vitest';
import {
  aggroMonster,
  killMonster,
  spawnMonsterAi,
  stepMonsterAi,
  type AiContext,
  type AiTarget,
  type MonsterAi,
} from './monster-ai';
import type { MonsterBehavior, Rng } from './rules';

const b: MonsterBehavior = {
  speed: 60,
  aggroRange: 150,
  attackRange: 40,
  attackCooldownMs: 1000,
  patrolRange: 100,
  leashRange: 300,
  respawnMs: 5000,
  idleMs: [1000, 2000],
};
const passive: MonsterBehavior = { ...b, aggroRange: 0 };

function mulberry32(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ctx = (over: Partial<AiContext> = {}): AiContext => ({
  now: 0,
  dtMs: 1000,
  spawnX: 500,
  y: 300,
  bounds: { min: 0, max: 1000 },
  players: [],
  rng: () => 0.5,
  ...over,
});
const player = (x: number, over: Partial<AiTarget> = {}): AiTarget => ({
  id: 'p1',
  x,
  y: 300,
  alive: true,
  ...over,
});
const base = (over: Partial<MonsterAi> = {}): MonsterAi => ({
  mode: 'idle',
  x: 500,
  facing: 1,
  targetId: null,
  until: 1000,
  patrolX: 500,
  nextAttackAt: 0,
  ...over,
});

describe('monster ai', () => {
  it('spawns idle at spawnX with an idle duration from idleMs', () => {
    expect(spawnMonsterAi(500, 100, b, () => 0.5)).toEqual(base({ until: 1600 }));
  });

  it('idles until `until`, then patrols to a clamped point', () => {
    expect(stepMonsterAi(base(), b, ctx({ now: 999 })).ai.mode).toBe('idle');
    const { ai } = stepMonsterAi(base(), b, ctx({ now: 1000, rng: () => 0.75 }));
    expect(ai).toMatchObject({ mode: 'patrol', patrolX: 550, x: 500 });
    const edge = stepMonsterAi(
      base(),
      b,
      ctx({ now: 1000, rng: () => 0, bounds: { min: 450, max: 1000 } }),
    );
    expect(edge.ai.patrolX).toBe(450);
  });

  it('patrols at speed without overshooting, then idles on arrival', () => {
    const patrol = base({ mode: 'patrol', patrolX: 420 });
    const a = stepMonsterAi(patrol, b, ctx({ now: 5000 })).ai;
    expect(a).toMatchObject({ mode: 'patrol', x: 440, facing: -1 });
    const c = stepMonsterAi(a, b, ctx({ now: 6000, rng: () => 0.5 })).ai;
    expect(c).toMatchObject({ mode: 'idle', x: 420, facing: -1, until: 7500 });
  });

  it('detects the nearest alive player within range and starts chasing', () => {
    const players = [
      player(620, { id: 'far' }),
      player(560, { id: 'dead', alive: false }),
      player(590, { id: 'near' }),
      player(510, { id: 'high', y: 200 }),
    ];
    const { ai } = stepMonsterAi(base(), b, ctx({ players }));
    expect(ai).toMatchObject({ mode: 'chase', targetId: 'near', facing: 1 });
  });

  it('passive monsters never detect, but chase when hit', () => {
    const c = ctx({ players: [player(510)] });
    expect(stepMonsterAi(base(), passive, c).ai.mode).toBe('idle');
    const hit = aggroMonster(base(), 'p1');
    expect(hit).toMatchObject({ mode: 'chase', targetId: 'p1' });
    expect(stepMonsterAi(hit, passive, c).ai.mode).toBe('chase');
  });

  it('stops at attack range, attacks, and respects the cooldown', () => {
    const chase = base({ mode: 'chase', targetId: 'p1' });
    const players = [player(560)];
    const r1 = stepMonsterAi(chase, b, ctx({ now: 0, dtMs: 1000, players }));
    expect(r1.ai.x).toBe(528); // 560 - 40 * 0.8
    expect(r1.attackTargetId).toBe('p1');
    expect(r1.ai.nextAttackAt).toBe(1000);
    const r2 = stepMonsterAi(r1.ai, b, ctx({ now: 500, players }));
    expect(r2.attackTargetId).toBeUndefined();
    expect(r2.ai.x).toBe(528);
    expect(stepMonsterAi(r2.ai, b, ctx({ now: 1000, players })).attackTargetId).toBe('p1');
  });

  it('does not attack across a large height gap', () => {
    const chase = base({ mode: 'chase', targetId: 'p1', x: 530 });
    const r = stepMonsterAi(chase, b, ctx({ players: [player(560, { y: 250 })] }));
    expect(r.attackTargetId).toBeUndefined();
    expect(r.ai.mode).toBe('chase');
  });

  it('leashes back home, heals on arrival, and ignores hits while returning', () => {
    const far = base({ mode: 'chase', targetId: 'p1', x: 801, facing: 1 });
    const r1 = stepMonsterAi(far, b, ctx({ players: [player(900)] }));
    expect(r1.ai).toMatchObject({ mode: 'return', targetId: null, x: 741, facing: -1 });
    // Ignoring hits on the way home defeats safe-spotting: it always gets home to heal.
    expect(aggroMonster(r1.ai, 'p2')).toBe(r1.ai);

    // Players next to it are ignored while returning.
    const near = ctx({ dtMs: 2000, players: [player(700)] });
    let ai = r1.ai;
    let home = false;
    for (let now = 1000; !home && now < 20000; now += 2000) {
      const r = stepMonsterAi(ai, b, { ...near, now });
      ai = r.ai;
      home = !!r.returnedHome;
      if (!home) expect(ai.mode).toBe('return');
    }
    expect(ai).toMatchObject({ mode: 'idle', x: 500 });
  });

  it('returns when the target dies or disappears', () => {
    const chase = base({ mode: 'chase', targetId: 'p1', x: 600 });
    expect(stepMonsterAi(chase, b, ctx({ players: [player(650, { alive: false })] })).ai.mode).toBe(
      'return',
    );
    expect(stepMonsterAi(chase, b, ctx()).ai.mode).toBe('return');
  });

  it('dies, ignores hits, and respawns idle at spawnX', () => {
    const dead = killMonster(base({ mode: 'chase', targetId: 'p1', x: 700, facing: -1 }), 0, b);
    expect(dead).toMatchObject({ mode: 'dead', until: 5000, targetId: null });
    expect(aggroMonster(dead, 'p1')).toBe(dead);
    const c = ctx({ players: [player(700)] });
    expect(stepMonsterAi(dead, b, { ...c, now: 4999 })).toEqual({ ai: dead });
    const r = stepMonsterAi(dead, b, { ...c, now: 5000 });
    expect(r.respawned).toBe(true);
    expect(r.ai).toEqual(base({ until: 6500 }));
  });

  it('keeps x within bounds while chasing', () => {
    const chase = base({ mode: 'chase', targetId: 'p1', x: 990 });
    // Target just past the edge (within attack range): chase up to the edge, no further.
    const r = stepMonsterAi(chase, b, ctx({ spawnX: 900, dtMs: 1000, players: [player(1039)] }));
    expect(r.ai.x).toBe(1000);
    expect(r.ai.mode).toBe('chase');
  });

  it('gives up on a target it cannot reach beyond the platform edge', () => {
    const chase = base({ mode: 'chase', targetId: 'p1', x: 990 });
    const r = stepMonsterAi(chase, b, ctx({ spawnX: 900, players: [player(1100)] }));
    expect(r.ai).toMatchObject({ mode: 'return', targetId: null });
  });

  it('is deterministic for a seeded rng and never mutates its input', () => {
    const run = () => {
      const rng = mulberry32(42);
      let ai = spawnMonsterAi(500, 0, b, rng);
      const trace: number[] = [];
      for (let now = 0; now < 30000; now += 100) {
        const before = JSON.stringify(ai);
        const next = stepMonsterAi(ai, b, ctx({ now, dtMs: 100, rng })).ai;
        expect(JSON.stringify(ai)).toBe(before);
        ai = next;
        trace.push(ai.x);
      }
      return trace;
    };
    const a = run();
    expect(a).toEqual(run());
    expect(new Set(a).size).toBeGreaterThan(1);
  });

  it('heals at once when hit at home by a player it cannot reach', () => {
    // Idle at home, hit by a player standing below its platform edge.
    const hit = aggroMonster(base({ mode: 'idle', x: 500 }), 'p1');
    const r = stepMonsterAi(hit, b, ctx({ spawnX: 500, players: [player(1200)] }));
    expect(r).toMatchObject({ ai: { mode: 'idle', x: 500 }, returnedHome: true });
  });
});
