// Data-driven game content. Pure data: only Phase 0 maps are used at runtime so far.
import type { MapGeometry } from '@cindervale/game-core';

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
    maps: [],
  },
  'duskmire-caverns': {
    id: 'duskmire-caverns',
    name: 'Duskmire Caverns',
    levelRange: [15, 30],
    maps: [],
  },
};

export const START_MAP_ID = 'cindervale-town';

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
    },
  },
};

export const MONSTERS: Record<string, MonsterDef> = {
  'twig-creature': {
    id: 'twig-creature',
    name: 'Twig Creature',
    level: 2,
    hp: 40,
    exp: 4,
    regionId: 'fernreach-fields',
  },
  'fern-frog': {
    id: 'fern-frog',
    name: 'Fern Frog',
    level: 5,
    hp: 90,
    exp: 9,
    regionId: 'fernreach-fields',
  },
  'crystal-beetle': {
    id: 'crystal-beetle',
    name: 'Crystal Beetle',
    level: 18,
    hp: 900,
    exp: 55,
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
