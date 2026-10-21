// Equipment, set bonuses and enhancement tables. Probabilities and costs are versioned:
// bump the version whenever a number changes, so logged outcomes can be traced to their table.
import type { Stats, StatBonus } from '@cindervale/game-core';

export const EQUIP_SLOTS = [
  'weapon',
  'hat',
  'top',
  'bottom',
  'gloves',
  'shoes',
  'cape',
  'ring',
  'pendant',
  'belt',
  'shoulder',
] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

/** Equipment data, keyed by the item id in ITEMS (kind 'equip'). */
export interface EquipDef {
  itemId: string;
  slot: EquipSlot;
  rarity: Rarity;
  requiredLevel: number;
  /** null = every class. */
  classes: readonly string[] | null;
  /** Base stats every copy has. */
  stats: StatBonus;
  setId?: string;
}

const ALL = null;

export const EQUIPMENT: Record<string, EquipDef> = {
  'ember-brand': {
    itemId: 'ember-brand',
    slot: 'weapon',
    rarity: 'common',
    requiredLevel: 1,
    classes: ['ember-knight'],
    stats: { attack: 10 },
  },
  'gale-shortbow': {
    itemId: 'gale-shortbow',
    slot: 'weapon',
    rarity: 'common',
    requiredLevel: 1,
    classes: ['gale-ranger'],
    stats: { attack: 9, dex: 2 },
  },
  'runewood-staff': {
    itemId: 'runewood-staff',
    slot: 'weapon',
    rarity: 'common',
    requiredLevel: 1,
    classes: ['runewaver'],
    stats: { magic: 12, int: 2 },
  },
  'thorn-daggers': {
    itemId: 'thorn-daggers',
    slot: 'weapon',
    rarity: 'common',
    requiredLevel: 1,
    classes: ['thornblade'],
    stats: { attack: 9, luk: 2 },
  },
  'sprout-cap': {
    itemId: 'sprout-cap',
    slot: 'hat',
    rarity: 'common',
    requiredLevel: 1,
    classes: ALL,
    stats: { defense: 3, maxHp: 10 },
    setId: 'fernreach-wanderer',
  },
  'fernweave-tunic': {
    itemId: 'fernweave-tunic',
    slot: 'top',
    rarity: 'uncommon',
    requiredLevel: 3,
    classes: ALL,
    stats: { defense: 5, maxHp: 20 },
    setId: 'fernreach-wanderer',
  },
  'fernweave-leggings': {
    itemId: 'fernweave-leggings',
    slot: 'bottom',
    rarity: 'uncommon',
    requiredLevel: 3,
    classes: ALL,
    stats: { defense: 4, maxHp: 15 },
    setId: 'fernreach-wanderer',
  },
  'fernweave-boots': {
    itemId: 'fernweave-boots',
    slot: 'shoes',
    rarity: 'uncommon',
    requiredLevel: 3,
    classes: ALL,
    stats: { defense: 3, dex: 1 },
    setId: 'fernreach-wanderer',
  },
  'reedgrip-gloves': {
    itemId: 'reedgrip-gloves',
    slot: 'gloves',
    rarity: 'common',
    requiredLevel: 2,
    classes: ALL,
    stats: { defense: 2, attack: 1 },
  },
  'dew-cape': {
    itemId: 'dew-cape',
    slot: 'cape',
    rarity: 'common',
    requiredLevel: 2,
    classes: ALL,
    stats: { defense: 2, maxMp: 10 },
  },
  'cinder-ring': {
    itemId: 'cinder-ring',
    slot: 'ring',
    rarity: 'uncommon',
    requiredLevel: 5,
    classes: ALL,
    stats: { str: 2, dex: 2, int: 2, luk: 2 },
  },
  'frond-pendant': {
    itemId: 'frond-pendant',
    slot: 'pendant',
    rarity: 'common',
    requiredLevel: 4,
    classes: ALL,
    stats: { maxHp: 25, maxMp: 15 },
  },
  'twine-belt': {
    itemId: 'twine-belt',
    slot: 'belt',
    rarity: 'common',
    requiredLevel: 4,
    classes: ALL,
    stats: { defense: 2, maxHp: 15 },
  },
  'bark-pauldrons': {
    itemId: 'bark-pauldrons',
    slot: 'shoulder',
    rarity: 'uncommon',
    requiredLevel: 6,
    classes: ALL,
    stats: { defense: 4 },
  },
  'crystal-band': {
    itemId: 'crystal-band',
    slot: 'ring',
    rarity: 'rare',
    requiredLevel: 15,
    classes: ALL,
    stats: { str: 4, dex: 4, int: 4, luk: 4, critRate: 0.02 },
  },
};

/** One rolled stat line (bonus stats and imprints). */
export interface StatLine {
  stat: keyof Stats;
  value: number;
}

/**
 * Bonus stats: random lines rolled once when an item drops, never rerolled.
 * Each line picks a pool entry uniformly, then a value uniformly in [min, max].
 */
export const BONUS_STATS = {
  version: 1,
  linesByRarity: { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 } satisfies Record<
    Rarity,
    number
  >,
  pool: [
    { stat: 'str', min: 1, max: 4 },
    { stat: 'dex', min: 1, max: 4 },
    { stat: 'int', min: 1, max: 4 },
    { stat: 'luk', min: 1, max: 4 },
    { stat: 'maxHp', min: 5, max: 30 },
    { stat: 'maxMp', min: 5, max: 20 },
    { stat: 'defense', min: 1, max: 5 },
  ] as const satisfies readonly { stat: keyof Stats; min: number; max: number }[],
};

/** Relic Resonance: bonuses for wearing several pieces of one set. */
export interface SetDef {
  id: string;
  name: string;
  /** Every threshold met applies (2 pieces and 3 pieces both count at 3). */
  bonuses: readonly { pieces: number; bonus: StatBonus }[];
}

export const SETS: Record<string, SetDef> = {
  'fernreach-wanderer': {
    id: 'fernreach-wanderer',
    name: 'Fernreach Wanderer',
    bonuses: [
      { pieces: 2, bonus: { maxHp: 30 } },
      { pieces: 3, bonus: { defense: 5, str: 3, dex: 3, int: 3, luk: 3 } },
      { pieces: 4, bonus: { attack: 4, magic: 4 } },
    ],
  },
};

/** Forge Ascension: what happens when an attempt fails. */
export type ForgeFailure = 'keep' | 'downgrade';

export const FORGE = {
  version: 1,
  /** Index = current level: the attempt to go from that level to the next. */
  levels: [
    { successRate: 0.95, cost: 100, onFail: 'keep' },
    { successRate: 0.9, cost: 150, onFail: 'keep' },
    { successRate: 0.85, cost: 220, onFail: 'keep' },
    { successRate: 0.8, cost: 320, onFail: 'keep' },
    { successRate: 0.7, cost: 450, onFail: 'keep' },
    { successRate: 0.6, cost: 650, onFail: 'downgrade' },
    { successRate: 0.5, cost: 900, onFail: 'downgrade' },
    { successRate: 0.4, cost: 1200, onFail: 'downgrade' },
    { successRate: 0.3, cost: 1600, onFail: 'downgrade' },
    { successRate: 0.25, cost: 2100, onFail: 'downgrade' },
  ] as const satisfies readonly { successRate: number; cost: number; onFail: ForgeFailure }[],
  /** Stats per forge level. */
  perLevel: {
    weapon: { attack: 2, magic: 2 },
    armor: { defense: 2, maxHp: 8 },
  } satisfies Record<string, StatBonus>,
};
export const FORGE_MAX_LEVEL = FORGE.levels.length;

/**
 * Arcane Imprints: rerollable modifier lines. Tier 0 = no imprint. A reroll at tier T costs
 * tiers[T].cost (tier 0 uses tiers[0], and awakens the item to tier 1), may rise one tier with
 * tiers[T - 1].tierUpChance, then rolls `lines` weighted lines from the new tier's pool.
 */
export const IMPRINTS = {
  version: 1,
  tiers: [
    {
      name: 'Faint',
      cost: 300,
      tierUpChance: 0.1,
      lines: 2,
      pool: [
        { stat: 'str', value: 2, weight: 3 },
        { stat: 'dex', value: 2, weight: 3 },
        { stat: 'int', value: 2, weight: 3 },
        { stat: 'luk', value: 2, weight: 3 },
        { stat: 'maxHp', value: 20, weight: 2 },
        { stat: 'attack', value: 1, weight: 1 },
        { stat: 'magic', value: 1, weight: 1 },
      ],
    },
    {
      name: 'Bright',
      cost: 600,
      tierUpChance: 0.04,
      lines: 2,
      pool: [
        { stat: 'str', value: 4, weight: 3 },
        { stat: 'dex', value: 4, weight: 3 },
        { stat: 'int', value: 4, weight: 3 },
        { stat: 'luk', value: 4, weight: 3 },
        { stat: 'attack', value: 3, weight: 1 },
        { stat: 'magic', value: 3, weight: 1 },
        { stat: 'critRate', value: 0.02, weight: 1 },
      ],
    },
    {
      name: 'Radiant',
      cost: 1200,
      tierUpChance: 0.01,
      lines: 3,
      pool: [
        { stat: 'str', value: 6, weight: 3 },
        { stat: 'dex', value: 6, weight: 3 },
        { stat: 'int', value: 6, weight: 3 },
        { stat: 'luk', value: 6, weight: 3 },
        { stat: 'attack', value: 5, weight: 1 },
        { stat: 'magic', value: 5, weight: 1 },
        { stat: 'bossDamage', value: 0.05, weight: 1 },
      ],
    },
    {
      name: 'Mythic',
      cost: 2400,
      tierUpChance: 0,
      lines: 3,
      pool: [
        { stat: 'str', value: 9, weight: 3 },
        { stat: 'dex', value: 9, weight: 3 },
        { stat: 'int', value: 9, weight: 3 },
        { stat: 'luk', value: 9, weight: 3 },
        { stat: 'attack', value: 8, weight: 1 },
        { stat: 'magic', value: 8, weight: 1 },
        { stat: 'bossDamage', value: 0.1, weight: 1 },
        { stat: 'ignoreDefense', value: 0.05, weight: 1 },
      ],
    },
  ] as const satisfies readonly {
    name: string;
    cost: number;
    tierUpChance: number;
    lines: number;
    pool: readonly (StatLine & { weight: number })[];
  }[],
};
