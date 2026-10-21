import type { VisualAsset } from './model';

const candidate = {
  date: '2026-10-21',
  provenance:
    'Original image_gen output; art/source/review/PROVENANCE.md. New review candidate, not approved for live use.',
};

/** Source review history; live promotion is explicit in approvedAssets, never inferred here. */
export const VALIDATION_CANDIDATES: readonly VisualAsset[] = [
  {
    key: 'twig-creature',
    url: '/assets/review/twig-creature-v01.png',
    size: { width: 1536, height: 1024 },
    filter: 'linear',
    candidate,
    frames: [
      { name: 'idle', x: 0, y: 0, width: 512, height: 512, pivot: { x: 265, y: 495 } },
      { name: 'walk', x: 512, y: 0, width: 512, height: 512, pivot: { x: 265, y: 495 } },
      { name: 'windup', x: 1024, y: 0, width: 512, height: 512, pivot: { x: 280, y: 495 } },
      { name: 'strike', x: 0, y: 512, width: 544, height: 512, pivot: { x: 250, y: 458 } },
      { name: 'hurt', x: 544, y: 512, width: 480, height: 512, pivot: { x: 238, y: 458 } },
      { name: 'defeat', x: 1024, y: 512, width: 512, height: 512, pivot: { x: 265, y: 464 } },
    ],
    // shortcut: these are six pose studies; replace sparse playback with reviewed in-betweens.
    clips: {
      idle: { frames: ['idle'], durations: [1000], loop: true },
      walk: { frames: ['idle', 'walk'], durations: [160, 160], loop: true },
      attack: { frames: ['windup', 'strike', 'idle'], durations: [90, 100, 160], loop: false },
      hit: { frames: ['hurt', 'idle'], durations: [180, 60], loop: false },
      defeat: { frames: ['defeat'], durations: [600], loop: false },
    },
  },
  {
    key: 'ui-panel',
    url: '/assets/review/woodland-panel-v01.png',
    size: { width: 2172, height: 724 },
    filter: 'linear',
    candidate,
    frames: [{ name: 'still', x: 0, y: 0, width: 2172, height: 724, pivot: { x: 0, y: 0 } }],
    clips: { idle: { frames: ['still'], durations: [1000], loop: true } },
  },
];
export const REVIEW_TWIG_SCALE = 64 / 469;
