import type { VisualAsset } from './model';
import { APPROVED_DIRECTION_ASSETS } from './approvedAssets';

/** Populate only after art-direction review, with source and usage rights recorded. */
export const VALIDATION_ASSETS: readonly VisualAsset[] = APPROVED_DIRECTION_ASSETS;

export const VALIDATION_SLOTS = [
  ['fern-sky', 'Atmospheric sky / warm light'],
  ['fern-far', 'Distant botanical ruins / mist'],
  ['fern-mid', 'Curving woodland silhouettes'],
  ['fern-front', 'Foreground fern framing'],
  ['fern-platform', 'Organic grassy platform / roots'],
  ['adventurer-body', 'Clean chibi body / feet, head, hand anchors'],
  ['adventurer-hair-back', 'Rear hair silhouette'],
  ['adventurer-outfit', 'Short layered woodland outfit'],
  ['adventurer-face', 'Expressive face / independent blink'],
  ['adventurer-hair-front', 'Front hair / readable eyes'],
  ['adventurer-weapon', 'Original seed-lantern blade'],
  ['adventurer-accessory', 'Seed-bell accessory / independent sway'],
  ['fern-frog', 'Fern crown / rounded frog / expressive eyes'],
  ['attack-effect', 'Basic attack / readable directional arc'],
  ['skill-effect', 'Cinder-petal skill / soft glow'],
  ['ambient-mote', 'Single approved pollen particle'],
  ['ui-panel', 'Original illustrated character panel'],
] as const;

export const ACTIONS = [
  'idle',
  'walk',
  'jump',
  'fall',
  'attack',
  'skill',
  'hit',
  'defeat',
] as const;
