import Phaser from 'phaser';

const { KeyCodes } = Phaser.Input.Keyboard;

/** Engine-level setup before any assets load. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // Stop the browser from scrolling the page or opening find (F3) on game keys.
    this.input.keyboard?.addCapture([
      KeyCodes.SPACE,
      KeyCodes.ALT,
      KeyCodes.UP,
      KeyCodes.DOWN,
      KeyCodes.LEFT,
      KeyCodes.RIGHT,
      KeyCodes.F3,
    ]);
    this.scene.start('Preload');
  }
}
