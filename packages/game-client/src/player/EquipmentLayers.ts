import type Phaser from 'phaser';
import {
  ASSETS,
  assetByKey,
  EQUIPMENT_DEPTH,
  validateEquipment,
  type ArtAsset,
  type SheetAsset,
} from '../art/manifest';

/** Presentation only. Server equipment stats/ownership are not inferred from these layers. */
export class EquipmentLayers {
  private sprites: Phaser.GameObjects.Sprite[] = [];
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly body: Phaser.GameObjects.Sprite,
    private readonly rig: SheetAsset,
    private readonly assets: readonly ArtAsset[] = ASSETS,
  ) {}

  set(keys: readonly string[]) {
    const layers = keys.map((key) => {
      const asset = assetByKey(key, this.assets);
      if (asset.type !== 'sheet') throw new Error(`${key}: equipment must be a sheet`);
      return asset;
    });
    validateEquipment(this.rig, layers);
    for (const layer of layers) {
      if (layer.status === 'missing' || !this.scene.textures.exists(layer.key))
        throw new Error(`${layer.key}: equipment art not loaded`);
    }
    this.destroy();
    this.sprites = layers.map((layer) =>
      this.scene.add
        .sprite(this.body.x, this.body.y, layer.key, this.body.frame.name)
        .setOrigin(layer.origin.x, layer.origin.y)
        .setDepth(this.body.depth + EQUIPMENT_DEPTH[layer.slot!]),
    );
    this.sync();
  }

  sync() {
    for (const sprite of this.sprites) {
      sprite
        .setPosition(this.body.x, this.body.y)
        .setFrame(this.body.frame.name)
        .setFlip(this.body.flipX, this.body.flipY)
        .setScale(this.body.scaleX, this.body.scaleY)
        .setRotation(this.body.rotation)
        .setAlpha(this.body.alpha)
        .setVisible(this.body.visible);
      const colors = [
        this.body.tintTopLeft,
        this.body.tintTopRight,
        this.body.tintBottomLeft,
        this.body.tintBottomRight,
      ] as const;
      if (this.body.tintFill) sprite.setTintFill(...colors);
      else sprite.setTint(...colors);
    }
  }

  destroy() {
    this.sprites.forEach((sprite) => sprite.destroy());
    this.sprites = [];
  }

  snapshot() {
    return this.sprites.map((s) => ({
      key: s.texture.key,
      frame: s.frame.name,
      x: s.x,
      y: s.y,
      flipX: s.flipX,
      tint: s.tintTopLeft,
      depth: s.depth,
    }));
  }
}
