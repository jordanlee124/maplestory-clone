import type { VisualAsset, VisualClip } from './model';

const candidate = {
  date: '2026-10-21',
  provenance:
    'Original AI-assisted image_gen study; source IDs and generation/edit history in art/source/review/PROVENANCE.md. Awaiting user visual approval; not shipping art.',
};
const still: Record<string, VisualClip> = {
  idle: { frames: ['still'], durations: [1000], loop: true },
};
function plate(
  key: string,
  file: string,
  width: number,
  height: number,
  pivot = { x: 0, y: 0 },
): VisualAsset {
  return {
    key,
    url: `/assets/review/${file}-v01.png`,
    size: { width, height },
    filter: 'linear',
    candidate,
    frames: [{ name: 'still', x: 0, y: 0, width, height, pivot }],
    clips: still,
  };
}

/** Opt-in review scene only. Candidates never acquire approval metadata automatically. */
export const REVIEW_ASSETS: readonly VisualAsset[] = [
  plate('fern-far', 'fernreach-background', 1672, 941),
  plate('fern-front', 'fernreach-foreground', 1672, 941),
  plate('fern-platform', 'fernreach-platform', 2073, 758, { x: 1036, y: 288 }),
  {
    key: 'adventurer-body',
    url: '/assets/review/adventurer-v01.png',
    size: { width: 1536, height: 1024 },
    filter: 'linear',
    candidate,
    frames: [
      { name: 'idle', x: 0, y: 0, width: 384, height: 500, pivot: { x: 195, y: 474 } },
      { name: 'blink', x: 384, y: 0, width: 384, height: 500, pivot: { x: 195, y: 474 } },
      { name: 'windup', x: 768, y: 0, width: 380, height: 500, pivot: { x: 195, y: 474 } },
      { name: 'contact', x: 1152, y: 0, width: 384, height: 500, pivot: { x: 155, y: 474 } },
      { name: 'cast', x: 768, y: 490, width: 384, height: 500, pivot: { x: 195, y: 469 } },
    ],
    clips: {
      idle: { frames: ['idle', 'blink', 'idle'], durations: [2200, 120, 900], loop: true },
      attack: { frames: ['windup', 'contact', 'idle'], durations: [90, 100, 160], loop: false },
      skill: { frames: ['windup', 'cast', 'idle'], durations: [100, 250, 200], loop: false },
    },
  },
  {
    key: 'fern-frog',
    url: '/assets/review/fern-frog-v01.png',
    size: { width: 2172, height: 724 },
    filter: 'linear',
    candidate,
    // Only the clean isolated idle drawing is used; overlapping draft poses await cleanup.
    frames: [{ name: 'idle', x: 0, y: 0, width: 543, height: 724, pivot: { x: 275, y: 630 } }],
    clips: { idle: { frames: ['idle'], durations: [1000], loop: true } },
  },
  {
    key: 'skill-effect',
    url: '/assets/review/cinder-petal-v01.png',
    size: { width: 2172, height: 724 },
    filter: 'linear',
    candidate,
    frames: [
      { name: 'gather', x: 0, y: 0, width: 300, height: 724, pivot: { x: 100, y: 500 } },
      { name: 'curl', x: 300, y: 0, width: 310, height: 724, pivot: { x: 100, y: 500 } },
      { name: 'open', x: 610, y: 0, width: 410, height: 724, pivot: { x: 120, y: 500 } },
      { name: 'crest', x: 1020, y: 0, width: 450, height: 724, pivot: { x: 120, y: 500 } },
      { name: 'petals', x: 1470, y: 0, width: 390, height: 724, pivot: { x: 120, y: 500 } },
      { name: 'wisp', x: 1860, y: 0, width: 312, height: 724, pivot: { x: 100, y: 500 } },
    ],
    clips: {
      play: {
        frames: ['gather', 'curl', 'open', 'crest', 'petals', 'wisp'],
        durations: [70, 70, 70, 90, 80, 120],
        loop: false,
      },
    },
  },
];

export const REVIEW_ACTIONS = ['idle', 'attack', 'skill'] as const;
export const REVIEW_PLAYER_SCALE = 96 / 426;
export const REVIEW_FROG_SCALE = 62 / 512;
