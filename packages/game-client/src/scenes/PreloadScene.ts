import { PHYSICS } from '@cindervale/game-core';
import Phaser from 'phaser';

export const CLASS_COLORS: Record<string, number> = {
  'ember-knight': 0xd9502b,
  'gale-ranger': 0x3fae5a,
  runewaver: 0x5a6fe0,
  thornblade: 0x8e44ad,
};

/**
 * Loads assets. Until real pixel art exists in /assets, generates placeholder textures
 * at native resolution (no fractional scaling).
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create() {
    const g = this.add.graphics();
    const w = PHYSICS.bodyWidth + 8;
    const h = PHYSICS.bodyHeight;

    // Chibi placeholder: big head, small body. One tint-able texture per class.
    for (const [classId, color] of Object.entries(CLASS_COLORS)) {
      g.clear();
      g.fillStyle(color).fillRect(8, 26, w - 16, 16);
      g.fillStyle(0x3b2a20)
        .fillRect(9, 42, 5, 6)
        .fillRect(w - 14, 42, 5, 6);
      g.fillStyle(0xffe0bd).fillRect(2, 2, w - 4, 24);
      g.fillStyle(0x5b3a1e).fillRect(2, 0, w - 4, 8);
      g.fillStyle(0x1b1b1b)
        .fillRect(w - 13, 13, 3, 5)
        .fillRect(w - 7, 13, 3, 5);
      g.generateTexture(`player-${classId}`, w, h);
    }

    g.clear();
    g.fillStyle(0x7a4b2a).fillRect(0, 0, 32, 32);
    g.fillStyle(0x8f5b35).fillRect(4, 14, 6, 4).fillRect(20, 24, 6, 4);
    g.fillStyle(0x4caf50).fillRect(0, 0, 32, 8);
    g.fillStyle(0x6fd36f).fillRect(0, 0, 32, 3);
    g.generateTexture('tile-grass', 32, 32);

    g.clear();
    g.fillStyle(0x7a4b2a).fillRect(0, 0, 32, 32);
    g.fillStyle(0x8f5b35).fillRect(4, 6, 6, 4).fillRect(20, 20, 6, 4);
    g.generateTexture('tile-dirt', 32, 32);

    g.clear();
    g.fillStyle(0x8fbf9f)
      .fillTriangle(0, 256, 160, 40, 320, 256)
      .fillTriangle(220, 256, 400, 90, 512, 256);
    g.generateTexture('bg-hills-far', 512, 256);

    g.clear();
    g.fillStyle(0x5d9c6c)
      .fillTriangle(0, 200, 120, 60, 260, 200)
      .fillTriangle(180, 200, 330, 20, 512, 200);
    g.generateTexture('bg-hills-near', 512, 200);

    g.destroy();
    this.scene.start('World');
  }
}
