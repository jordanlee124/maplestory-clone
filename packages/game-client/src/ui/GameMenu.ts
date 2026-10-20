import Phaser from 'phaser';
import { VIEWPORT } from '../viewport';

export interface MenuItem {
  label: string;
  action: () => void;
}

/**
 * Esc menu. The world keeps running underneath (it's an MMO), but the player's character
 * receives neutral input while the menu is open. Navigate with ↑/↓ + Enter, or click
 * (not Space: it would also trigger a jump as the menu closes).
 */
export class GameMenu {
  private readonly container: Phaser.GameObjects.Container;
  private readonly labels: Phaser.GameObjects.Text[];
  private selected = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly items: MenuItem[],
  ) {
    const { width, height } = VIEWPORT;
    const panelH = 70 + items.length * 44;
    const top = (height - panelH) / 2;

    const shade = scene.add.rectangle(0, 0, width, height, 0x000000, 0.45).setOrigin(0, 0);
    const panel = scene.add
      .rectangle(width / 2, height / 2, 320, panelH, 0xfff8e1)
      .setStrokeStyle(4, 0x78350f);
    const title = scene.add
      .text(width / 2, top + 18, 'Menu', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#451a03',
      })
      .setOrigin(0.5, 0);
    this.labels = items.map((item, i) =>
      scene.add
        .text(width / 2, top + 70 + i * 44, item.label, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#451a03',
        })
        .setOrigin(0.5, 0)
        .setPadding(12, 6, 12, 6)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.select(i))
        .on('pointerdown', () => this.choose(i)),
    );

    this.container = scene.add
      .container(0, 0, [shade, panel, title, ...this.labels])
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);

    const kb = scene.input.keyboard!;
    kb.on('keydown-ESC', () => this.toggle());
    kb.on('keydown-UP', () => this.isOpen && this.select(this.selected - 1));
    kb.on('keydown-DOWN', () => this.isOpen && this.select(this.selected + 1));
    kb.on('keydown-ENTER', () => this.isOpen && this.choose(this.selected));
    this.select(0);
  }

  get isOpen() {
    return this.container.visible;
  }

  toggle(open = !this.isOpen) {
    this.container.setVisible(open);
    if (open) this.select(0);
  }

  private select(i: number) {
    this.selected = Phaser.Math.Wrap(i, 0, this.items.length);
    this.labels.forEach((label, j) =>
      label.setBackgroundColor(j === this.selected ? '#fbbf24' : 'transparent'),
    );
  }

  private choose(i: number) {
    this.toggle(false);
    this.items[i]!.action();
  }
}
