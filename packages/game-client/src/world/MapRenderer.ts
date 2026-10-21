import type { MapDef } from '@cindervale/content';
import type Phaser from 'phaser';
import { assetByKey } from '../art/manifest';

/** Deterministic pseudo-random in [0, 1) so decorations are stable across reloads. */
const hash = (n: number) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/** Draws a map from its content definition: parallax backdrop, platforms, ladders, decor. */
export function renderMap(scene: Phaser.Scene, def: MapDef) {
  const { width, height, platforms, ladders } = def.geometry;
  const { theme } = def;
  scene.cameras.main.setBackgroundColor(theme.sky);

  for (let i = 0; i * 300 < width; i++) {
    scene.add
      .image(i * 300 + hash(i) * 120, 60 + hash(i + 50) * 140, 'cloud')
      .setOrigin(0, 0)
      .setScrollFactor(0.1, 1)
      .setAlpha(0.9);
  }
  scene.add
    .tileSprite(0, height - 420, width, 256, 'bg-hills-far')
    .setOrigin(0, 0)
    .setScrollFactor(0.2, 1)
    .setTint(theme.hillsFar);
  // Fill below the far hills so no sky shows between them and the ground.
  scene.add
    .rectangle(0, height - 166, width, 166, theme.hillsFar)
    .setOrigin(0, 0)
    .setScrollFactor(0.2, 1);
  scene.add
    .tileSprite(0, height - 280, width, 200, 'bg-hills-near')
    .setOrigin(0, 0)
    .setScrollFactor(0.5, 1)
    .setTint(theme.hillsNear);

  // Ladders sit behind platforms and poke a few pixels above the top they lead to.
  const ladderOrigin = assetByKey('ladder').origin;
  for (const l of ladders) {
    scene.add
      .tileSprite(l.x, l.top - 12, 16, l.bottom - l.top + 12, 'ladder')
      .setOrigin(ladderOrigin.x, ladderOrigin.y);
  }

  const groundY = Math.max(...platforms.map((p) => p.y));
  platforms.forEach((p, i) => {
    scene.add.tileSprite(p.x, p.y, p.width, 32, 'tile-grass').setOrigin(0, 0);
    if (p.y === groundY) {
      scene.add.tileSprite(p.x, p.y + 32, p.width, height - p.y - 32, 'tile-dirt').setOrigin(0, 0);
    }
    for (let x = p.x + 10; x < p.x + p.width - 10; x += 26) {
      const r = hash(i * 1000 + x);
      if (r < 0.25) continue;
      const key = r < 0.55 ? 'grass-tuft' : r < 0.8 ? 'flower-pink' : 'flower-white';
      const origin = assetByKey(key).origin;
      scene.add
        .image(Math.round(x + r * 12), p.y, key)
        .setOrigin(origin.x, origin.y)
        .setDepth(5);
    }
  });
}
