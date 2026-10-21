// Shared rule types. Values live in @cindervale/content; logic lives in this package.

export const PRIMARY_STATS = ['str', 'dex', 'int', 'luk'] as const;
export type PrimaryStat = (typeof PRIMARY_STATS)[number];

/** A character's full stat sheet: primary stats plus the combat stats derived from them. */
export interface Stats {
  str: number;
  dex: number;
  int: number;
  luk: number;
  maxHp: number;
  maxMp: number;
  /** Physical power; magic classes use `magic` instead. */
  attack: number;
  magic: number;
  defense: number;
  /** 0..1 chance that a hit is critical. */
  critRate: number;
  /** Extra damage on a crit: 0.5 = ×1.5. */
  critDamage: number;
  /** Extra damage against bosses: 0.2 = ×1.2. */
  bossDamage: number;
  /** 0..1 share of the target's defense ignored. */
  ignoreDefense: number;
}

/** Flat additions to stats (passives, buffs, later equipment). */
export type StatBonus = Partial<Stats>;

/** How one class's stats grow. Every value is data; deriveStats holds the formula. */
export interface ClassScaling {
  /** Each point adds `formula.powerPerPrimary` attack (or magic). */
  primary: PrimaryStat;
  secondary: PrimaryStat;
  damageType: 'physical' | 'magic';
  /** Level-1 values before the primary-stat contribution to power. */
  base: Stats;
  /** Added per level above 1. */
  perLevel: StatBonus;
}

export interface StatFormula {
  powerPerPrimary: number;
  powerPerSecondary: number;
}

export interface DamageConfig {
  /** RandomVariance is uniform in [min, max]. */
  variance: { min: number; max: number };
  /** DefenseModifier = k / (k + defense × (1 − ignoreDefense)). */
  defenseConstant: number;
  minDamage: number;
}

export interface ExpCurve {
  /** EXP to go from level L to L+1 = floor(base * L^exponent). */
  base: number;
  exponent: number;
  maxLevel: number;
}

/** Horizontal-only monster behaviour on its spawn platform. */
export interface MonsterBehavior {
  /** px/s */
  speed: number;
  /** 0 = passive: only aggroes when hit. */
  aggroRange: number;
  attackRange: number;
  attackCooldownMs: number;
  patrolRange: number;
  /** Gives up the chase beyond this distance from its spawn point. */
  leashRange: number;
  respawnMs: number;
  idleMs: readonly [min: number, max: number];
}

/** Axis-aligned rectangle; x/y is the top-left corner. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Deterministic random source in [0, 1). The server owns it; tests inject fixed ones. */
export type Rng = () => number;
