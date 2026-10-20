// Shared rule types. Values live in @cindervale/content; logic lives in this package.

/** Combat stats of a player (derived from class + level) or a monster. */
export interface Stats {
  maxHp: number;
  maxMp: number;
  attack: number;
  defense: number;
  /** 0..1 chance that a hit is critical. */
  critRate: number;
}

export interface DamageConfig {
  critMultiplier: number;
  /** RandomVariance is uniform in [min, max]. */
  variance: { min: number; max: number };
  /** DefenseModifier = k / (k + defense). */
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
