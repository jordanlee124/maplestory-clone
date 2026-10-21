import type Phaser from 'phaser';
import { ASSETS, frameRect, validateAsset, type ArtAsset } from './manifest';

/** Only explicitly approved files enter Phaser's network loader. */
export function queueAssets(scene: Phaser.Scene, assets: readonly ArtAsset[] = ASSETS) {
  const keys = new Set<string>();
  for (const asset of assets) {
    validateAsset(asset);
    if (keys.has(asset.key)) throw new Error(`Duplicate asset key: ${asset.key}`);
    keys.add(asset.key);
    if (asset.status !== 'approved' || scene.textures.exists(asset.key)) continue;
    if (asset.type === 'image') scene.load.image(asset.key, asset.url);
    else
      scene.load.spritesheet(asset.key, asset.url, {
        frameWidth: asset.cell.width,
        frameHeight: asset.cell.height,
      });
  }
}

/** Shared by file-loaded sheets, procedural fallbacks and the art review board. */
export function registerAssets(scene: Phaser.Scene, assets: readonly ArtAsset[] = ASSETS) {
  for (const asset of assets) {
    validateAsset(asset);
    if (asset.status === 'missing') continue;
    if (!scene.textures.exists(asset.key))
      throw new Error(`Art asset failed to load: ${asset.key}`);
    const texture = scene.textures.get(asset.key);
    const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const width = asset.type === 'image' ? asset.size.width : asset.columns * asset.cell.width;
    const height =
      asset.type === 'image'
        ? asset.size.height
        : Math.ceil(asset.frames.length / asset.columns) * asset.cell.height;
    if (source.width !== width || source.height !== height)
      throw new Error(
        `${asset.key}: expected ${width}x${height}, received ${source.width}x${source.height}`,
      );
    texture.setFilter(1); // Phaser.Textures.FilterMode.NEAREST (verified against installed Phaser).
    if (asset.type !== 'sheet') continue;
    for (const frame of asset.frames) {
      const r = frameRect(asset, frame);
      if (!texture.has(frame)) texture.add(frame, 0, r.x, r.y, r.width, r.height);
    }
    for (const clip of asset.clips) {
      const key = `${asset.key}-${clip.name}`;
      if (scene.anims.exists(key)) continue;
      // Phaser frame.duration adds to the base interval; subtract it for exact clip timing.
      const baseMs = Math.min(...clip.durationsMs);
      scene.anims.create({
        key,
        frameRate: 1000 / baseMs,
        repeat: clip.repeat,
        frames: clip.frames.map((frame, i) => ({
          key: asset.key,
          frame,
          duration: clip.durationsMs[i]! - baseMs,
        })),
      });
    }
  }
}
