import { PROGRESSION } from '@cindervale/content';
import { accounts, characters, createDb } from '@cindervale/database';
import { startTestDatabase } from '@cindervale/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkLearn, computeStats, learnSkill, loadSkills, skillPoints } from './progression';

const SP = PROGRESSION.skillPointsPerLevel;

describe('skill rules', () => {
  it('earns skill points per level; an innate first level is free', () => {
    expect(skillPoints(1, new Map())).toBe(0);
    expect(skillPoints(3, new Map())).toBe(2 * SP);
    expect(skillPoints(3, new Map([['rune-burst', 3]]))).toBe(2 * SP - 2);
    expect(skillPoints(3, new Map([['runic-insight', 2]]))).toBe(2 * SP - 2);
  });

  it('checks class, target level, max level, required level, prerequisite and points', () => {
    const none = new Map<string, number>();
    const check = (level: number, learned: Map<string, number>, id: string, to: number) =>
      checkLearn('runewaver', level, learned, id, to);
    expect(check(10, none, 'nope', 1)).toBe('unknown_skill');
    expect(check(10, none, '__proto__', 1)).toBe('unknown_skill');
    expect(check(10, none, 'flame-cleave', 2)).toBe('wrong_class');
    expect(check(10, none, 'rune-burst', 3)).toBe('stale');
    expect(check(10, none, 'rune-burst', 1)).toBe('stale'); // innate: already 1
    expect(check(10, none, 'basic-attack', 2)).toBe('max_level');
    expect(check(99, new Map([['rune-burst', 10]]), 'rune-burst', 11)).toBe('max_level');
    expect(check(1, none, 'runic-insight', 1)).toBe('level_too_low');
    expect(check(10, none, 'glyph-lance', 1)).toBe('prerequisite');
    expect(check(10, new Map([['rune-burst', 3]]), 'glyph-lance', 1)).toBeNull();
    // Level 2 earns SP points; spend them all, then one more fails.
    expect(check(2, new Map([['runic-insight', SP]]), 'runic-insight', SP + 1)).toBe(
      'no_skill_points',
    );
    expect(check(2, none, 'runic-insight', 1)).toBeNull();
  });

  it('adds passive bonuses (and their effect on power) and buff bonuses', () => {
    const base = computeStats('runewaver', 5, new Map(), new Map());
    // runic-insight L2: int +5 → magic +2.5, maxMp +25, boss damage +0.06
    const passive = computeStats('runewaver', 5, new Map([['runic-insight', 2]]), new Map());
    expect(passive.int - base.int).toBe(5);
    expect(passive.maxMp - base.maxMp).toBe(25);
    expect(passive.bossDamage).toBeCloseTo(0.06);
    expect(passive.magic - base.magic).toBeGreaterThanOrEqual(2);
    const buffed = computeStats(
      'runewaver',
      5,
      new Map(),
      new Map([['mana-weave', { level: 1, until: 1 }]]),
    );
    expect(buffed.magic - base.magic).toBe(5);
  });
});

describe('learnSkill', () => {
  let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
  let conn: ReturnType<typeof createDb>;
  let n = 0;

  beforeAll(async () => {
    testDb = await startTestDatabase();
    conn = createDb(testDb.url);
  });
  afterAll(async () => {
    await conn.pool.end();
    await testDb.stop();
  });

  async function character(level: number) {
    const [a] = await conn.db
      .insert(accounts)
      .values({ username: `pg${++n}`, passwordHash: 'x' })
      .returning();
    const [c] = await conn.db
      .insert(characters)
      .values({
        accountId: a!.id,
        name: `Pg${n}`,
        classId: 'runewaver',
        mapId: 'm',
        x: 0,
        y: 0,
        level,
      })
      .returning();
    return c!.id;
  }

  it('raises innate and new skills and persists them', async () => {
    const id = await character(5);
    expect(await learnSkill(conn.db, id, 'rune-burst', 2)).toMatchObject({ ok: true });
    expect(await learnSkill(conn.db, id, 'runic-insight', 1)).toMatchObject({ ok: true });
    expect(await loadSkills(conn.db, id)).toEqual(
      new Map([
        ['rune-burst', 2],
        ['runic-insight', 1],
      ]),
    );
  });

  it('treats a resent request as stale instead of a second level', async () => {
    const id = await character(5);
    await learnSkill(conn.db, id, 'runic-insight', 1);
    expect(await learnSkill(conn.db, id, 'runic-insight', 1)).toEqual({
      ok: false,
      reason: 'stale',
    });
    expect((await loadSkills(conn.db, id)).get('runic-insight')).toBe(1);
  });

  it('stops at the available skill points', async () => {
    const id = await character(2);
    for (let lvl = 1; lvl <= SP; lvl++) {
      expect(await learnSkill(conn.db, id, 'runic-insight', lvl)).toMatchObject({ ok: true });
    }
    expect(await learnSkill(conn.db, id, 'runic-insight', SP + 1)).toEqual({
      ok: false,
      reason: 'no_skill_points',
    });
  });

  // PGlite serializes on one connection, so this can't catch a missing FOR UPDATE; it checks
  // the retry semantics. Real Postgres relies on the row lock for the same result.
  it('applies one level when the same request races', async () => {
    const id = await character(5);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => learnSkill(conn.db, id, 'runic-insight', 1)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.reason === 'stale')).toBe(true);
    expect((await loadSkills(conn.db, id)).get('runic-insight')).toBe(1);
  });
});
