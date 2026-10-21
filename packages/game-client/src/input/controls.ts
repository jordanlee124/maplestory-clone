import type { MoveInput } from '@cindervale/game-core';
import type Phaser from 'phaser';
import { actionForCode, DEFAULT_BINDINGS, type Action, type Keybindings } from './bindings';

const NEUTRAL: MoveInput = { left: false, right: false, up: false, down: false, jump: false };

/** Physical key codes; combat is edge-triggered, movement remains fixed-step. */
export function createControls(
  scene: Phaser.Scene,
  bindings: () => Keybindings = () => DEFAULT_BINDINGS,
) {
  const held = new Set<string>();
  const pressed: Action[] = [];
  const clear = () => {
    held.clear();
    pressed.length = 0;
  };
  const keydown = (event: KeyboardEvent) => {
    const action = actionForCode(bindings(), event.code);
    if (!action) return;
    event.preventDefault();
    if (!event.repeat && !held.has(event.code)) pressed.push(action);
    held.add(event.code);
  };
  const keyup = (event: KeyboardEvent) => {
    held.delete(event.code);
  };
  scene.input.keyboard!.on('keydown', keydown).on('keyup', keyup);
  scene.game.events.on('blur', clear);
  scene.events.once('shutdown', () => {
    scene.input.keyboard!.off('keydown', keydown).off('keyup', keyup);
    scene.game.events.off('blur', clear);
  });
  return {
    clear,
    actions(enabled: boolean) {
      const result = enabled ? pressed.splice(0) : [];
      pressed.length = 0;
      return result;
    },
    read(enabled: boolean): MoveInput {
      if (!enabled) {
        clear();
        return NEUTRAL;
      }
      const down = (a: Action) => bindings()[a].some((code) => held.has(code));
      return {
        left: down('left'),
        right: down('right'),
        up: down('up'),
        down: down('down'),
        jump: down('jump'),
      };
    },
  };
}
