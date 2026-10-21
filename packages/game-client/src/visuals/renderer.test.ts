import { expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { LayeredActor, playVisualEffect, queueVisuals, registerVisuals } from './renderer';
import type { VisualAsset } from './model';

vi.mock('phaser', () => ({ default: { Textures: { FilterMode: { NEAREST: 1, LINEAR: 0 } } } }));
const asset: VisualAsset = {
  key: 'body',
  url: '/assets/body.png',
  size: { width: 100, height: 80 },
  filter: 'nearest',
  approval: {
    by: 'test',
    date: '2026-10-21',
    provenance: 'original test fixture',
    license: 'test',
  },
  frames: [
    {
      name: 'a',
      x: 0,
      y: 0,
      width: 40,
      height: 80,
      pivot: { x: 10, y: 78 },
      anchors: { head: { x: 12, y: 20 } },
    },
    {
      name: 'b',
      x: 40,
      y: 0,
      width: 40,
      height: 80,
      pivot: { x: 10, y: 78 },
      anchors: { head: { x: 12, y: 20 } },
    },
  ],
  clips: { idle: { frames: ['a', 'b'], durations: [100, 100], loop: true } },
};
it('queues only explicitly approved assets, rejects duplicates and selects texture filtering per asset', () => {
  const texture = {
    getSourceImage: () => ({ width: 100, height: 80 }),
    setFilter: vi.fn(),
    has: () => false,
    add: vi.fn(),
  };
  const scene = {
    load: { image: vi.fn() },
    textures: { exists: () => true, get: () => texture },
  } as unknown as Phaser.Scene;
  queueVisuals(scene, [asset]);
  expect(scene.load.image).toHaveBeenCalledWith('body', '/assets/body.png');
  expect(() => queueVisuals(scene, [asset, asset])).toThrow('Duplicate');
  registerVisuals(scene, [asset]);
  expect(texture.setFilter).toHaveBeenLastCalledWith(1);
  registerVisuals(scene, [{ ...asset, key: 'mist', filter: 'linear' }]);
  expect(texture.setFilter).toHaveBeenLastCalledWith(0);
  texture.getSourceImage = () => ({ width: 10, height: 10 });
  expect(() => registerVisuals(scene, [asset])).toThrow('dimensions');
});
it('keeps independent layer clocks, attachment pivots and mirrored depth ordering', () => {
  const sprites: Record<string, ReturnType<typeof vi.fn>>[] = [];
  const scene = {
    time: { now: 150 },
    add: {
      sprite: () => {
        const sprite: Record<string, ReturnType<typeof vi.fn>> = {};
        for (const key of [
          'setFrame',
          'setOrigin',
          'setPosition',
          'setFlipX',
          'setScale',
          'setDepth',
          'destroy',
        ])
          sprite[key] = vi.fn(() => sprite);
        sprites.push(sprite);
        return sprite;
      },
    },
  } as unknown as Phaser.Scene;
  const face = { ...asset, key: 'face', clips: { blink: asset.clips.idle! } };
  const actor = new LayeredActor(scene, asset, [
    { asset, depth: 0 },
    { asset: face, depth: 3, attachTo: 'head', independent: 'blink', actionDepth: { idle: 4 } },
  ]);
  actor.play('idle');
  actor.update(100, 200, true);
  expect(sprites[0]!.setFrame).toHaveBeenLastCalledWith('a');
  expect(sprites[1]!.setFrame).toHaveBeenLastCalledWith('b');
  expect(sprites[0]!.setOrigin).toHaveBeenLastCalledWith(0.75, 78 / 80);
  expect(sprites[1]!.setPosition).toHaveBeenLastCalledWith(98, 142);
  expect(sprites[1]!.setDepth).toHaveBeenLastCalledWith(24);
  actor.destroy();
  expect(sprites[0]!.destroy).toHaveBeenCalledOnce();
  expect(() => new LayeredActor(scene, asset, [{ asset, depth: 0, attachTo: 'missing' }])).toThrow(
    'anchor',
  );
});

it('finishes effects on their own timeline and removes update/shutdown listeners', () => {
  const target = new EventTarget();
  const events = {
    on: (name: string, fn: () => void) => target.addEventListener(name, fn),
    once: (name: string, fn: () => void) => target.addEventListener(name, fn, { once: true }),
    off: vi.fn((name: string, fn: () => void) => target.removeEventListener(name, fn)),
    emit: (name: string) => target.dispatchEvent(new Event(name)),
  };
  const sprite = {
    setDepth: vi.fn(),
    setFlipX: vi.fn(),
    setFrame: vi.fn(),
    setOrigin: vi.fn(),
    destroy: vi.fn(),
  };
  for (const fn of [sprite.setDepth, sprite.setFlipX, sprite.setFrame, sprite.setOrigin])
    fn.mockReturnValue(sprite);
  const scene = {
    time: { now: 0 },
    events,
    add: { sprite: () => sprite },
  } as unknown as Phaser.Scene;
  const effect = { ...asset, clips: { play: { ...asset.clips.idle!, loop: false } } };
  playVisualEffect(scene, effect, 'play', 100, 200, 30);
  expect(sprite.setFrame).toHaveBeenLastCalledWith('a');
  scene.time.now = 150;
  events.emit('update');
  expect(sprite.setFrame).toHaveBeenLastCalledWith('b');
  scene.time.now = 200;
  events.emit('update');
  expect(sprite.destroy).toHaveBeenCalledOnce();
  expect(events.off).toHaveBeenCalledWith('update', expect.any(Function));
  expect(events.off).toHaveBeenCalledWith('shutdown', expect.any(Function));
  events.emit('update');
  events.emit('shutdown');
  expect(sprite.destroy).toHaveBeenCalledOnce();
  expect(() => playVisualEffect(scene, asset, 'idle', 0, 0, 0)).toThrow('finite');
});
