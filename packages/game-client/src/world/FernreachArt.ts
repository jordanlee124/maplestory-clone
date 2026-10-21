import type Phaser from 'phaser';
import type { MapDef } from '@cindervale/content';
import { liveVisual, platformParts } from '../visuals/approvedAssets';

/** Painted geometry is fitted to existing support surfaces; no collision data is changed. */
export function renderFernreachArt(scene: Phaser.Scene, map: MapDef) {
  const { width, height, platforms } = map.geometry;
  const far = liveVisual('fern-far');
  const front = liveVisual('fern-front');
  const terrain = liveVisual('fern-platform');
  scene.cameras.main.setBackgroundColor('#d4e7da');
  const backdropWidth = 1280 + Math.max(0, width - 1280) * 0.12 + 192;
  const backdropHeight = (backdropWidth * far.size.height) / far.size.width;
  scene.add
    .image(-64, height - backdropHeight, far.key, 'still')
    .setOrigin(0)
    .setDisplaySize(backdropWidth, backdropHeight)
    .setScrollFactor(0.12, 1)
    .setAlpha(0.86);
  for (let x = -128; x < width * 0.65 + 1280; x += 1280) {
    scene.add
      .image(x, height - 792, front.key, 'still')
      .setOrigin(0)
      .setDisplaySize(1408, 792)
      .setScrollFactor(0.65, 1)
      .setDepth(6);
  }
  const texture = scene.textures.get(terrain.key);
  // shortcut: reuse reviewed plate crops; replace with authored seamless caps/fills after cleanup.
  if (!texture.has('left-cap')) {
    texture.add('left-cap', 0, 22, 0, 300, 758);
    texture.add('middle', 0, 400, 0, 1200, 758);
    texture.add('right-cap', 0, 1744, 0, 300, 758);
  }
  for (const p of platforms) {
    const { cap, middle } = platformParts(p.width);
    scene.add
      .image(p.x, p.y, terrain.key, 'left-cap')
      .setOrigin(0, 288 / 758)
      .setDisplaySize(cap, 189.5)
      .setDepth(2);
    if (middle > 0)
      scene.add
        .tileSprite(p.x + cap, p.y - 72, middle, 189.5, terrain.key, 'middle')
        .setOrigin(0)
        .setTileScale(0.25)
        .setDepth(2);
    scene.add
      .image(p.x + p.width - cap, p.y, terrain.key, 'right-cap')
      .setOrigin(0, 288 / 758)
      .setDisplaySize(cap, 189.5)
      .setDepth(2);
  }
}
