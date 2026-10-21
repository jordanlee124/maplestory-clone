// Balance values: combat, progression, skills, items, drops. The server reads only these.
import type {
  ClassScaling,
  DamageConfig,
  ExpCurve,
  StatBonus,
  StatFormula,
  Stats,
} from '@cindervale/game-core';

export const COMBAT = {
  damage: {
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

/** Skill points earned per level gained. */
export const PROGRESSION = { skillPointsPerLevel: 3 } as const;

/** Level at which each advancement stage opens: stage N needs ADVANCEMENT_LEVELS[N - 1]. */
export const ADVANCEMENT_LEVELS = [1, 30, 60, 100] as const;

export const STAT_FORMULA: StatFormula = { powerPerPrimary: 0.5, powerPerSecondary: 0.25 };

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

const BASE_STATS: Stats = {
  str: 4,
  dex: 4,
  int: 4,
  luk: 4,
  maxHp: 0,
  maxMp: 0,
  attack: 0,
  magic: 0,
  defense: 0,
  critRate: 0.05,
  critDamage: 0.5,
  bossDamage: 0,
  ignoreDefense: 0,
};

export const CLASS_SCALING: Record<string, ClassScaling> = {
  'ember-knight': {
    primary: 'str',
    secondary: 'dex',
    damageType: 'physical',
    base: { ...BASE_STATS, str: 12, dex: 5, maxHp: 60, maxMp: 10, attack: 5, defense: 6 },
    perLevel: { str: 5, dex: 1, maxHp: 12, maxMp: 3, defense: 2 },
  },
  'gale-ranger': {
    primary: 'dex',
    secondary: 'str',
    damageType: 'physical',
    base: {
      ...BASE_STATS,
      dex: 12,
      str: 5,
      maxHp: 45,
      maxMp: 15,
      attack: 4,
      defense: 4,
      critRate: 0.1,
    },
    perLevel: { dex: 5, str: 1, maxHp: 9, maxMp: 4, defense: 1.5 },
  },
  runewaver: {
    primary: 'int',
    secondary: 'luk',
    damageType: 'magic',
    base: { ...BASE_STATS, int: 12, luk: 5, maxHp: 40, maxMp: 30, magic: 6, defense: 3 },
    perLevel: { int: 5, luk: 1, maxHp: 7, maxMp: 8, defense: 1 },
  },
  thornblade: {
    primary: 'luk',
    secondary: 'dex',
    damageType: 'physical',
    base: {
      ...BASE_STATS,
      luk: 12,
      dex: 5,
      maxHp: 48,
      maxMp: 15,
      attack: 4,
      defense: 4,
      critRate: 0.15,
    },
    perLevel: { luk: 5, dex: 1, maxHp: 10, maxMp: 4, defense: 1.5 },
  },
};

interface SkillCommon {
  id: string;
  name: string;
  /** null = every class. */
  classId: string | null;
  /** Advancement stage it belongs to; 0 = shared by every class. */
  stage: number;
  requiredLevel: number;
  /** Another skill that must reach this level first. */
  requires?: { skillId: string; level: number };
  maxLevel: number;
  /** Known at level 1 without spending skill points. */
  innate?: boolean;
  mpCost: number;
  cooldownMs: number;
}

export interface AttackSkillDef extends SkillCommon {
  kind: 'attack';
  multiplier: number;
  /** Added to the multiplier per skill level above 1. */
  multiplierPerLevel: number;
  /** Hit area in front of the player, feet-aligned. */
  range: { width: number; height: number };
  maxTargets: number;
  /** Pushes hit monsters away by this many px. */
  knockback: number;
}

/** Bonus at skill level L = bonus + bonusPerLevel × (L − 1). */
export interface BuffSkillDef extends SkillCommon {
  kind: 'buff';
  durationMs: number;
  bonus: StatBonus;
  bonusPerLevel: StatBonus;
}

export interface PassiveSkillDef extends SkillCommon {
  kind: 'passive';
  bonus: StatBonus;
  bonusPerLevel: StatBonus;
}

export type SkillDef = AttackSkillDef | BuffSkillDef | PassiveSkillDef;

export const BASIC_ATTACK_ID = 'basic-attack';

export const SKILLS: Record<string, SkillDef> = {
  'basic-attack': {
    id: 'basic-attack',
    name: 'Strike',
    kind: 'attack',
    classId: null,
    stage: 0,
    requiredLevel: 1,
    maxLevel: 1,
    innate: true,
    multiplier: 1,
    multiplierPerLevel: 0,
    mpCost: 0,
    cooldownMs: 500,
    range: { width: 80, height: 60 },
    maxTargets: 1,
    knockback: 12,
  },
  // ---- Ember Knight ----
  'flame-cleave': {
    id: 'flame-cleave',
    name: 'Flame Cleave',
    kind: 'attack',
    classId: 'ember-knight',
    stage: 1,
    requiredLevel: 1,
    maxLevel: 10,
    innate: true,
    multiplier: 1.8,
    multiplierPerLevel: 0.1,
    mpCost: 6,
    cooldownMs: 1500,
    range: { width: 110, height: 70 },
    maxTargets: 3,
    knockback: 24,
  },
  'ashen-hide': {
    id: 'ashen-hide',
    name: 'Ashen Hide',
    kind: 'passive',
    classId: 'ember-knight',
    stage: 1,
    requiredLevel: 2,
    maxLevel: 10,
    mpCost: 0,
    cooldownMs: 0,
    bonus: { maxHp: 10, defense: 2 },
    bonusPerLevel: { maxHp: 10, defense: 2 },
  },
  'kindled-will': {
    id: 'kindled-will',
    name: 'Kindled Will',
    kind: 'buff',
    classId: 'ember-knight',
    stage: 1,
    requiredLevel: 3,
    maxLevel: 10,
    mpCost: 12,
    cooldownMs: 1000,
    durationMs: 120_000,
    bonus: { attack: 4 },
    bonusPerLevel: { attack: 1 },
  },
  'ember-crash': {
    id: 'ember-crash',
    name: 'Ember Crash',
    kind: 'attack',
    classId: 'ember-knight',
    stage: 1,
    requiredLevel: 5,
    requires: { skillId: 'flame-cleave', level: 3 },
    maxLevel: 10,
    multiplier: 2.6,
    multiplierPerLevel: 0.15,
    mpCost: 14,
    cooldownMs: 4000,
    range: { width: 140, height: 80 },
    maxTargets: 5,
    knockback: 30,
  },
  // ---- Gale Ranger ----
  'gust-arrow': {
    id: 'gust-arrow',
    name: 'Gust Arrow',
    kind: 'attack',
    classId: 'gale-ranger',
    stage: 1,
    requiredLevel: 1,
    maxLevel: 10,
    innate: true,
    multiplier: 1.5,
    multiplierPerLevel: 0.08,
    mpCost: 5,
    cooldownMs: 1000,
    range: { width: 360, height: 50 },
    maxTargets: 1,
    knockback: 16,
  },
  'fletchers-focus': {
    id: 'fletchers-focus',
    name: "Fletcher's Focus",
    kind: 'passive',
    classId: 'gale-ranger',
    stage: 1,
    requiredLevel: 2,
    maxLevel: 10,
    mpCost: 0,
    cooldownMs: 0,
    bonus: { dex: 2, critDamage: 0.05 },
    bonusPerLevel: { dex: 2, critDamage: 0.02 },
  },
  'keen-eye': {
    id: 'keen-eye',
    name: 'Keen Eye',
    kind: 'buff',
    classId: 'gale-ranger',
    stage: 1,
    requiredLevel: 3,
    maxLevel: 10,
    mpCost: 10,
    cooldownMs: 1000,
    durationMs: 120_000,
    bonus: { critRate: 0.05 },
    bonusPerLevel: { critRate: 0.01 },
  },
  'tailwind-volley': {
    id: 'tailwind-volley',
    name: 'Tailwind Volley',
    kind: 'attack',
    classId: 'gale-ranger',
    stage: 1,
    requiredLevel: 5,
    requires: { skillId: 'gust-arrow', level: 3 },
    maxLevel: 10,
    multiplier: 1.2,
    multiplierPerLevel: 0.06,
    mpCost: 12,
    cooldownMs: 3000,
    range: { width: 400, height: 70 },
    maxTargets: 4,
    knockback: 20,
  },
  // ---- Runewaver ----
  'rune-burst': {
    id: 'rune-burst',
    name: 'Rune Burst',
    kind: 'attack',
    classId: 'runewaver',
    stage: 1,
    requiredLevel: 1,
    maxLevel: 10,
    innate: true,
    multiplier: 2.2,
    multiplierPerLevel: 0.12,
    mpCost: 10,
    cooldownMs: 2000,
    range: { width: 200, height: 120 },
    maxTargets: 4,
    knockback: 10,
  },
  'runic-insight': {
    id: 'runic-insight',
    name: 'Runic Insight',
    kind: 'passive',
    classId: 'runewaver',
    stage: 1,
    requiredLevel: 2,
    maxLevel: 10,
    mpCost: 0,
    cooldownMs: 0,
    bonus: { int: 3, maxMp: 15, bossDamage: 0.05 },
    bonusPerLevel: { int: 2, maxMp: 10, bossDamage: 0.01 },
  },
  'mana-weave': {
    id: 'mana-weave',
    name: 'Mana Weave',
    kind: 'buff',
    classId: 'runewaver',
    stage: 1,
    requiredLevel: 3,
    maxLevel: 10,
    mpCost: 15,
    cooldownMs: 1000,
    durationMs: 120_000,
    bonus: { magic: 5 },
    bonusPerLevel: { magic: 1 },
  },
  'glyph-lance': {
    id: 'glyph-lance',
    name: 'Glyph Lance',
    kind: 'attack',
    classId: 'runewaver',
    stage: 1,
    requiredLevel: 5,
    requires: { skillId: 'rune-burst', level: 3 },
    maxLevel: 10,
    multiplier: 3.4,
    multiplierPerLevel: 0.2,
    mpCost: 18,
    cooldownMs: 4500,
    range: { width: 300, height: 60 },
    maxTargets: 1,
    knockback: 18,
  },
  // ---- Thornblade ----
  'twin-thorn': {
    id: 'twin-thorn',
    name: 'Twin Thorn',
    kind: 'attack',
    classId: 'thornblade',
    stage: 1,
    requiredLevel: 1,
    maxLevel: 10,
    innate: true,
    multiplier: 1.4,
    multiplierPerLevel: 0.08,
    mpCost: 5,
    cooldownMs: 800,
    range: { width: 90, height: 60 },
    maxTargets: 2,
    knockback: 8,
  },
  'venom-edge': {
    id: 'venom-edge',
    name: 'Venom Edge',
    kind: 'passive',
    classId: 'thornblade',
    stage: 1,
    requiredLevel: 2,
    maxLevel: 10,
    mpCost: 0,
    cooldownMs: 0,
    bonus: { luk: 2, ignoreDefense: 0.05 },
    bonusPerLevel: { luk: 2, ignoreDefense: 0.02 },
  },
  'nightshade-focus': {
    id: 'nightshade-focus',
    name: 'Nightshade Focus',
    kind: 'buff',
    classId: 'thornblade',
    stage: 1,
    requiredLevel: 3,
    maxLevel: 10,
    mpCost: 10,
    cooldownMs: 1000,
    durationMs: 120_000,
    bonus: { attack: 3, critRate: 0.03 },
    bonusPerLevel: { attack: 1, critRate: 0.005 },
  },
  'bramble-flurry': {
    id: 'bramble-flurry',
    name: 'Bramble Flurry',
    kind: 'attack',
    classId: 'thornblade',
    stage: 1,
    requiredLevel: 5,
    requires: { skillId: 'twin-thorn', level: 3 },
    maxLevel: 10,
    multiplier: 2.4,
    multiplierPerLevel: 0.12,
    mpCost: 12,
    cooldownMs: 2500,
    range: { width: 120, height: 70 },
    maxTargets: 4,
    knockback: 10,
  },
};

export interface ItemDef {
  id: string;
  name: string;
  kind: 'etc' | 'consumable' | 'equip';
  /** Max per inventory slot. */
  stackSize: number;
  /** Consumables: restored on use. */
  use?: { hp?: number; mp?: number };
}

/** Auto-grinding safety limits. */
export const AUTO_GRIND = {
  /** Automation switches itself off after running this long. */
  maxRunMs: 2 * 60 * 60_000,
  /** Manual input pauses automation; it resumes after this long without any. */
  manualOverrideMs: 3000,
  /** Pick a new target if the current one isn't hit within this long. */
  targetTimeoutMs: 8000,
  /** Most skills a priority list may hold. */
  maxSkills: 8,
} as const;

/** Minimum gap between two item uses. */
export const ITEM_USE_COOLDOWN_MS = 500;

const equip = (id: string, name: string): ItemDef => ({ id, name, kind: 'equip', stackSize: 1 });

export const ITEMS: Record<string, ItemDef> = {
  'twig-bundle': { id: 'twig-bundle', name: 'Twig Bundle', kind: 'etc', stackSize: 100 },
  'fern-frond': { id: 'fern-frond', name: 'Fern Frond', kind: 'etc', stackSize: 100 },
  'pond-gel': { id: 'pond-gel', name: 'Pond Gel', kind: 'etc', stackSize: 100 },
  'crystal-shard': { id: 'crystal-shard', name: 'Crystal Shard', kind: 'etc', stackSize: 100 },
  'ember-tonic': {
    id: 'ember-tonic',
    name: 'Ember Tonic',
    kind: 'consumable',
    stackSize: 50,
    use: { hp: 50 },
  },
  'dew-tonic': {
    id: 'dew-tonic',
    name: 'Dew Tonic',
    kind: 'consumable',
    stackSize: 50,
    use: { mp: 30 },
  },
  'sprout-cap': equip('sprout-cap', 'Sprout Cap'),
  'ember-brand': equip('ember-brand', 'Ember Brand'),
  'gale-shortbow': equip('gale-shortbow', 'Gale Shortbow'),
  'runewood-staff': equip('runewood-staff', 'Runewood Staff'),
  'thorn-daggers': equip('thorn-daggers', 'Thorn Daggers'),
  'fernweave-tunic': equip('fernweave-tunic', 'Fernweave Tunic'),
  'fernweave-leggings': equip('fernweave-leggings', 'Fernweave Leggings'),
  'fernweave-boots': equip('fernweave-boots', 'Fernweave Boots'),
  'reedgrip-gloves': equip('reedgrip-gloves', 'Reedgrip Gloves'),
  'dew-cape': equip('dew-cape', 'Dew Cape'),
  'cinder-ring': equip('cinder-ring', 'Cinder Ring'),
  'frond-pendant': equip('frond-pendant', 'Frond Pendant'),
  'twine-belt': equip('twine-belt', 'Twine Belt'),
  'bark-pauldrons': equip('bark-pauldrons', 'Bark Pauldrons'),
  'crystal-band': equip('crystal-band', 'Crystal Band'),
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
      { itemId: 'reedgrip-gloves', chance: 0.01, min: 1, max: 1 },
      { itemId: 'ember-brand', chance: 0.01, min: 1, max: 1 },
      { itemId: 'gale-shortbow', chance: 0.01, min: 1, max: 1 },
      { itemId: 'runewood-staff', chance: 0.01, min: 1, max: 1 },
      { itemId: 'thorn-daggers', chance: 0.01, min: 1, max: 1 },
    ],
    currency: { chance: 0.7, min: 3, max: 8 },
  },
  'fern-frog': {
    items: [
      { itemId: 'pond-gel', chance: 0.5, min: 1, max: 2 },
      { itemId: 'fern-frond', chance: 0.3, min: 1, max: 1 },
      { itemId: 'dew-tonic', chance: 0.08, min: 1, max: 1 },
      { itemId: 'fernweave-tunic', chance: 0.015, min: 1, max: 1 },
      { itemId: 'fernweave-leggings', chance: 0.015, min: 1, max: 1 },
      { itemId: 'fernweave-boots', chance: 0.015, min: 1, max: 1 },
      { itemId: 'dew-cape', chance: 0.015, min: 1, max: 1 },
      { itemId: 'frond-pendant', chance: 0.01, min: 1, max: 1 },
      { itemId: 'twine-belt', chance: 0.01, min: 1, max: 1 },
      { itemId: 'cinder-ring', chance: 0.005, min: 1, max: 1 },
    ],
    currency: { chance: 0.75, min: 6, max: 14 },
  },
  'crystal-beetle': {
    items: [
      { itemId: 'crystal-shard', chance: 0.55, min: 1, max: 3 },
      { itemId: 'ember-tonic', chance: 0.15, min: 1, max: 2 },
      { itemId: 'bark-pauldrons', chance: 0.02, min: 1, max: 1 },
      { itemId: 'crystal-band', chance: 0.005, min: 1, max: 1 },
    ],
    currency: { chance: 0.85, min: 40, max: 90 },
  },
};
