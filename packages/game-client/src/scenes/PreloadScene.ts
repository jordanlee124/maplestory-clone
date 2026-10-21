import Phaser from 'phaser';
import { prepareAssets } from '../art/textures';
import { queueAssets } from '../art/pipeline';
import { LIVE_VISUAL_ASSETS } from '../visuals/approvedAssets';
import { queueVisuals, registerVisuals } from '../visuals/renderer';

/** Loads approved textures alongside legacy placeholders before the world starts. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) =>
      this.game.events.emit('world-load-error', new Error(`Art failed to load: ${file.key}`)),
    );
    queueAssets(this);
    const approved = this.registry.get('room')?.state?.mapId === 'fernreach-fields';
    this.registry.set('approvedArt', approved);
    if (approved) queueVisuals(this, LIVE_VISUAL_ASSETS);
  }

  create() {
    try {
      prepareAssets(this);
      if (this.registry.get('approvedArt')) registerVisuals(this, LIVE_VISUAL_ASSETS);
      this.scene.start('World');
    } catch (error) {
      this.game.events.emit('world-load-error', error);
    }
  }
}
