import { describe, expect, it } from 'vitest';
import {
  addExp,
  attackBox,
  expToNext,
  hurtBox,
  rectsOverlap,
  rollDamage,
  rollDrops,
  seededRng,
  splitExp,
  statsForLevel,
} from './combat';
import type { DamageConfig, ExpCurve } from './rules';

const config: DamageConfig = {
  critMultiplier: 1.5,
  variance: { min: 0.9, max: 1.1 },
  defenseConstant: 100,
  minDamage: 1,
};
const fixed = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('rollDamage', () => {
  it('applies attack × multiplier × defense modifier × variance', () => {
    // no crit (0.99 >= 0.1), variance 0.9 + 0.5 * 0.2 = 1.0, defense 100 → ×0.5
    expect(rollDamage(100, 2, 0.1, 100, config, fixed(0.99, 0.5))).toEqual({
      damage: 100,
      crit: false,
    });
  });

  it('applies the critical modifier', () => {
    expect(rollDamage(100, 1, 0.1, 0, config, fixed(0.05, 0.5))).toEqual({
      damage: 150,
      crit: true,
    });
  });

  it('stays within variance bounds and never drops below the minimum', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 1000; i++) {
      const { damage } = rollDamage(50, 1, 0, 0, config, rng);
      expect(damage).toBeGreaterThanOrEqual(45);
      expect(damage).toBeLessThanOrEqual(55);
    }
    expect(rollDamage(1, 0.1, 0, 10_000, config, seededRng(1)).damage).toBe(1);
  });

  it('treats negative defense as zero', () => {
    expect(rollDamage(100, 1, 0, -500, config, fixed(0.99, 0.5)).damage).toBe(100);
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      const rng = seededRng(42);
      return Array.from({ length: 20 }, () => rollDamage(30, 1.4, 0.2, 10, config, rng));
    };
    expect(run()).toEqual(run());
  });
});

describe('progression', () => {
  const curve: ExpCurve = { base: 10, exponent: 1, maxLevel: 5 };

  it('grows stats per level', () => {
    const growth = {
      base: { maxHp: 50, maxMp: 10, attack: 10, defense: 5, critRate: 0.1 },
      perLevel: { maxHp: 10, maxMp: 2.5, attack: 3, defense: 1 },
    };
    expect(statsForLevel(growth, 1)).toEqual(growth.base);
    expect(statsForLevel(growth, 3)).toEqual({
      maxHp: 70,
      maxMp: 15,
      attack: 16,
      defense: 7,
      critRate: 0.1,
    });
  });

  it('computes the EXP requirement and caps at max level', () => {
    expect(expToNext(1, curve)).toBe(10);
    expect(expToNext(3, curve)).toBe(30);
    expect(expToNext(5, curve)).toBe(Infinity);
  });

  it('levels up, carrying EXP across several levels', () => {
    expect(addExp({ level: 1, exp: 5 }, 4, curve)).toEqual({ level: 1, exp: 9, levelsGained: 0 });
    expect(addExp({ level: 1, exp: 5 }, 5, curve)).toEqual({ level: 2, exp: 0, levelsGained: 1 });
    // 10 → L2, 20 → L3, 7 left over
    expect(addExp({ level: 1, exp: 0 }, 37, curve)).toEqual({ level: 3, exp: 7, levelsGained: 2 });
  });

  it('stops at max level and ignores negative gains', () => {
    expect(addExp({ level: 4, exp: 0 }, 1_000, curve)).toEqual({
      level: 5,
      exp: 0,
      levelsGained: 1,
    });
    expect(addExp({ level: 2, exp: 3 }, -50, curve)).toEqual({ level: 2, exp: 3, levelsGained: 0 });
  });

  it('splits EXP by damage share without exceeding the total', () => {
    const split = splitExp(
      10,
      new Map([
        ['a', 2],
        ['b', 1],
      ]),
    );
    expect(split).toEqual(
      new Map([
        ['a', 6],
        ['b', 3],
      ]),
    );
    expect(splitExp(10, new Map())).toEqual(new Map());
  });
});

describe('hitboxes', () => {
  const body = { x: 100, y: 200, vx: 0, vy: 0, grounded: true, climbing: false };
  const range = { width: 80, height: 60 };

  it('places the attack box in front of the player', () => {
    expect(attackBox(body, 1, range)).toEqual({ x: 100, y: 140, width: 80, height: 60 });
    expect(attackBox(body, -1, range)).toEqual({ x: 20, y: 140, width: 80, height: 60 });
  });

  it('hits targets in front and misses those behind or above', () => {
    const box = attackBox(body, 1, range);
    expect(rectsOverlap(box, hurtBox(170, 200, { width: 30, height: 30 }))).toBe(true);
    expect(rectsOverlap(box, hurtBox(60, 200, { width: 30, height: 30 }))).toBe(false);
    expect(rectsOverlap(box, hurtBox(150, 100, { width: 30, height: 30 }))).toBe(false);
  });
});

describe('rollDrops', () => {
  const table = {
    items: [
      { itemId: 'a', chance: 0.5, min: 1, max: 3 },
      { itemId: 'b', chance: 0.1, min: 1, max: 1 },
    ],
    currency: { chance: 0.7, min: 5, max: 9 },
  };

  it('drops each entry whose chance roll succeeds, with quantity in range', () => {
    // a: 0.2 < 0.5 → qty 1 + floor(0.99*3) = 3; b: 0.5 ≥ 0.1 → none; currency: 0.0 < 0.7 → 5
    expect(rollDrops(table, fixed(0.2, 0.99, 0.5, 0.0, 0.0))).toEqual([
      { itemId: 'a', quantity: 3 },
      { itemId: null, quantity: 5 },
    ]);
    expect(rollDrops(table, () => 0.99)).toEqual([]);
  });

  it('matches the configured rates over many rolls', () => {
    const rng = seededRng(3);
    let a = 0;
    for (let i = 0; i < 10_000; i++) if (rollDrops(table, rng).some((d) => d.itemId === 'a')) a++;
    expect(a / 10_000).toBeGreaterThan(0.47);
    expect(a / 10_000).toBeLessThan(0.53);
  });
});
