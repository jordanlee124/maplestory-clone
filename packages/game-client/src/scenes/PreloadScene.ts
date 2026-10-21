import Phaser from 'phaser';
import { prepareAssets } from '../art/textures';
import { queueAssets } from '../art/pipeline';
import { LIVE_VISUAL_ASSETS } from '../visuals/approvedAssets';
import { queueVisuals, registerVisuals } from '../visuals/renderer';

/** Loads (for now: generates) all textures and animations before the world starts. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    queueAssets(this);
    const approved = this.registry.get('room')?.state?.mapId === 'fernreach-fields';
    this.registry.set('approvedArt', approved);
    if (approved) queueVisuals(this, LIVE_VISUAL_ASSETS);
  }

  create() {
    prepareAssets(this);
    if (this.registry.get('approvedArt')) registerVisuals(this, LIVE_VISUAL_ASSETS);
    this.scene.start('World');
  }
}
