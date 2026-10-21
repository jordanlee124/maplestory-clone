import { expect, it } from 'vitest';
import {
  APPROVED_DIRECTION_ASSETS,
  LIVE_VISUAL_ASSETS,
  liveVisual,
  platformParts,
} from './approvedAssets';
import { REVIEW_ASSETS } from './reviewAssets';
import { validateVisual } from './model';

it('promotes only the six explicitly reviewed assets with provenance and separate live keys', () => {
  expect(APPROVED_DIRECTION_ASSETS).toHaveLength(6);
  for (const asset of LIVE_VISUAL_ASSETS) {
    expect(() => validateVisual(asset)).not.toThrow();
    expect(asset.key).toMatch(/^approved-/);
    expect(asset.approval?.by).toContain('Project owner');
    expect(asset.candidate).toBeUndefined();
  }
  expect(REVIEW_ASSETS.every((a) => a.candidate && !a.approval)).toBe(true);
  expect(liveVisual('adventurer-body').key).toBe('approved-adventurer-body');
  expect(liveVisual('adventurer-body').clips.skill?.durations).toEqual([90, 100, 160]);
  expect(() => liveVisual('not-approved')).toThrow();
});
it('fits visual cap sections without expanding or shrinking authoritative platform spans', () => {
  for (const width of [40, 120, 160, 200, 280, 1500, 2240]) {
    const p = platformParts(width);
    expect(p.cap * 2 + p.middle).toBe(width);
    expect(p.middle).toBeGreaterThanOrEqual(0);
  }
  expect(() => platformParts(0)).toThrow();
});
