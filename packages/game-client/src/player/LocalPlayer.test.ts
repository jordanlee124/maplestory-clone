import { expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import type { Room } from '@colyseus/sdk';
import type { PlayerView } from '@cindervale/protocol';
import { MAPS } from '@cindervale/content';
import { LocalPlayer } from './LocalPlayer';

// The renderer deliberately stays facing right, as it can during a locked hit/attack pose.
vi.mock('./Avatar', () => ({
  Avatar: class {
    sprite = { flipX: false };
    update() {}
  },
}));

it('retains movement-command facing independently of a locked sprite pose', () => {
  let left = true;
  const player = new LocalPlayer(
    {} as Phaser.Scene,
    { send: vi.fn() } as unknown as Room,
    {
      read: () => ({ left, right: false, up: false, down: false, jump: false }),
      clear() {},
      actions: () => [],
    },
    {
      x: 200,
      y: 640,
      vx: 0,
      vy: 0,
      grounded: true,
      climbing: false,
      lastSeq: -1,
      dead: false,
    } as PlayerView,
    MAPS['fernreach-fields']!.geometry,
  );
  player.update(0, true);
  player.update(100, true);
  expect(player.facing).toBe('left');
  expect(player.avatar.sprite.flipX).toBe(false);
  left = false;
  player.update(200, true);
  expect(player.facing).toBe('left');
});
