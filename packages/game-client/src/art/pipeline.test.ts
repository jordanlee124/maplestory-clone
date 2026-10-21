import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { ASSETS, type SheetAsset } from './manifest';
import { queueAssets, registerAssets } from './pipeline';

const body = ASSETS.find((a) => a.key === 'adventurer-ember-knight') as SheetAsset;
function fixture(width = 1152) {
  const frames = new Map<string, number[]>();
  const animations = new Map<string, Phaser.Types.Animations.Animation>();
  const texture = {
    getSourceImage: () => ({ width, height: 64 }),
    setFilter: vi.fn(),
    has: (name: string) => frames.has(name),
    add: (name: string, ...rect: number[]) => frames.set(name, rect),
  };
  const scene = {
    textures: { exists: () => true, get: () => texture },
    load: { spritesheet: vi.fn(), image: vi.fn() },
    anims: {
      exists: (key: string) => animations.has(key),
      create: (animation: Phaser.Types.Animations.Animation) =>
        animations.set(animation.key!, animation),
    },
  };
  return { scene: scene as unknown as Phaser.Scene, texture, frames, animations, load: scene.load };
}

describe('asset loading and registration', () => {
  it('loads only approved PNG sources and refuses duplicate keys', () => {
    const f = fixture();
    f.scene.textures.exists = () => false;
    const approved: SheetAsset = {
      ...body,
      status: 'approved',
      url: '/assets/characters/body-v1.png',
      approval: {
        by: 'test-only',
        date: '2026-10-21',
        license: 'test-fixture',
        provenance: 'test',
      },
    };
    queueAssets(f.scene, [approved, ASSETS.find((a) => a.status === 'missing')!]);
    expect(f.load.spritesheet).toHaveBeenCalledWith(approved.key, approved.url, {
      frameWidth: 64,
      frameHeight: 64,
    });
    expect(() => queueAssets(f.scene, [body, body])).toThrow('Duplicate asset key');
  });

  it('registers aliases and exact attack timing once, and rejects mismatched sheet dimensions', () => {
    const f = fixture();
    registerAssets(f.scene, [body]);
    registerAssets(f.scene, [body]);
    expect(f.frames.size).toBe(18);
    expect(f.frames.get('attack0')).toEqual([0, 640, 0, 64, 64]);
    const attack = f.animations.get(`${body.key}-attack`)!;
    const frames = attack.frames as Phaser.Types.Animations.AnimationFrame[];
    expect(frames.map((frame) => 1000 / attack.frameRate! + (frame.duration ?? 0))).toEqual([
      90, 100, 160,
    ]);
    expect(f.animations.size).toBe(9);
    expect(f.texture.setFilter).toHaveBeenCalledWith(1);
    expect(() => registerAssets(fixture(32).scene, [body])).toThrow('expected 1152x64');
  });
});
