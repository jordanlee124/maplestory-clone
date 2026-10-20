import { bodyState, type Body } from '@cindervale/game-core';
import type Phaser from 'phaser';

export interface DebugInfo {
  body: Body;
  mapId: string;
  pendingInputs: number;
  players: number;
}

/** Top-left diagnostics: FPS, position, player state. Toggle with F3. */
export class DebugOverlay {
  private readonly text: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    this.text = scene.add
      .text(8, 8, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#e8ffe8',
        backgroundColor: '#000a',
        lineSpacing: 2,
      })
      .setPadding(6, 4, 6, 4)
      .setScrollFactor(0)
      .setDepth(90);
  }

  get visible() {
    return this.text.visible;
  }

  toggle() {
    this.text.setVisible(!this.text.visible);
  }

  update({ body: b, mapId, pendingInputs, players }: DebugInfo) {
    if (!this.text.visible) return;
    const yes = (v: boolean) => (v ? 'yes' : 'no');
    this.text.setText([
      `FPS ${Math.round(this.scene.game.loop.actualFps)}`,
      `pos ${b.x.toFixed(1)}, ${b.y.toFixed(1)}  vel ${b.vx.toFixed(0)}, ${b.vy.toFixed(0)}`,
      `state ${bodyState(b)}  grounded ${yes(b.grounded)}  climbing ${yes(b.climbing)}`,
      `map ${mapId}  players ${players + 1}  unacked inputs ${pendingInputs}`,
      'F3 debug · Esc menu',
    ]);
  }
}
