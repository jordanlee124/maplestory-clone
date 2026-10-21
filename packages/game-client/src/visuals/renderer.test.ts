import { expect, it, vi } from 'vitest';
import type { VisualAsset } from './model';

vi.mock('phaser', () => ({
  default: { Textures: { FilterMode: { NEAREST: 1, LINEAR: 0 } } },
}));
import type Phaser from 'phaser';
import { LayeredActor, playVisualEffect, queueVisuals, registerVisuals } from './renderer';

const body: VisualAsset = {
  key: 'body',
  url: '/assets/body-v01.png',
  size: { width: 80, height: 80 },
  filter: 'nearest',
  candidate: { date: '2026-10-21', provenance: 'original test fixture' },
  frames: [
    {
      name: 'still',
      x: 0,
      y: 0,
      width: 80,
      height: 80,
      pivot: { x: 40, y: 80 },
      anchors: { hand: { x: 60, y: 40 } },
    },
  ],
  clips: {
    idle: { frames: ['still'], durations: [100], loop: true },
    attack: { frames: ['still'], durations: [100], loop: false },
  },
};

it('queues only the selected map assets and reuses already loaded textures', () => {
  const image = vi.fn();
  const scene = { load: { image }, textures: { exists: (key: string) => key === 'body' } };
  const extra = { ...body, key: 'outfit', url: '/assets/outfit-v01.png' };
  queueVisuals(scene as never, [body, extra], true);
  expect(image.mock.calls).toEqual([['outfit', extra.url]]);
  expect(() => queueVisuals(scene as never, [body, body], true)).toThrow('Duplicate');
  expect(() => queueVisuals(scene as never, [body])).toThrow('unapproved');
});

it('keeps mandatory assets strict and allows explicitly missing review slots', () => {
  const scene = { textures: { exists: () => false } };
  expect(() => registerVisuals(scene as never, [body], true)).toThrow('failed to load');
  expect(registerVisuals(scene as never, [body], true, true)).toEqual([]);
});

it('registers trimmed frames, checks real dimensions and selects the texture filter', () => {
  const texture = {
    getSourceImage: () => ({ width: 80, height: 80 }),
    setFilter: vi.fn(),
    has: () => false,
    add: vi.fn(),
  };
  const scene = { textures: { exists: () => true, get: () => texture } };
  expect(registerVisuals(scene as never, [body], true)).toEqual([body]);
  expect(texture.setFilter).toHaveBeenCalledWith(1);
  registerVisuals(scene as never, [{ ...body, filter: 'linear' }], true);
  expect(texture.setFilter).toHaveBeenLastCalledWith(0);
  expect(texture.add).toHaveBeenCalledWith('still', 0, 0, 0, 80, 80);
  expect(() =>
    registerVisuals(scene as never, [{ ...body, size: { width: 90, height: 80 } }], true),
  ).toThrow('dimensions');
});

it('keeps equipment attached through mirroring, scale and action-specific facing order', () => {
  const sprites: Record<string, unknown>[] = [];
  const scene = {
    time: { now: 0 },
    add: {
      sprite(_x: number, _y: number, key: string) {
        const sprite: Record<string, unknown> = { texture: { key }, frame: { name: 'still' } };
        Object.assign(sprite, {
          setFrame(name: string) {
            sprite.frame = { name };
            return sprite;
          },
          setOrigin(x: number, y: number) {
            sprite.origin = { x, y };
            return sprite;
          },
          setPosition(x: number, y: number) {
            Object.assign(sprite, { x, y });
            return sprite;
          },
          setFlipX(flip: boolean) {
            sprite.flipX = flip;
            return sprite;
          },
          setScale(scale: number) {
            sprite.scaleX = scale;
            return sprite;
          },
          setDepth(depth: number) {
            sprite.depth = depth;
            return sprite;
          },
          destroy: vi.fn(),
        });
        sprites.push(sprite);
        return sprite;
      },
    },
  };
  const weapon: VisualAsset = {
    ...body,
    key: 'weapon',
    frames: [{ ...body.frames[0]!, pivot: { x: 10, y: 20 } }],
  };
  const actor = new LayeredActor(scene as never, body, [
    { asset: body, depth: 0 },
    {
      asset: weapon,
      depth: { left: -2, right: 2 },
      attachTo: 'hand',
      actionDepth: { attack: { left: 3, right: -1 } },
    },
  ]);
  actor.update(100, 200, false, 2, 10);
  expect(actor.snapshot()[1]).toMatchObject({ x: 140, y: 120, scale: 2, depth: 12 });
  actor.update(100, 200, true, 2, 10);
  expect(actor.snapshot()[1]).toMatchObject({ x: 60, y: 120, depth: 8 });
  expect(sprites[1]!.origin).toEqual({ x: 70 / 80, y: 20 / 80 });
  actor.play('attack');
  actor.update(100, 200, true, 2, 10);
  expect(actor.snapshot()[1]!.depth).toBe(13);
  actor.destroy();
  for (const s of sprites) expect(s.destroy).toHaveBeenCalledOnce();
});

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
