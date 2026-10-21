import { expect, it } from 'vitest';
import {
  attachmentPosition,
  cameraZoom,
  sampleVisual,
  validateVisual,
  type VisualAsset,
} from './model';

const asset: VisualAsset = {
  key: 'test-body',
  url: '/assets/test.png',
  size: { width: 100, height: 80 },
  filter: 'nearest',
  approval: {
    by: 'test',
    date: '2026-10-21',
    license: 'test fixture',
    provenance: 'original fixture',
  },
  frames: [
    {
      name: 'a',
      x: 0,
      y: 0,
      width: 30,
      height: 60,
      pivot: { x: 15, y: 60 },
      anchors: { head: { x: 16, y: 20 } },
    },
    {
      name: 'b',
      x: 30,
      y: 0,
      width: 40,
      height: 80,
      pivot: { x: 20, y: 79 },
      anchors: { head: { x: 20, y: 30 } },
    },
  ],
  clips: {
    idle: { frames: ['a', 'b'], durations: [100, 200], loop: true },
    attack: { frames: ['a', 'b'], durations: [90, 260], loop: false },
  },
};
it('supports arbitrary trimmed frames and validates original-art approval and atlas bounds', () => {
  expect(() => validateVisual(asset)).not.toThrow();
  expect(() => validateVisual({ ...asset, approval: { ...asset.approval, by: '' } })).toThrow();
  expect(() =>
    validateVisual({ ...asset, frames: [{ ...asset.frames[0]!, width: 101 }] }),
  ).toThrow();
  expect(() => validateVisual({ ...asset, url: '/assets/../bad.png' })).toThrow();
});
it('keeps review candidates out of normal loaders unless explicitly enabled', () => {
  const candidate: VisualAsset = {
    ...asset,
    approval: undefined,
    candidate: { date: '2026-10-21', provenance: 'original generated review study' },
  };
  expect(() => validateVisual(candidate)).toThrow('unapproved candidate');
  expect(() => validateVisual(candidate, true)).not.toThrow();
});
it('samples unequal timing, finite attacks and independent loops', () => {
  expect(sampleVisual(asset, 'idle', 99).name).toBe('a');
  expect(sampleVisual(asset, 'idle', 100).name).toBe('b');
  expect(sampleVisual(asset, 'idle', 300).name).toBe('a');
  expect(sampleVisual(asset, 'attack', 1000).name).toBe('b');
  expect(() => sampleVisual(asset, 'absent', 0)).toThrow();
});
it('mirrors attachment positions around the root while preserving ground alignment', () => {
  expect(attachmentPosition({ x: 100, y: 200 }, asset.frames[0]!, 'head', false)).toEqual({
    x: 101,
    y: 160,
  });
  expect(attachmentPosition({ x: 100, y: 200 }, asset.frames[0]!, 'head', true, 2)).toEqual({
    x: 98,
    y: 120,
  });
  expect(() => attachmentPosition({ x: 0, y: 0 }, asset.frames[0]!, 'absent', false)).toThrow();
});
it('bounds camera calibration without changing logical physics coordinates', () => {
  expect(cameraZoom(1.25)).toBe(1.25);
  for (const n of [0, 3, NaN, Infinity]) expect(() => cameraZoom(n)).toThrow();
});
