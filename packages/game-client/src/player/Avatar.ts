import { bodyState, type Body } from '@cindervale/game-core';
import type Phaser from 'phaser';
import { adventurerKey } from '../art/textures';

/** A player's sprite + name tag, animated from its physics body. */
export class Avatar {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private readonly classId: string;

  constructor(scene: Phaser.Scene, view: { name: string; classId: string; x: number; y: number }) {
    this.classId = view.classId;
    this.sprite = scene.add
      .sprite(view.x, view.y, adventurerKey(view.classId), 'idle0')
      .setOrigin(0.5, 1)
      .setDepth(10);
    this.label = scene.add
      .text(view.x, view.y + 4, view.name, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#fff',
        backgroundColor: '#0008',
      })
      .setOrigin(0.5, 0)
      .setPadding(3, 1, 3, 1)
      .setDepth(11);
  }

  /** Render position may differ from the body (smoothing); animation follows the body. */
  update(x: number, y: number, body: Body) {
    const [rx, ry] = [Math.round(x), Math.round(y)];
    this.sprite.setPosition(rx, ry);
    this.label.setPosition(rx, ry + 4);
    if (body.vx !== 0) this.sprite.setFlipX(body.vx < 0);

    const state = bodyState(body);
    this.sprite.play(`${adventurerKey(this.classId)}-${state}`, true);
    // Hang still on a ladder when not climbing.
    if (state === 'climb') {
      if (body.vy === 0) this.sprite.anims.pause();
      else this.sprite.anims.resume();
    }
  }

  destroy() {
    this.sprite.destroy();
    this.label.destroy();
  }
}
