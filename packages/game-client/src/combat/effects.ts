import { BASIC_ATTACK_ID } from '@cindervale/content';
import type Phaser from 'phaser';
import { liveVisual } from '../visuals/approvedAssets';
import { playVisualEffect } from '../visuals/renderer';

/** Short, bounded effects; no full-screen flashes or camera shake. */
export class CombatEffects {
  private numbers: Phaser.GameObjects.Text[] = [];
  constructor(private readonly scene: Phaser.Scene) {}

  damage(x: number, y: number, damage: number, crit = false, player = false, height = 40) {
    const text = this.scene.add
      .text(
        Math.round(x),
        Math.round(y - (player && this.scene.registry.get('approvedArt') ? 104 : height)),
        `${crit ? '✦ ' : ''}${damage}`,
        {
          fontFamily: 'monospace',
          fontSize: crit ? '22px' : '17px',
          color: player ? '#ffb4ad' : crit ? '#ffe078' : '#ffffff',
          stroke: '#261c35',
          strokeThickness: 4,
        },
      )
      .setOrigin(0.5)
      .setDepth(30);
    this.numbers.push(text);
    if (this.numbers.length > 40) this.numbers.shift()!.destroy();
    this.scene.tweens.add({
      targets: text,
      y: text.y - 38,
      alpha: 0,
      duration: 650,
      onComplete: () => {
        this.numbers = this.numbers.filter((n) => n !== text);
        text.destroy();
      },
    });
  }

  burst(x: number, y: number, color: number) {
    const ring = this.scene.add
      .circle(x, y - 16, 12, color, 0)
      .setStrokeStyle(2, color, 0.8)
      .setDepth(20);
    this.scene.tweens.add({
      targets: ring,
      scale: 2,
      alpha: 0,
      duration: 280,
      onComplete: () => ring.destroy(),
    });
  }

  attack(x: number, y: number, skillId: string, facing: 'left' | 'right') {
    if (this.scene.registry.get('approvedArt')) {
      playVisualEffect(
        this.scene,
        liveVisual('skill-effect'),
        'play',
        x + (facing === 'left' ? -50 : 50),
        y - 8,
        18,
        facing === 'left',
      ).setScale(skillId === BASIC_ATTACK_ID ? 0.2 : 0.33);
      return;
    }
    const colors: Record<string, number> = {
      'flame-cleave': 0xffaa66,
      'gust-arrow': 0x9eeec0,
      'rune-burst': 0xb8b1ff,
      'twin-thorn': 0xe4a5ed,
    };
    const dir = facing === 'left' ? -1 : 1;
    const slash = this.scene.add
      .rectangle(
        x + dir * 25,
        y - 26,
        skillId === BASIC_ATTACK_ID ? 4 : 8,
        28,
        colors[skillId] ?? 0xfff3d6,
        0.7,
      )
      .setAngle(dir * 35)
      .setDepth(18);
    this.scene.tweens.add({
      targets: slash,
      x: slash.x + dir * 24,
      alpha: 0,
      duration: 140,
      onComplete: () => slash.destroy(),
    });
  }
}
