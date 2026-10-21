import type { VisualAsset } from '../visuals/model';
import type { ActorLayer } from '../visuals/renderer';

/** Frontend IDs only. No stats, inventory ownership or persistence. */
export interface CharacterAppearance {
  body: string;
  skinTone: string;
  face: string;
  eyes: string;
  hairStyle: string;
  hairColor: string;
  outfit: string;
  hat: string;
  weapon: string;
  cape: string;
  accessories: readonly string[];
  facing: 'left' | 'right';
}

export const DEFAULT_APPEARANCE: Readonly<CharacterAppearance> = {
  body: 'adventurer',
  skinTone: 'fair',
  face: 'bright',
  eyes: 'amber',
  hairStyle: 'tousled',
  hairColor: 'honey',
  outfit: 'woodland',
  hat: 'none',
  weapon: 'none',
  cape: 'none',
  accessories: [],
  facing: 'right',
};

export type AppearanceSlot =
  Exclude<keyof CharacterAppearance, 'facing' | 'accessories'> | 'accessory';
export interface AppearanceLayer extends ActorLayer {
  slot: AppearanceSlot;
  id: string;
  /** Equipment may cover other appearance slots, such as a hat hiding hair. */
  hides?: readonly AppearanceSlot[];
}

export const CHARACTER_ACTIONS = [
  'idle',
  'walk',
  'jump',
  'fall',
  'climb',
  'attack',
  'skill',
  'hit',
  'death',
  'respawn',
] as const;

/** Empty slots are intentional: clean separated exports have not been approved. */
export const CHARACTER_LAYERS: readonly AppearanceLayer[] = [];

export function resolveAppearance(
  appearance: CharacterAppearance,
  body: VisualAsset,
  catalog = CHARACTER_LAYERS,
) {
  const requested = Object.entries(appearance).flatMap(([slot, id]) =>
    slot === 'facing'
      ? []
      : slot === 'accessories'
        ? (id as readonly string[]).map((value) => ({ slot: 'accessory', id: value }))
        : [{ slot, id: id as string }],
  );
  const selected = catalog.filter((layer) =>
    requested.some((r) => r.slot === layer.slot && r.id === layer.id),
  );
  const hidden = new Set(selected.flatMap((layer) => layer.hides ?? []));
  const root = selected.find((layer) => layer.slot === 'body') ?? { asset: body, depth: 0 };
  const layers: ActorLayer[] = [
    root,
    ...selected.filter((layer) => layer.slot !== 'body' && !hidden.has(layer.slot)),
  ];
  const missing = requested
    .filter((r) => r.id !== 'none' && !selected.some((l) => l.slot === r.slot && l.id === r.id))
    .map((r) => `${r.slot}:${r.id}`);
  return { layers, missing };
}

/** Missing drawings hold idle explicitly; they are not promoted to authored clips. */
export function characterClip(body: VisualAsset, action: string) {
  return body.clips[action] ? action : 'idle';
}
