import { PHYSICS, type Body } from './index';
import type { DamageConfig, ExpCurve, Rect, Rng, Stats } from './rules';

/** Small, fast, seedable PRNG (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DamageRoll {
  damage: number;
  crit: boolean;
}

/**
 * Damage = AttackPower × SkillMultiplier × CriticalModifier × DefenseModifier × RandomVariance,
 * rounded down, at least `minDamage`. Consumes exactly two rng values (crit, variance).
 */
export function rollDamage(
  attack: number,
  multiplier: number,
  critRate: number,
  defense: number,
  config: DamageConfig,
  rng: Rng,
): DamageRoll {
  const crit = rng() < critRate;
  const critMod = crit ? config.critMultiplier : 1;
  const defenseMod = config.defenseConstant / (config.defenseConstant + Math.max(0, defense));
  const { min, max } = config.variance;
  const variance = min + rng() * (max - min);
  const raw = attack * multiplier * critMod * defenseMod * variance;
  return { damage: Math.max(config.minDamage, Math.floor(raw)), crit };
}

export interface StatGrowth {
  base: Stats;
  /** Added per level above 1 (critRate is not scaled). */
  perLevel: Omit<Stats, 'critRate'>;
}

export function statsForLevel({ base, perLevel }: StatGrowth, level: number): Stats {
  const n = level - 1;
  return {
    maxHp: Math.floor(base.maxHp + perLevel.maxHp * n),
    maxMp: Math.floor(base.maxMp + perLevel.maxMp * n),
    attack: Math.floor(base.attack + perLevel.attack * n),
    defense: Math.floor(base.defense + perLevel.defense * n),
    critRate: base.critRate,
  };
}

/** EXP needed to advance from `level` to `level + 1`; Infinity at the cap. */
export function expToNext(level: number, curve: ExpCurve): number {
  if (level >= curve.maxLevel) return Infinity;
  return Math.floor(curve.base * level ** curve.exponent);
}

export interface Progress {
  level: number;
  exp: number;
}

/** Adds EXP, carrying over across as many levels as it covers. EXP is dropped at max level. */
export function addExp(
  p: Progress,
  gain: number,
  curve: ExpCurve,
): Progress & { levelsGained: number } {
  let { level, exp } = p;
  exp += Math.max(0, Math.floor(gain));
  let levelsGained = 0;
  while (level < curve.maxLevel && exp >= expToNext(level, curve)) {
    exp -= expToNext(level, curve);
    level++;
    levelsGained++;
  }
  if (level >= curve.maxLevel) exp = 0;
  return { level, exp, levelsGained };
}

/** Splits `total` EXP by damage share (floored), so the sum never exceeds `total`. */
export function splitExp(
  total: number,
  damageBy: ReadonlyMap<string, number>,
): Map<string, number> {
  const dealt = [...damageBy.values()].reduce((a, b) => a + b, 0);
  const out = new Map<string, number>();
  if (dealt <= 0) return out;
  for (const [id, dmg] of damageBy) out.set(id, Math.floor((total * dmg) / dealt));
  return out;
}

export const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** A skill's hit area: in front of the player, from the body's centre, feet-aligned. */
export function attackBox(
  body: Body,
  facing: 1 | -1,
  range: { width: number; height: number },
): Rect {
  return {
    x: facing === 1 ? body.x : body.x - range.width,
    y: body.y - range.height,
    width: range.width,
    height: range.height,
  };
}

/** A body's hurt box from its feet position (players use the physics body size). */
export function hurtBox(
  x: number,
  y: number,
  size: { width: number; height: number } = {
    width: PHYSICS.bodyWidth,
    height: PHYSICS.bodyHeight,
  },
): Rect {
  return { x: x - size.width / 2, y: y - size.height, width: size.width, height: size.height };
}

export interface DropTableLike {
  items: readonly { itemId: string; chance: number; min: number; max: number }[];
  currency: { chance: number; min: number; max: number };
}

/** One rolled drop; itemId null means currency. */
export interface RolledDrop {
  itemId: string | null;
  quantity: number;
}

/** Rolls each entry independently: chance, then a uniform quantity in [min, max]. */
export function rollDrops(table: DropTableLike, rng: Rng): RolledDrop[] {
  const qty = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const drops: RolledDrop[] = [];
  for (const e of table.items) {
    if (rng() < e.chance) drops.push({ itemId: e.itemId, quantity: qty(e.min, e.max) });
  }
  const c = table.currency;
  if (rng() < c.chance) drops.push({ itemId: null, quantity: qty(c.min, c.max) });
  return drops;
}
