// Data-driven game content: world, classes, monsters. Balance numbers live in ./balance.
import type { MapGeometry, MonsterBehavior } from '@cindervale/game-core';

export * from './balance';
export * from './equipment';
export type { StatBonus, Stats } from '@cindervale/game-core';

export interface RegionDef {
  id: string;
  name: string;
  levelRange: readonly [number, number];
  maps: readonly string[];
}

export interface MapDef {
  id: string;
  name: string;
  regionId: string;
  geometry: MapGeometry;
  /** Placeholder palette (0xRRGGBB) until real map art exists. */
  theme: { sky: number; hillsFar: number; hillsNear: number };
  /** Each spawn's y must be a platform top; the monster stays on that platform. */
  monsterSpawns: readonly { monsterId: string; x: number; y: number }[];
  /** Boss arenas: automation (auto-grind) is never allowed. */
  bossInstance?: boolean;
}

export interface ClassDef {
  id: string;
  name: string;
  role: string;
  primaryStat: 'STR' | 'DEX' | 'INT' | 'LUK';
}

export interface MonsterDef {
  id: string;
  name: string;
  level: number;
  hp: number;
  exp: number;
  attack: number;
  defense: number;
  /** Hurt box, feet-aligned. */
  size: { width: number; height: number };
  behavior: MonsterBehavior;
  /** Boss damage applies against it. */
  boss?: boolean;
  dropTableId: string;
  regionId: string;
}

export interface BossDef {
  id: string;
  name: string;
  difficulty: 'normal';
  level: number;
  hp: number;
  phases: number;
  timeLimitSec: number;
  deathLimit: number;
  regionId: string;
}

export const CLASS_IDS = ['ember-knight', 'gale-ranger', 'runewaver', 'thornblade'] as const;
export type ClassId = (typeof CLASS_IDS)[number];

export const CLASSES: Record<ClassId, ClassDef> = {
  'ember-knight': {
    id: 'ember-knight',
    name: 'Ember Knight',
    role: 'Melee warrior',
    primaryStat: 'STR',
  },
  'gale-ranger': {
    id: 'gale-ranger',
    name: 'Gale Ranger',
    role: 'Ranged archer',
    primaryStat: 'DEX',
  },
  runewaver: { id: 'runewaver', name: 'Runewaver', role: 'Spellcaster', primaryStat: 'INT' },
  thornblade: { id: 'thornblade', name: 'Thornblade', role: 'Agile assassin', primaryStat: 'LUK' },
};

export const REGIONS: Record<string, RegionDef> = {
  'cindervale-town': {
    id: 'cindervale-town',
    name: 'Cindervale Town',
    levelRange: [1, 200],
    maps: ['cindervale-town'],
  },
  'fernreach-fields': {
    id: 'fernreach-fields',
    name: 'Fernreach Fields',
    levelRange: [1, 15],
    maps: ['fernreach-fields'],
  },
  'duskmire-caverns': {
    id: 'duskmire-caverns',
    name: 'Duskmire Caverns',
    levelRange: [15, 30],
    maps: ['duskmire-caverns'],
  },
};

export const START_MAP_ID = 'fernreach-fields';

export const MAPS: Record<string, MapDef> = {
  'cindervale-town': {
    id: 'cindervale-town',
    name: 'Cindervale Town',
    regionId: 'cindervale-town',
    geometry: {
      width: 2560,
      height: 720,
      spawn: { x: 400, y: 640 },
      platforms: [
        { x: 0, y: 640, width: 2560 },
        { x: 560, y: 540, width: 240 },
        { x: 880, y: 450, width: 200 },
        { x: 1180, y: 380, width: 280 },
        { x: 1560, y: 520, width: 320 },
        { x: 1960, y: 430, width: 220 },
      ],
      ladders: [],
    },
    theme: { sky: 0x9fd8ff, hillsFar: 0x8fbf9f, hillsNear: 0x5d9c6c },
    monsterSpawns: [],
  },
  'fernreach-fields': {
    id: 'fernreach-fields',
    name: 'Fernreach Fields',
    regionId: 'fernreach-fields',
    geometry: {
      width: 3840,
      height: 720,
      spawn: { x: 200, y: 640 },
      platforms: [
        // Ground, with a jumpable gap at 1500-1600.
        { x: 0, y: 640, width: 1500 },
        { x: 1600, y: 640, width: 2240 },
        // Stairs up to the first ledge.
        { x: 300, y: 560, width: 160 },
        { x: 520, y: 480, width: 160 },
        { x: 760, y: 400, width: 200 },
        // Ladder ledge.
        { x: 1080, y: 360, width: 280 },
        // Mid-field hops.
        { x: 1800, y: 540, width: 200 },
        { x: 2060, y: 460, width: 180 },
        { x: 2300, y: 380, width: 220 },
        // High lookout, reached by the long rope.
        { x: 2680, y: 260, width: 320 },
        { x: 3120, y: 520, width: 240 },
        { x: 3420, y: 440, width: 220 },
      ],
      ladders: [
        { x: 1160, top: 360, bottom: 640 },
        { x: 2740, top: 260, bottom: 640 },
      ],
    },
    theme: { sky: 0xa8e6ff, hillsFar: 0xa6d98c, hillsNear: 0x6cbf5a },
    monsterSpawns: [
      { monsterId: 'twig-creature', x: 520, y: 640 },
      { monsterId: 'twig-creature', x: 860, y: 640 },
      { monsterId: 'twig-creature', x: 1320, y: 640 },
      { monsterId: 'twig-creature', x: 600, y: 480 },
      { monsterId: 'fern-frog', x: 1900, y: 640 },
      { monsterId: 'fern-frog', x: 2350, y: 640 },
      { monsterId: 'fern-frog', x: 2950, y: 640 },
      { monsterId: 'fern-frog', x: 2400, y: 380 },
      { monsterId: 'fern-frog', x: 3220, y: 520 },
    ],
  },
  'duskmire-caverns': {
    id: 'duskmire-caverns',
    name: 'Duskmire Caverns',
    regionId: 'duskmire-caverns',
    geometry: {
      width: 2560,
      height: 720,
      spawn: { x: 160, y: 640 },
      platforms: [
        { x: 0, y: 640, width: 2560 },
        { x: 520, y: 520, width: 300 },
        { x: 1000, y: 440, width: 360 },
        { x: 1600, y: 520, width: 320 },
      ],
      ladders: [{ x: 1080, top: 440, bottom: 640 }],
    },
    theme: { sky: 0x2a2440, hillsFar: 0x463a66, hillsNear: 0x5b4a80 },
    monsterSpawns: [
      { monsterId: 'crystal-beetle', x: 700, y: 640 },
      { monsterId: 'crystal-beetle', x: 1200, y: 440 },
      { monsterId: 'crystal-beetle', x: 1750, y: 520 },
      { monsterId: 'crystal-beetle', x: 2200, y: 640 },
    ],
  },
};

export const MONSTERS: Record<string, MonsterDef> = {
  'twig-creature': {
    id: 'twig-creature',
    name: 'Twig Creature',
    level: 2,
    hp: 40,
    exp: 4,
    attack: 8,
    defense: 2,
    size: { width: 28, height: 32 },
    behavior: {
      speed: 40,
      aggroRange: 0,
      attackRange: 24,
      attackCooldownMs: 1200,
      patrolRange: 120,
      leashRange: 400,
      respawnMs: 8000,
      idleMs: [2000, 5000],
    },
    dropTableId: 'twig-creature',
    regionId: 'fernreach-fields',
  },
  'fern-frog': {
    id: 'fern-frog',
    name: 'Fern Frog',
    level: 5,
    hp: 90,
    exp: 9,
    attack: 14,
    defense: 5,
    size: { width: 32, height: 28 },
    behavior: {
      speed: 60,
      aggroRange: 0,
      attackRange: 28,
      attackCooldownMs: 1100,
      patrolRange: 160,
      leashRange: 450,
      respawnMs: 9000,
      idleMs: [1500, 4000],
    },
    dropTableId: 'fern-frog',
    regionId: 'fernreach-fields',
  },
  'crystal-beetle': {
    id: 'crystal-beetle',
    name: 'Crystal Beetle',
    level: 18,
    hp: 900,
    exp: 55,
    attack: 60,
    defense: 40,
    size: { width: 40, height: 30 },
    behavior: {
      speed: 50,
      aggroRange: 220,
      attackRange: 30,
      attackCooldownMs: 1300,
      patrolRange: 140,
      leashRange: 500,
      respawnMs: 12000,
      idleMs: [2000, 4500],
    },
    dropTableId: 'crystal-beetle',
    regionId: 'duskmire-caverns',
  },
};

export const BOSSES: Record<string, BossDef> = {
  'ashroot-guardian-normal': {
    id: 'ashroot-guardian-normal',
    name: 'Ashroot Guardian',
    difficulty: 'normal',
    level: 30,
    hp: 250_000,
    phases: 2,
    timeLimitSec: 600,
    deathLimit: 5,
    regionId: 'duskmire-caverns',
  },
};
