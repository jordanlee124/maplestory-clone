import type { DropView } from '@cindervale/protocol';
import type Phaser from 'phaser';

export class Drops {
  private entries = new Map<string, Phaser.GameObjects.Rectangle>();
  constructor(private readonly scene: Phaser.Scene) {}

  sync(drops: Map<string, DropView>) {
    for (const [id, d] of drops) {
      if (!this.entries.has(id))
        this.entries.set(
          id,
          this.scene.add
            .rectangle(d.x, d.y - 6, 8, 8, d.itemId ? 0xb9e5b4 : 0xffdd74)
            .setStrokeStyle(1, 0x483b37)
            .setDepth(7),
        );
      this.entries.get(id)!.setPosition(Math.round(d.x), Math.round(d.y - 6));
    }
    for (const [id, sprite] of this.entries)
      if (!drops.has(id)) {
        sprite.destroy();
        this.entries.delete(id);
      }
  }
}
