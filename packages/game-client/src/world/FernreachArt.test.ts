import { expect, it, vi } from 'vitest';
import { MAPS } from '@cindervale/content';
import { renderFernreachArt } from './FernreachArt';

it('uses a single screen-fixed foreground plate so its opaque edges never repeat across the map', () => {
  const objects: { key: string; x: number; size?: number[]; scroll?: number[] }[] = [];
  const image = (x: number, _y: number, key: string) => {
    const record = { key, x } as (typeof objects)[number];
    objects.push(record);
    const object = {
      setOrigin: () => object,
      setDisplaySize: (...size: number[]) => {
        record.size = size;
        return object;
      },
      setScrollFactor: (...scroll: number[]) => {
        record.scroll = scroll;
        return object;
      },
      setAlpha: () => object,
      setDepth: () => object,
      setTileScale: () => object,
    };
    return object;
  };
  const scene = {
    cameras: { main: { setBackgroundColor: vi.fn() } },
    textures: { get: () => ({ has: () => true }) },
    add: { image, tileSprite: image },
  };
  renderFernreachArt(scene as never, MAPS['fernreach-fields']!);
  const fronts = objects.filter((o) => o.key === 'approved-fern-front');
  expect(fronts).toHaveLength(1);
  expect(fronts[0]?.scroll).toEqual([0, 1]);
  expect(fronts[0]?.x).toBeLessThanOrEqual(0);
  expect(fronts[0]!.x + fronts[0]!.size![0]!).toBeGreaterThanOrEqual(1280);
  expect(objects.find((o) => o.key === 'approved-fern-far')?.scroll).toEqual([0.12, 1]);
});
