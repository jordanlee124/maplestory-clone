import { PHYSICS, type Body } from './index';
import type {
  ClassScaling,
  DamageConfig,
  ExpCurve,
  Rect,
  Rng,
  StatBonus,
  StatFormula,
  Stats,
} from './rules';

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

/** The attacking side of a damage roll; monsters use 0 for the stats they lack. */
export interface Attacker {
  /** Attack or magic, whichever the attacker's class uses. */
  power: number;
  critRate: number;
  critDamage: number;
  bossDamage: number;
  ignoreDefense: number;
}

export interface Defender {
  defense: number;
  boss?: boolean;
}

/**
 * Damage = Power × SkillMultiplier × (1 + CritDamage on a crit) × (1 + BossDamage vs bosses)
 *        × k / (k + Defense × (1 − IgnoreDefense)) × RandomVariance,
 * rounded down, at least `minDamage`. Consumes exactly two rng values (crit, variance).
 */
export function rollDamage(
  a: Attacker,
  multiplier: number,
  target: Defender,
  config: DamageConfig,
  rng: Rng,
): DamageRoll {
  const crit = rng() < a.critRate;
  const critMod = crit ? 1 + a.critDamage : 1;
  const bossMod = target.boss ? 1 + a.bossDamage : 1;
  const defense = Math.max(0, target.defense) * (1 - a.ignoreDefense);
  const defenseMod = config.defenseConstant / (config.defenseConstant + defense);
  const { min, max } = config.variance;
  const variance = min + rng() * (max - min);
  const raw = a.power * multiplier * critMod * bossMod * defenseMod * variance;
  return { damage: Math.max(config.minDamage, Math.floor(raw)), crit };
}

const INTEGER_STATS = ['str', 'dex', 'int', 'luk', 'maxHp', 'maxMp', 'attack', 'magic', 'defense'];
const RATE_STATS = ['critRate', 'ignoreDefense'] as const;

/**
 * A class's stats at `level`: base + perLevel × (level − 1) + bonuses, then the class's
 * primary/secondary stats add to attack (physical) or magic. Bonuses to primary stats
 * therefore raise power too.
 */
export function deriveStats(
  cls: ClassScaling,
  formula: StatFormula,
  level: number,
  bonuses: readonly StatBonus[] = [],
): Stats {
  const s = { ...cls.base };
  const keys = Object.keys(s) as (keyof Stats)[];
  for (const k of keys) {
    s[k] += (cls.perLevel[k] ?? 0) * (level - 1);
    for (const b of bonuses) s[k] += b[k] ?? 0;
  }
  const power =
    s[cls.primary] * formula.powerPerPrimary + s[cls.secondary] * formula.powerPerSecondary;
  s[cls.damageType === 'magic' ? 'magic' : 'attack'] += power;
  for (const k of INTEGER_STATS) s[k as keyof Stats] = Math.floor(s[k as keyof Stats]);
  for (const k of RATE_STATS) s[k] = Math.min(1, Math.max(0, s[k]));
  return s;
}

/** The stats a player's hits use. */
export const attackerOf = (s: Stats, damageType: ClassScaling['damageType']): Attacker => ({
  power: damageType === 'magic' ? s.magic : s.attack,
  critRate: s.critRate,
  critDamage: s.critDamage,
  bossDamage: s.bossDamage,
  ignoreDefense: s.ignoreDefense,
});

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
