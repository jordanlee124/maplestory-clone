import type { MoveInput } from '@cindervale/game-core';
import type Phaser from 'phaser';

const NEUTRAL: MoveInput = { left: false, right: false, up: false, down: false, jump: false };

/** Keyboard → MoveInput. Arrows + Space are primary; WASD and Alt are alternates. */
export function createControls(scene: Phaser.Scene) {
  const k = scene.input.keyboard!.addKeys({
    left: 'LEFT',
    right: 'RIGHT',
    up: 'UP',
    down: 'DOWN',
    space: 'SPACE',
    a: 'A',
    d: 'D',
    w: 'W',
    s: 'S',
    alt: 'ALT',
  }) as Record<string, Phaser.Input.Keyboard.Key>;
  const down = (...keys: string[]) => keys.some((name) => k[name]!.isDown);

  return {
    /** `enabled: false` (e.g. menu open) still yields an input so the simulation keeps stepping. */
    read(enabled: boolean): MoveInput {
      if (!enabled) return NEUTRAL;
      return {
        left: down('left', 'a'),
        right: down('right', 'd'),
        up: down('up', 'w'),
        down: down('down', 's'),
        jump: down('space', 'alt'),
      };
    },
  };
}
