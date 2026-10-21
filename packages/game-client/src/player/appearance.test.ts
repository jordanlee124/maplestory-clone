import { expect, it } from 'vitest';
import {
  characterClip,
  DEFAULT_APPEARANCE,
  resolveAppearance,
  type AppearanceLayer,
} from './appearance';
import { REVIEW_ASSETS } from '../visuals/reviewAssets';

it('keeps missing customization explicit and falls back to the approved flattened adventurer', () => {
  const body = REVIEW_ASSETS.find((a) => a.key === 'adventurer-body')!;
  const result = resolveAppearance(
    { ...DEFAULT_APPEARANCE, weapon: 'seed-blade', hat: 'fern-cap' },
    body,
    [],
  );
  expect(result.layers).toEqual([{ asset: body, depth: 0 }]);
  expect(result.missing).toContain('weapon:seed-blade');
  expect(result.missing).toContain('hat:fern-cap');
  expect(DEFAULT_APPEARANCE.weapon).toBe('none');
});

it('resolves body variants and hat occlusion without mutating defaults or gameplay data', () => {
  const body = REVIEW_ASSETS.find((a) => a.key === 'adventurer-body')!;
  const variant = { ...body, key: 'tall' };
  const catalog: AppearanceLayer[] = [
    { slot: 'body', id: 'tall', asset: variant, depth: 0 },
    { slot: 'hairStyle', id: 'tousled', asset: body, depth: 2 },
    { slot: 'hat', id: 'fern-cap', asset: body, depth: 3, hides: ['hairStyle'] },
    {
      slot: 'weapon',
      id: 'seed-blade',
      asset: body,
      depth: { left: -1, right: 4 },
      attachTo: 'hand',
    },
  ];
  const result = resolveAppearance(
    { ...DEFAULT_APPEARANCE, body: 'tall', hat: 'fern-cap', weapon: 'seed-blade' },
    body,
    catalog,
  );
  expect(result.layers.map((l) => l.asset.key)).toEqual(['tall', body.key, body.key]);
  expect(result.layers[2]?.attachTo).toBe('hand');
  expect(result.missing).not.toContain('hat:fern-cap');
  expect(DEFAULT_APPEARANCE.body).toBe('adventurer');
  expect(characterClip(body, 'walk')).toBe('idle');
  expect(characterClip(body, 'attack')).toBe('attack');
});
