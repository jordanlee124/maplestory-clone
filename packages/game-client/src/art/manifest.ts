import { CLASS_IDS, MONSTERS } from '@cindervale/content';
import { PHYSICS } from '@cindervale/game-core';

export const SPRITE_CELL = { width: 64, height: 64 } as const;
export const FEET_ORIGIN = { x: 0.5, y: 1 } as const;
export const CHARACTER_FRAMES = [
  'idle0',
  'idle1',
  'walk0',
  'walk1',
  'walk2',
  'walk3',
  'jump',
  'fall',
  'climb0',
  'climb1',
  'attack0',
  'attack1',
  'attack2',
  'skill0',
  'skill1',
  'skill2',
  'hit',
  'death',
] as const;
export const MONSTER_FRAMES = [
  'idle0',
  'idle1',
  'move0',
  'move1',
  'attack',
  'hit',
  'defeat',
] as const;
export type EquipmentSlot = 'cape' | 'weapon-back' | 'outfit' | 'headgear' | 'weapon-front';
export const EQUIPMENT_DEPTH: Record<EquipmentSlot, number> = {
  cape: -0.2,
  'weapon-back': -0.1,
  outfit: 0.1,
  headgear: 0.2,
  'weapon-front': 0.3,
};

type Source =
  | { status: 'placeholder' | 'missing'; url?: never; approval?: never }
  | {
      status: 'approved';
      url: string;
      approval: { by: string; date: string; license: string; provenance: string };
    };
interface BaseAsset {
  key: string;
  origin: { x: number; y: number };
}
export interface Clip {
  name: string;
  frames: readonly string[];
  durationsMs: readonly number[];
  repeat: number;
}
export type SheetAsset = BaseAsset &
  Source & {
    type: 'sheet';
    kind: 'character' | 'monster' | 'equipment';
    cell: { width: number; height: number };
    columns: number;
    frames: readonly string[];
    clips: readonly Clip[];
    hurtbox?: { width: number; height: number };
    slot?: EquipmentSlot;
  };
export type ImageAsset = BaseAsset &
  Source & { type: 'image'; size: { width: number; height: number } };
export type ArtAsset = SheetAsset | ImageAsset;

const clip = (name: string, frames: string[], ms: number | number[], repeat = 0): Clip => ({
  name,
  frames,
  durationsMs: typeof ms === 'number' ? frames.map(() => ms) : ms,
  repeat,
});
const characterClips = [
  clip('idle', ['idle0', 'idle1'], 500, -1),
  clip('walk', ['walk0', 'walk1', 'walk2', 'walk3'], 100, -1),
  clip('jump', ['jump'], 100),
  clip('fall', ['fall'], 100),
  clip('climb', ['climb0', 'climb1'], 1000 / 6, -1),
  clip('attack', ['attack0', 'attack1', 'attack2'], [90, 100, 160]),
  clip('skill', ['skill0', 'skill1', 'skill2'], [90, 100, 160]),
  clip('hit', ['hit'], 240),
  clip('death', ['death'], 280),
];
const rig = {
  type: 'sheet',
  cell: SPRITE_CELL,
  origin: FEET_ORIGIN,
  columns: CHARACTER_FRAMES.length,
  frames: CHARACTER_FRAMES,
  clips: characterClips,
} as const;

/** Approval is explicit. No source files have been supplied/approved for shipping yet. */
export const ASSETS: readonly ArtAsset[] = [
  ...CLASS_IDS.map((id): SheetAsset => ({
    ...rig,
    key: `adventurer-${id}`,
    kind: 'character',
    status: 'placeholder',
    hurtbox: { width: PHYSICS.bodyWidth, height: PHYSICS.bodyHeight },
  })),
  ...Object.values(MONSTERS).map((m): SheetAsset => ({
    type: 'sheet',
    key: m.id,
    kind: 'monster',
    status: 'placeholder',
    cell: SPRITE_CELL,
    columns: MONSTER_FRAMES.length,
    origin: FEET_ORIGIN,
    frames: MONSTER_FRAMES,
    hurtbox: m.size,
    clips: [
      clip('idle', ['idle0', 'idle1'], 220, -1),
      clip('move', ['move0', 'move1'], 220, -1),
      clip('attack', ['attack'], 240),
      clip('hit', ['hit'], 180),
      clip('defeat', ['defeat'], 280),
    ],
  })),
  ...(['cape', 'outfit', 'headgear', 'weapon-back', 'weapon-front'] as const).map(
    (slot): SheetAsset => ({
      ...rig,
      key: `equipment-starter-${slot}`,
      kind: 'equipment',
      slot,
      status: 'missing',
    }),
  ),
  ...Object.entries({
    'tile-grass': [32, 32],
    'tile-dirt': [32, 32],
    ladder: [16, 16],
    'bg-hills-far': [512, 256],
    'bg-hills-near': [512, 200],
    cloud: [64, 24],
    'flower-pink': [7, 11],
    'flower-white': [7, 11],
    'grass-tuft': [8, 8],
  }).map(([key, [width, height]]): ImageAsset => ({
    type: 'image',
    key,
    status: 'placeholder',
    size: { width: width!, height: height! },
    origin:
      key === 'ladder'
        ? { x: 0.5, y: 0 }
        : key.startsWith('flower-') || key === 'grass-tuft'
          ? FEET_ORIGIN
          : { x: 0, y: 0 },
  })),
];

export function assetByKey(key: string, assets = ASSETS): ArtAsset {
  const asset = assets.find((a) => a.key === key);
  if (!asset) throw new Error(`Unknown art asset: ${key}`);
  return asset;
}

export function frameRect(asset: SheetAsset, frame: string) {
  const index = asset.frames.indexOf(frame);
  if (index < 0) throw new Error(`${asset.key}: missing frame ${frame}`);
  return {
    x: (index % asset.columns) * asset.cell.width,
    y: Math.floor(index / asset.columns) * asset.cell.height,
    width: asset.cell.width,
    height: asset.cell.height,
  };
}

export function validateAsset(asset: ArtAsset) {
  const fail = (reason: string): never => {
    throw new Error(`${asset.key}: ${reason}`);
  };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.key)) fail('invalid asset key');
  if (asset.status === 'approved') {
    if (
      !asset.url?.startsWith('/assets/') ||
      !asset.url.endsWith('.png') ||
      asset.url.includes('..')
    )
      fail('expected local PNG under /assets/');
    if (
      !asset.approval ||
      ![
        asset.approval.by,
        asset.approval.date,
        asset.approval.license,
        asset.approval.provenance,
      ].every((v) => typeof v === 'string' && v.trim())
    )
      fail('missing approval/provenance');
  }
  const size = asset.type === 'sheet' ? asset.cell : asset.size;
  if (![size.width, size.height].every((n) => Number.isInteger(n) && n > 0))
    fail('invalid dimensions');
  if (asset.type !== 'sheet') return;
  if (size.width !== 64 || size.height !== 64) fail('rig requires untrimmed 64x64 cells');
  if (asset.origin.x !== 0.5 || asset.origin.y !== 1) fail('rig origin must be bottom-centre');
  if (
    !Number.isInteger(asset.columns) ||
    asset.columns < 1 ||
    asset.frames.length < 1 ||
    new Set(asset.frames).size !== asset.frames.length
  )
    fail('invalid frame grid/names');
  if (asset.kind === 'equipment' && (!asset.slot || !Object.hasOwn(EQUIPMENT_DEPTH, asset.slot)))
    fail('missing equipment slot');
  const requiredClips =
    asset.kind === 'monster'
      ? ['idle', 'move', 'attack', 'hit', 'defeat']
      : characterClips.map((c) => c.name);
  if (
    new Set(asset.clips.map((c) => c.name)).size !== asset.clips.length ||
    requiredClips.some((name) => !asset.clips.some((c) => c.name === name))
  )
    fail('missing/duplicate animation clips');
  for (const c of asset.clips) {
    if (
      !c.frames.length ||
      c.frames.length !== c.durationsMs.length ||
      c.durationsMs.some((ms) => !Number.isFinite(ms) || ms <= 0)
    )
      fail(`invalid timing for ${c.name}`);
    for (const f of c.frames)
      if (!asset.frames.includes(f)) fail(`clip ${c.name} references absent frame ${f}`);
  }
  if (asset.kind === 'character' || asset.kind === 'equipment') {
    if (JSON.stringify(asset.frames) !== JSON.stringify(CHARACTER_FRAMES))
      fail('incomplete character rig');
  }
  if (asset.hurtbox && (asset.hurtbox.width > size.width || asset.hurtbox.height > size.height))
    fail('hurtbox exceeds cell');
}

export function validateEquipment(body: SheetAsset, layers: readonly SheetAsset[]) {
  const slots = new Set<EquipmentSlot>();
  for (const layer of layers) {
    validateAsset(layer);
    if (
      layer.kind !== 'equipment' ||
      !layer.slot ||
      slots.has(layer.slot) ||
      layer.cell.width !== body.cell.width ||
      layer.cell.height !== body.cell.height ||
      layer.origin.x !== body.origin.x ||
      layer.origin.y !== body.origin.y ||
      JSON.stringify(layer.frames) !== JSON.stringify(body.frames)
    )
      throw new Error(`${layer.key}: incompatible equipment rig/slot`);
    slots.add(layer.slot);
  }
}
