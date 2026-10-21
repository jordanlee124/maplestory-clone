import Phaser from 'phaser';
import { createPixelGame } from '../pixelGame';
import { EquipmentLayers } from '../player/EquipmentLayers';
import { ASSETS, CHARACTER_FRAMES, type SheetAsset } from './manifest';
import { queueAssets, registerAssets } from './pipeline';
import { prepareAssets } from './textures';

/** Deterministic asset review board, separate from the live room and game rules. */
export function startArtPreview(parent: HTMLElement) {
  let base: Phaser.GameObjects.Sprite;
  let equipment: EquipmentLayers;
  class ArtPreview extends Phaser.Scene {
    constructor() {
      super('ArtPreview');
    }
    preload() {
      queueAssets(this);
    }
    create() {
      prepareAssets(this);
      this.cameras.main.setBackgroundColor('#202738').setRoundPixels(true);
      const label = (x: number, y: number, text: string, size = 12) =>
        this.add.text(x, y, text, {
          fontFamily: 'monospace',
          fontSize: `${size}px`,
          color: '#e8dfc7',
        });
      label(16, 10, 'CINDERVALE • ART FOUNDATION / asset review board', 18);
      label(
        16,
        36,
        `Native 64×64 cells • feet (32,64) • ${ASSETS.filter((a) => a.status === 'approved').length} approved assets • source art never rescaled`,
      );
      CHARACTER_FRAMES.forEach((name, i) => label(100 + i * 64, 59, name, 10));
      const characters = ASSETS.filter(
        (a): a is SheetAsset => a.type === 'sheet' && a.kind === 'character',
      );
      characters.forEach((asset, row) => {
        label(4, 96 + row * 72, asset.key.replace('adventurer-', '').replace('-', '\n'), 10);
        asset.frames.forEach((frame, i) =>
          this.add
            .sprite(132 + i * 64, 140 + row * 72, asset.key, frame)
            .setOrigin(asset.origin.x, asset.origin.y),
        );
      });
      const monsters = ASSETS.filter(
        (a): a is SheetAsset => a.type === 'sheet' && a.kind === 'monster',
      );
      monsters.forEach((asset, row) => {
        label(4, 404 + row * 72, asset.key.replace('-', '\n'), 10);
        asset.frames.forEach((frame, i) => {
          if (row === 0) label(100 + i * 64, 378, frame, 10);
          this.add
            .sprite(132 + i * 64, 456 + row * 72, asset.key, frame)
            .setOrigin(asset.origin.x, asset.origin.y);
        });
      });
      label(600, 377, 'Fernreach terrain / scenery — PLACEHOLDER');
      this.add.image(600, 412, 'bg-hills-far').setOrigin(0).setTint(0xa6d98c);
      this.add.image(600, 468, 'bg-hills-near').setOrigin(0).setTint(0x6cbf5a);
      [
        'tile-grass',
        'tile-dirt',
        'ladder',
        'cloud',
        'flower-pink',
        'flower-white',
        'grass-tuft',
      ].forEach((key, i) => {
        label(600 + i * 90, 394, key, 9);
        this.add.image(600 + i * 90, 410, key).setOrigin(0);
      });
      label(
        16,
        614,
        'QA equipment registration markers (not game art) • shared poses / flip / flash / rear/front depth',
      );
      const rig = characters[0]!;
      const fixtures: SheetAsset[] = (['cape', 'headgear'] as const).map((slot) => ({
        ...rig,
        kind: 'equipment',
        slot,
        key: `qa-${slot}`,
      }));
      fixtures.forEach((fixture, index) => {
        const tex = this.textures.createCanvas(fixture.key, 64 * CHARACTER_FRAMES.length, 64)!;
        const ctx = tex.context;
        ctx.fillStyle = index === 0 ? '#75d9ed' : '#ffcb78';
        CHARACTER_FRAMES.forEach((_, i) => {
          ctx.fillRect(i * 64 + (index === 0 ? 12 : 46), 12, 2, 52);
          ctx.fillRect(i * 64 + (index === 0 ? 12 : 32), 62, 16, 2);
        });
        tex.refresh();
      });
      registerAssets(this, fixtures);
      base = this.add.sprite(132, 704, rig.key, 'idle0').setOrigin(0.5, 1).setDepth(10);
      equipment = new EquipmentLayers(this, base, rig, fixtures);
      equipment.set(fixtures.map((f) => f.key));
      label(
        200,
        650,
        'Base + rear cape + front headgear\nMissing final layers remain absent in gameplay.',
      );
      const diagnostics = window as unknown as { cindervaleArt?: unknown };
      diagnostics.cindervaleArt = () => ({
        scale: this.scale.zoom,
        cameraZoom: this.cameras.main.zoom,
        roundPixels: this.cameras.main.roundPixels,
        assets: ASSETS.map((a) => ({
          key: a.key,
          status: a.status,
          loaded: this.textures.exists(a.key),
          nearest: this.textures.exists(a.key)
            ? this.textures.get(a.key).source[0]!.scaleMode === Phaser.Textures.FilterMode.NEAREST
            : false,
        })),
        body: {
          frame: base.frame.name,
          x: base.x,
          y: base.y,
          flipX: base.flipX,
          tint: base.tintTopLeft,
          depth: base.depth,
        },
        equipment: equipment.snapshot(),
      });
      parent.dataset.ready = 'true';
      this.events.once('shutdown', () => {
        delete diagnostics.cindervaleArt;
        equipment.destroy();
      });
    }
    override update(time: number) {
      if (!base) return;
      base
        .setFrame(CHARACTER_FRAMES[Math.floor(time / 100) % CHARACTER_FRAMES.length]!)
        .setFlipX(Math.floor(time / 900) % 2 === 1);
      if (Math.floor(time / 600) % 2) base.setTintFill(0xffeeee);
      else base.clearTint();
      equipment.sync();
    }
  }
  const game = createPixelGame(parent, [ArtPreview]);
  return () => {
    game.scene.stop('ArtPreview');
    game.destroy(true);
    delete parent.dataset.ready;
  };
}
