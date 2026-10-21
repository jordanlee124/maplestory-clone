import { expect, it, vi } from 'vitest';
import type { PlayerView } from '@cindervale/protocol';
vi.mock('phaser', () => ({ default: {} }));
import { Avatar } from './Avatar';
import { RemotePlayers } from './RemotePlayers';
import { DEFAULT_APPEARANCE } from './appearance';

function makeScene() {
  const scene = { time: { now: 0 }, registry: { get: () => true }, add: { sprite, text: sprite } };
  function sprite() {
    const object = {
      scene,
      x: 0,
      y: 0,
      flipX: false,
      frame: '',
      destroyed: false,
      setPosition(x: number, y: number) {
        Object.assign(this, { x, y });
        return this;
      },
      setFlipX(flipX: boolean) {
        this.flipX = flipX;
        return this;
      },
      setFrame(frame: string) {
        this.frame = frame;
        return this;
      },
      setOrigin() {
        return this;
      },
      setDepth() {
        return this;
      },
      setScale() {
        return this;
      },
      setAlpha() {
        return this;
      },
      setTint() {
        return this;
      },
      clearTint() {
        return this;
      },
      setTintFill() {
        return this;
      },
      setPadding() {
        return this;
      },
      destroy: vi.fn(),
    };
    return object;
  }
  return scene;
}
const player = {
  name: 'Fern',
  classId: 'ember-knight',
  x: 100,
  y: 200,
  vx: 0,
  vy: 0,
  grounded: true,
  climbing: false,
  dead: false,
} as PlayerView;

it('keeps repeated attacks, hit/death/respawn and facing on the shared Avatar path', () => {
  const scene = makeScene();
  const avatar = new Avatar(scene as never, player);
  avatar.update(100, 200, player);
  avatar.attack(false, 'left');
  scene.time.now = 120;
  avatar.update(100, 200, player);
  expect(avatar.sprite.frame).toBe('contact');
  expect(avatar.sprite.flipX).toBe(true);
  scene.time.now = 400;
  avatar.attack(false, 'right');
  avatar.update(100, 200, player);
  expect(avatar.sprite.frame).toBe('windup');
  avatar.hit();
  avatar.update(100, 200, player);
  expect(avatar.animation.sample(400, player, false).state).toBe('hit');
  avatar.update(100, 200, player, true);
  avatar.attack(true, 'left');
  expect(avatar.animation.sample(400, player, true).state).toBe('death');
  scene.time.now = 500;
  avatar.update(100, 200, player, false);
  expect(avatar.animation.sample(500, player, false).state).toBe('respawn');
  avatar.setAppearance({ ...DEFAULT_APPEARANCE, facing: 'left', hat: 'missing-cap' });
  expect(avatar.sprite.flipX).toBe(true);
  expect(player.x).toBe(100);
  avatar.destroy();
  expect(avatar.sprite.destroy).toHaveBeenCalledOnce();
});

it('animates remote snapshots and confirmed combat, removes leavers and releases remaining actors', () => {
  const scene = makeScene();
  const remotes = new RemotePlayers(scene as never);
  remotes.sync(
    new Map([
      ['me', player],
      ['other', { ...player, vx: -1 }],
    ]),
    'me',
    80,
  );
  expect(remotes.count).toBe(1);
  const avatar = remotes.get('other')!;
  expect(avatar.sprite.flipX).toBe(true);
  avatar.attack(true, 'right');
  scene.time.now = 120;
  remotes.sync(new Map([['other', player]]), 'me', 80);
  expect(avatar.sprite.frame).toBe('cast');
  remotes.sync(new Map(), 'me', 80);
  expect(avatar.sprite.destroy).toHaveBeenCalledOnce();
  remotes.sync(new Map([['other', player]]), 'me', 80);
  const remaining = remotes.get('other')!;
  remotes.destroy();
  expect(remaining.sprite.destroy).toHaveBeenCalledOnce();
  expect(remotes.count).toBe(0);
});
