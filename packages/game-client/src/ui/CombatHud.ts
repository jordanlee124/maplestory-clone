import { BASIC_ATTACK_ID, SKILLS } from '@cindervale/content';
import type { PlayerView } from '@cindervale/protocol';
import type Phaser from 'phaser';
import type { CombatController } from '../combat/controller';
import type { CombatEvents } from '../combat/events';
import { keyLabel, type Keybindings } from '../input/bindings';
import { VIEWPORT } from '../viewport';
import { liveVisual } from '../visuals/approvedAssets';

export class CombatHud {
  private stats: Phaser.GameObjects.Text;
  private bars: Phaser.GameObjects.Graphics;
  private slots: Phaser.GameObjects.Text[];
  private notice: Phaser.GameObjects.Text;
  private noticeUntil = 0;
  private panel?: Phaser.GameObjects.Image;

  constructor(private readonly scene: Phaser.Scene) {
    if (scene.registry.get('approvedArt')) {
      const art = liveVisual('ui-panel');
      this.panel = scene.add
        .image(856, 0, art.key, 'still')
        .setOrigin(0)
        .setDisplaySize(424, 424 / 3)
        .setScrollFactor(0)
        .setDepth(99);
    }
    this.bars = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.stats = scene.add
      .text(this.panel ? 950 : VIEWPORT.width - 306, this.panel ? 49 : 12, '', {
        fontFamily: 'monospace',
        fontSize: this.panel ? '11px' : '14px',
        color: '#fff6df',
        lineSpacing: this.panel ? 2 : 10,
      })
      .setScrollFactor(0)
      .setDepth(101);
    this.slots = Array.from({ length: 7 }, (_, i) =>
      scene.add
        .text(12 + i * 178, VIEWPORT.height - 57, '', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#fff6df',
          backgroundColor: '#252238',
        })
        .setPadding(7, 6)
        .setFixedSize(172, 49)
        .setScrollFactor(0)
        .setDepth(100),
    );
    this.notice = scene.add
      .text(VIEWPORT.width / 2, 78, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffe8a8',
        backgroundColor: '#252238',
      })
      .setOrigin(0.5)
      .setPadding(8)
      .setScrollFactor(0)
      .setDepth(110)
      .setVisible(false);
  }

  message(text: string) {
    this.notice.setText(text).setVisible(true);
    this.noticeUntil = this.scene.time.now + 2300;
  }

  update(
    player: PlayerView,
    combat: CombatController,
    events: CombatEvents,
    keys: Keybindings,
    latency?: number,
  ) {
    const now = this.scene.time.now;
    this.notice.setVisible(now < this.noticeUntil);
    const exp = events.exp;
    const expText = exp ? (exp.expToNext === 0 ? 'MAX' : `${exp.exp}/${exp.expToNext}`) : 'syncing';
    this.stats.setText([
      `Lv ${player.level}  ${player.name}  ${latency === undefined ? '—' : latency} ms`,
      `HP ${player.hp}/${player.maxHp}`,
      `MP ${player.mp}/${player.maxMp}`,
      `EXP ${expText}  •  ${events.inventory?.currency ?? 0} coins`,
    ]);
    this.bars.clear();
    if (!this.panel)
      this.bars.fillStyle(0x252238, 0.94).fillRect(VIEWPORT.width - 320, 4, 312, 124);
    const barX = this.panel ? 950 : VIEWPORT.width - 306;
    const bar = (y: number, value: number, max: number, color: number) => {
      this.bars.fillStyle(0x111522).fillRect(barX, y, 280, 4);
      this.bars
        .fillStyle(color)
        .fillRect(barX, y, Math.round(280 * Math.max(0, Math.min(1, max ? value / max : 1))), 4);
    };
    bar(this.panel ? 76 : 57, player.hp, player.maxHp, 0xf09182);
    bar(this.panel ? 91 : 83, player.mp, player.maxMp, 0x93b9fa);
    bar(this.panel ? 106 : 112, exp?.exp ?? 0, exp?.expToNext ?? 1, 0xe6d08d);
    const skills = [
      SKILLS[BASIC_ATTACK_ID],
      ...Array.from({ length: 4 }, (_, i) => combat.skills[i]),
    ];
    const bindings = [keys.attack, keys.skill1, keys.skill2, keys.skill3, keys.skill4];
    skills.forEach((skill, i) => {
      const remaining = skill ? combat.remaining(skill.id, now) : 0;
      this.slots[i]!.setText(
        `[${keyLabel(bindings[i]!)}] ${skill?.name ?? 'Empty'}\n${!skill ? 'No skill assigned' : remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : `Ready • ${skill.mpCost} MP`}`,
      ).setColor(!skill || remaining > 0 ? '#b4b0c6' : '#fff6df');
    });
    this.slots[5]!.setText(
      `[${keyLabel(keys.potion1)}] HP potion\nServer support pending`,
    ).setColor('#b4b0c6');
    this.slots[6]!.setText(
      `[${keyLabel(keys.potion2)}] MP potion\nServer support pending`,
    ).setColor('#b4b0c6');
    if (player.dead) this.message(`Defeated • [${keyLabel(keys.respawn)}] Respawn (after 2s)`);
  }

  snapshot() {
    return { panel: this.panel?.texture.key, stats: this.stats.text };
  }
}
