import Phaser from 'phaser';
import { createPlaceholderTextures } from '../art/textures';

/** Loads (for now: generates) all textures and animations before the world starts. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create() {
    createPlaceholderTextures(this);
    this.scene.start('World');
  }
}
