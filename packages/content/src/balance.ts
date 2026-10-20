// Balance values: combat, progression, skills, items, drops. The server reads only these.
import type { DamageConfig, ExpCurve, StatGrowth } from '@cindervale/game-core';

export const COMBAT = {
  damage: {
    critMultiplier: 1.5,
    variance: { min: 0.9, max: 1.1 },
    defenseConstant: 100,
    minDamage: 1,
  } satisfies DamageConfig,
  /** Minimum gap between any two attacks, on top of per-skill cooldowns. */
  attackLockMs: 350,
  /** Invulnerability after being hit, so overlapping monsters can't chain hits. */
  hitInvulnMs: 1000,
  playerKnockback: { x: 30, vy: -260 },
  /** Percent of max regained per second while alive. */
  regenPercentPerSec: { hp: 1, mp: 2 },
  /** A dead player may request respawn after this delay. */
  respawnDelayMs: 2000,
} as const;

export const LEVELING: ExpCurve = { base: 15, exponent: 1.6, maxLevel: 200 };

export const LOOT = {
  inventoryCapacity: 24,
  pickupRange: { x: 50, y: 50 },
  /** Only the top damage dealer may pick up a drop for this long. */
  ownershipMs: 10_000,
  lifetimeMs: 60_000,
  /** Drops fan out horizontally from the monster by this spacing. */
  spreadPx: 20,
} as const;

export const CURRENCY_NAME = 'Cinders';

export const CLASS_STATS: Record<string, StatGrowth> = {
  'ember-knight': {
    base: { maxHp: 60, maxMp: 10, attack: 12, defense: 6, critRate: 0.05 },
    perLevel: { maxHp: 12, maxMp: 3, attack: 3, defense: 2 },
  },
  'gale-ranger': {
    base: { maxHp: 45, maxMp: 15, attack: 11, defense: 4, critRate: 0.1 },
    perLevel: { maxHp: 9, maxMp: 4, attack: 3, defense: 1.5 },
  },
  runewaver: {
    base: { maxHp: 40, maxMp: 30, attack: 13, defense: 3, critRate: 0.05 },
    perLevel: { maxHp: 7, maxMp: 8, attack: 3.5, defense: 1 },
  },
  thornblade: {
    base: { maxHp: 48, maxMp: 15, attack: 11, defense: 4, critRate: 0.15 },
    perLevel: { maxHp: 10, maxMp: 4, attack: 3, defense: 1.5 },
  },
};

export interface SkillDef {
  id: string;
  name: string;
  /** null = every class. */
  classId: string | null;
  requiredLevel: number;
  multiplier: number;
  mpCost: number;
  cooldownMs: number;
  /** Hit area in front of the player, feet-aligned. */
  range: { width: number; height: number };
  maxTargets: number;
  /** Pushes hit monsters away by this many px. */
  knockback: number;
}

export const BASIC_ATTACK_ID = 'basic-attack';

export const SKILLS: Record<string, SkillDef> = {
  'basic-attack': {
    id: 'basic-attack',
    name: 'Strike',
    classId: null,
    requiredLevel: 1,
    multiplier: 1,
    mpCost: 0,
    cooldownMs: 500,
    range: { width: 80, height: 60 },
    maxTargets: 1,
    knockback: 12,
  },
  'flame-cleave': {
    id: 'flame-cleave',
    name: 'Flame Cleave',
    classId: 'ember-knight',
    requiredLevel: 1,
    multiplier: 1.8,
    mpCost: 6,
    cooldownMs: 1500,
    range: { width: 110, height: 70 },
    maxTargets: 3,
    knockback: 24,
  },
  'gust-arrow': {
    id: 'gust-arrow',
    name: 'Gust Arrow',
    classId: 'gale-ranger',
    requiredLevel: 1,
    multiplier: 1.5,
    mpCost: 5,
    cooldownMs: 1000,
    range: { width: 360, height: 50 },
    maxTargets: 1,
    knockback: 16,
  },
  'rune-burst': {
    id: 'rune-burst',
    name: 'Rune Burst',
    classId: 'runewaver',
    requiredLevel: 1,
    multiplier: 2.2,
    mpCost: 10,
    cooldownMs: 2000,
    range: { width: 200, height: 120 },
    maxTargets: 4,
    knockback: 10,
  },
  'twin-thorn': {
    id: 'twin-thorn',
    name: 'Twin Thorn',
    classId: 'thornblade',
    requiredLevel: 1,
    multiplier: 1.4,
    mpCost: 5,
    cooldownMs: 800,
    range: { width: 90, height: 60 },
    maxTargets: 2,
    knockback: 8,
  },
};

export interface ItemDef {
  id: string;
  name: string;
  kind: 'etc' | 'consumable' | 'equip';
  /** Max per inventory slot. */
  stackSize: number;
}

export const ITEMS: Record<string, ItemDef> = {
  'twig-bundle': { id: 'twig-bundle', name: 'Twig Bundle', kind: 'etc', stackSize: 100 },
  'fern-frond': { id: 'fern-frond', name: 'Fern Frond', kind: 'etc', stackSize: 100 },
  'pond-gel': { id: 'pond-gel', name: 'Pond Gel', kind: 'etc', stackSize: 100 },
  'crystal-shard': { id: 'crystal-shard', name: 'Crystal Shard', kind: 'etc', stackSize: 100 },
  'ember-tonic': { id: 'ember-tonic', name: 'Ember Tonic', kind: 'consumable', stackSize: 50 },
  'dew-tonic': { id: 'dew-tonic', name: 'Dew Tonic', kind: 'consumable', stackSize: 50 },
  'sprout-cap': { id: 'sprout-cap', name: 'Sprout Cap', kind: 'equip', stackSize: 1 },
};

export interface DropTable {
  items: readonly { itemId: string; chance: number; min: number; max: number }[];
  currency: { chance: number; min: number; max: number };
}

export const DROP_TABLES: Record<string, DropTable> = {
  'twig-creature': {
    items: [
      { itemId: 'twig-bundle', chance: 0.6, min: 1, max: 2 },
      { itemId: 'ember-tonic', chance: 0.08, min: 1, max: 1 },
      { itemId: 'sprout-cap', chance: 0.02, min: 1, max: 1 },
    ],
    currency: { chance: 0.7, min: 3, max: 8 },
  },
  'fern-frog': {
    items: [
      { itemId: 'pond-gel', chance: 0.5, min: 1, max: 2 },
      { itemId: 'fern-frond', chance: 0.3, min: 1, max: 1 },
      { itemId: 'dew-tonic', chance: 0.08, min: 1, max: 1 },
    ],
    currency: { chance: 0.75, min: 6, max: 14 },
  },
  'crystal-beetle': {
    items: [
      { itemId: 'crystal-shard', chance: 0.55, min: 1, max: 3 },
      { itemId: 'ember-tonic', chance: 0.15, min: 1, max: 2 },
    ],
    currency: { chance: 0.85, min: 40, max: 90 },
  },
};
