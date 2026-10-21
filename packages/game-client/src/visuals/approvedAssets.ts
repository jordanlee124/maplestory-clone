import { REVIEW_ASSETS, REVIEW_PLAYER_SCALE, REVIEW_FROG_SCALE } from './reviewAssets';
import type { VisualAsset } from './model';
import { ATTACK_WINDOWS } from '../combat/animation';
import { VALIDATION_CANDIDATES, REVIEW_TWIG_SCALE } from './validationCandidates';

const approvedKeys = [
  'fern-far',
  'fern-front',
  'fern-platform',
  'adventurer-body',
  'fern-frog',
  'skill-effect',
  'twig-creature',
  'ui-panel',
];
/** User approved the displayed direction in chat on 2026-10-21; draft coverage remains documented. */
export const APPROVED_DIRECTION_ASSETS: readonly VisualAsset[] = [
  ...REVIEW_ASSETS,
  ...VALIDATION_CANDIDATES,
]
  .filter((a) => approvedKeys.includes(a.key))
  .map((a) => ({
    key: a.key,
    url: a.url,
    size: a.size,
    filter: a.filter,
    frames: a.frames,
    clips: a.clips,
    approval: {
      by: 'Project owner — explicit chat approval',
      date: '2026-10-21',
      provenance:
        'Original project-generated imagery; art/source/review/PROVENANCE.md and assets.json. Direction approved for live integration; raster/action cleanup remains provisional.',
      license:
        'Original AI-assisted project output; project use authorized by the owner. No third-party source assets used.',
    },
  }));

// Namespacing prevents collision with the still-supported legacy texture keys.
export const LIVE_VISUAL_ASSETS: readonly VisualAsset[] = APPROVED_DIRECTION_ASSETS.map((a) => ({
  ...a,
  key: `approved-${a.key}`,
  clips:
    a.key === 'adventurer-body'
      ? { ...a.clips, skill: { ...a.clips.skill!, durations: Object.values(ATTACK_WINDOWS) } }
      : a.clips,
}));
export function liveVisual(key: string) {
  const asset = LIVE_VISUAL_ASSETS.find((a) => a.key === `approved-${key}`);
  if (!asset) throw new Error(`Missing approved visual: ${key}`);
  return asset;
}
export const PLAYER_VISUAL_SCALE = REVIEW_PLAYER_SCALE;
export const FROG_VISUAL_SCALE = REVIEW_FROG_SCALE;
export const TWIG_VISUAL_SCALE = REVIEW_TWIG_SCALE;

export function platformParts(width: number) {
  if (!Number.isFinite(width) || width <= 0) throw new Error('Invalid platform width');
  const cap = Math.min(60, width / 2);
  return { cap, middle: width - cap * 2 };
}
