import { MONSTERS } from '@cindervale/content';
import type { MonsterView } from '@cindervale/protocol';
import type Phaser from 'phaser';
import type { CombatEffects } from '../combat/effects';
import { FEET_ORIGIN } from '../art/manifest';
import { liveVisual, FROG_VISUAL_SCALE } from '../visuals/approvedAssets';
import { MonsterAnimation } from '../visuals/monsterAnimation';

interface RenderedMonster {
  sprite: Phaser.GameObjects.Sprite;
  hp: Phaser.GameObjects.Rectangle;
  track: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  dead: boolean;
  hitUntil: number;
  attackUntil: number;
  defeatUntil: number;
  animation: MonsterAnimation;
}

export class Monsters {
  private entries = new Map<string, RenderedMonster>();
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: CombatEffects,
  ) {}

  sync(monsters: Map<string, MonsterView>) {
    const now = this.scene.time.now;
    for (const [id, m] of monsters) {
      const def = MONSTERS[m.monsterId];
      if (!def) continue;
      const painted = this.scene.registry.get('approvedArt') && m.monsterId === 'fern-frog';
      const art = painted ? liveVisual('fern-frog') : undefined;
      let entry = this.entries.get(id);
      if (!entry) {
        entry = {
          sprite: this.scene.add
            .sprite(m.x, m.y, m.monsterId, 'idle0')
            .setOrigin(FEET_ORIGIN.x, FEET_ORIGIN.y)
            .setDepth(8),
          track: this.scene.add.rectangle(m.x, m.y, 40, 5, 0x252238).setDepth(12),
          hp: this.scene.add
            .rectangle(m.x - 19, m.y, 38, 3, 0xf38d7d)
            .setOrigin(0, 0.5)
            .setDepth(13),
          label: this.scene.add
            .text(m.x, m.y, def.name, {
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#fff7d9',
              stroke: '#252238',
              strokeThickness: 3,
            })
            .setOrigin(0.5, 1)
            .setDepth(12),
          dead: m.mode === 'dead',
          hitUntil: 0,
          attackUntil: 0,
          defeatUntil: 0,
          animation: new MonsterAnimation(),
        };
        this.entries.set(id, entry);
        if (art) {
          const f = art.frames[0]!;
          entry.sprite
            .setTexture(art.key, f.name)
            .setOrigin(f.pivot.x / f.width, f.pivot.y / f.height)
            .setScale(FROG_VISUAL_SCALE);
        }
      }
      const dead = m.mode === 'dead';
      if (dead && !entry.dead) entry.defeatUntil = now + 280;
      if (!dead && entry.dead) this.effects.burst(m.x, m.y, 0xa9edce);
      entry.dead = dead;
      const recoil = now < entry.hitUntil ? -m.facing * Math.round((entry.hitUntil - now) / 40) : 0;
      entry.sprite
        .setPosition(Math.round(m.x) + recoil, Math.round(m.y))
        .setFlipX(painted ? m.facing > 0 : m.facing < 0);
      if (art) {
        // shortcut: missing frog action clips hold idle until the authored drawings are supplied.
        const { frame: f } = entry.animation.sample(art, m.mode, now, entry);
        entry.sprite.setFrame(f.name);
        entry.sprite.setOrigin(
          (entry.sprite.flipX ? f.width - f.pivot.x : f.pivot.x) / f.width,
          f.pivot.y / f.height,
        );
      }
      const frame = dead
        ? 'defeat'
        : now < entry.hitUntil
          ? 'hit'
          : now < entry.attackUntil
            ? 'attack'
            : `${m.mode === 'idle' ? 'idle' : 'move'}${Math.floor(now / 220) % 2}`;
      if (!art) entry.sprite.setFrame(frame);
      entry.sprite
        .setVisible(!dead || now < entry.defeatUntil)
        .setAlpha(dead && painted ? Math.max(0, (entry.defeatUntil - now) / 280) : 1);
      if (now < entry.hitUntil) entry.sprite.setTintFill(0xffeeee);
      else entry.sprite.clearTint();
      const visualHeight = painted ? 62 : def.size.height;
      entry.track.setPosition(m.x, m.y - visualHeight - 8).setVisible(!dead);
      entry.hp
        .setPosition(m.x - 19, m.y - visualHeight - 8)
        .setDisplaySize(38 * Math.max(0, Math.min(1, m.hp / m.maxHp)), 3)
        .setVisible(!dead);
      entry.label.setPosition(m.x, m.y - visualHeight - 13).setVisible(!dead);
    }
    for (const [id, e] of this.entries) {
      if (monsters.has(id)) continue;
      e.sprite.destroy();
      e.hp.destroy();
      e.track.destroy();
      e.label.destroy();
      this.entries.delete(id);
    }
  }

  hit(id: string) {
    const e = this.entries.get(id);
    if (e) e.hitUntil = this.scene.time.now + 180;
  }

  attack(id: string) {
    const e = this.entries.get(id);
    if (e) e.attackUntil = this.scene.time.now + 240;
  }

  snapshot() {
    return [...this.entries].map(([id, e]) => ({
      id,
      frame: e.sprite.frame.name,
      texture: e.sprite.texture.key,
      visible: e.sprite.visible,
      hpWidth: e.hp.displayWidth,
    }));
  }
}
