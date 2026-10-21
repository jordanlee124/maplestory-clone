import type Phaser from 'phaser';
import { createMonsterTextures } from './monsters';
import { drawAdventurerSheet, type AdventurerPalette } from './adventurer';
import { assetByKey, CHARACTER_FRAMES, SPRITE_CELL } from './manifest';
import { registerAssets } from './pipeline';

// Placeholder art generated at load time, at native resolution (no fractional scaling).
// Replace with sprite sheets from /assets as real art lands; keys and frame names stay.

const CLASS_PALETTES: Record<string, AdventurerPalette> = {
  'ember-knight': { tunic: '#d9502b', tunicShade: '#a83a1d' },
  'gale-ranger': { tunic: '#3fae5a', tunicShade: '#2b8040' },
  runewaver: { tunic: '#5a6fe0', tunicShade: '#3d4fb8' },
  thornblade: { tunic: '#8e44ad', tunicShade: '#69307f' },
};

export const adventurerKey = (classId: string) =>
  `adventurer-${classId in CLASS_PALETTES ? classId : 'ember-knight'}`;

function createAdventurers(scene: Phaser.Scene) {
  const { width, height } = SPRITE_CELL;
  for (const [classId, palette] of Object.entries(CLASS_PALETTES)) {
    const key = adventurerKey(classId);
    if (assetByKey(key).status !== 'placeholder' || scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, width * CHARACTER_FRAMES.length, height)!;
    drawAdventurerSheet(tex.context, palette);
    tex.refresh();
  }
}

function generate(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  key: string,
  width: number,
  height: number,
) {
  if (assetByKey(key).status === 'placeholder' && !scene.textures.exists(key))
    g.generateTexture(key, width, height);
}

function createTiles(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics) {
  g.clear();
  g.fillStyle(0x8a5a33).fillRect(0, 0, 32, 32);
  g.fillStyle(0x9c6a3e).fillRect(4, 14, 6, 4).fillRect(20, 24, 6, 4);
  g.fillStyle(0x4cb84a).fillRect(0, 0, 32, 8);
  g.fillStyle(0x7ee06a).fillRect(0, 0, 32, 3);
  g.fillStyle(0x4cb84a).fillRect(3, 8, 3, 2).fillRect(14, 8, 4, 3).fillRect(25, 8, 3, 2);
  generate(scene, g, 'tile-grass', 32, 32);

  g.clear();
  g.fillStyle(0x8a5a33).fillRect(0, 0, 32, 32);
  g.fillStyle(0x9c6a3e).fillRect(4, 6, 6, 4).fillRect(20, 20, 6, 4);
  g.fillStyle(0x6e4526).fillRect(12, 26, 3, 3);
  generate(scene, g, 'tile-dirt', 32, 32);

  // Ladder segment: two rails and a rung, tiled vertically.
  g.clear();
  g.fillStyle(0x6b4423).fillRect(0, 0, 3, 16).fillRect(13, 0, 3, 16);
  g.fillStyle(0xb07a45).fillRect(1, 0, 1, 16).fillRect(14, 0, 1, 16);
  g.fillStyle(0xc68d52).fillRect(3, 6, 10, 3);
  g.fillStyle(0x6b4423).fillRect(3, 9, 10, 1);
  generate(scene, g, 'ladder', 16, 16);
}

function createScenery(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics) {
  // White so maps can tint them with their theme colours.
  g.clear();
  g.fillStyle(0xffffff)
    .fillTriangle(0, 256, 160, 40, 320, 256)
    .fillTriangle(220, 256, 400, 90, 512, 256);
  generate(scene, g, 'bg-hills-far', 512, 256);

  g.clear();
  g.fillStyle(0xffffff)
    .fillTriangle(0, 200, 120, 60, 260, 200)
    .fillTriangle(180, 200, 330, 20, 512, 200);
  generate(scene, g, 'bg-hills-near', 512, 200);

  g.clear();
  g.fillStyle(0xffffff).fillRect(8, 8, 48, 16).fillRect(16, 0, 24, 8).fillRect(0, 16, 64, 8);
  g.fillStyle(0xdff3ff).fillRect(0, 22, 64, 2);
  generate(scene, g, 'cloud', 64, 24);

  const flower = (key: string, petal: number) => {
    g.clear();
    g.fillStyle(0x3f9e3a).fillRect(3, 5, 1, 6).fillRect(1, 8, 2, 1);
    g.fillStyle(petal).fillRect(2, 1, 3, 1).fillRect(1, 2, 5, 2).fillRect(2, 4, 3, 1);
    g.fillStyle(0xffe066).fillRect(3, 2, 1, 2);
    generate(scene, g, key, 7, 11);
  };
  flower('flower-pink', 0xff7eb6);
  flower('flower-white', 0xfff7f0);

  g.clear();
  g.fillStyle(0x3f9e3a).fillRect(0, 4, 2, 4).fillRect(3, 1, 2, 7).fillRect(6, 3, 2, 5);
  g.fillStyle(0x6fd36f).fillRect(3, 0, 1, 3);
  generate(scene, g, 'grass-tuft', 8, 8);
}

export function prepareAssets(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  createTiles(scene, g);
  createScenery(scene, g);
  g.destroy();
  createAdventurers(scene);
  createMonsterTextures(scene);
  registerAssets(scene);
}
