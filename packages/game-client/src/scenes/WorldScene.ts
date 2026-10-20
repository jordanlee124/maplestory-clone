import { MAPS } from '@cindervale/content';
import { FIXED_DT, type MapGeometry, type MoveInput } from '@cindervale/game-core';
import { ClientMessage, type PlayerView } from '@cindervale/protocol';
import type { Room } from '@colyseus/sdk';
import Phaser from 'phaser';
import { Predictor } from '../predictor';
import { CLASS_COLORS } from './PreloadScene';

interface Avatar {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

type Keys = Record<'left' | 'right' | 'a' | 'd' | 'space' | 'alt', Phaser.Input.Keyboard.Key>;

/** The playable map: renders the world, predicts the local player, interpolates others. */
export class WorldScene extends Phaser.Scene {
  private room!: Room;
  private map!: MapGeometry;
  private predictor!: Predictor;
  private me!: Avatar;
  private others = new Map<string, Avatar>();
  private keys!: Keys;
  private accumulator = 0;
  private lastTime?: number;
  private status!: Phaser.GameObjects.Text;

  constructor() {
    super('World');
  }

  create() {
    this.room = this.registry.get('room') as Room;
    const players = this.room.state.players as Map<string, PlayerView>;
    const mine = players.get(this.room.sessionId)!;
    this.map = MAPS[this.room.state.mapId as string]!.geometry;
    this.predictor = new Predictor({ ...mine }, mine.lastSeq + 1, this.map);

    this.drawWorld();
    this.me = this.createAvatar(mine);
    this.cameras.main
      .setBounds(0, 0, this.map.width, this.map.height)
      .startFollow(this.me.sprite, true);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({
      left: 'LEFT',
      right: 'RIGHT',
      a: 'A',
      d: 'D',
      space: 'SPACE',
      alt: 'ALT',
    }) as Keys;

    this.status = this.add
      .text(640, 24, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#fff',
        backgroundColor: '#000a',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setPadding(8, 4, 8, 4)
      .setVisible(false);

    this.room.onStateChange(() => {
      const me = players.get(this.room.sessionId);
      if (me) this.predictor.reconcile(me, me.lastSeq);
    });
    this.room.onDrop(() => this.showStatus('Connection lost — reconnecting…'));
    this.room.onReconnect(() => this.showStatus(null));
    this.room.onLeave(() => this.showStatus('Disconnected. Refresh to rejoin.'));
  }

  override update(time: number, delta: number) {
    // Raw frame time, not Phaser's `delta`: Phaser caps delta at 16.7ms while the window is
    // unfocused, which would run the simulation in slow motion below 60 fps.
    const elapsed = this.lastTime === undefined ? 0 : time - this.lastTime;
    this.lastTime = time;
    this.accumulator += Math.min(elapsed, 250) / 1000;
    while (this.accumulator >= FIXED_DT) {
      this.room.send(ClientMessage.Input, this.predictor.step(this.readInput()));
      this.accumulator -= FIXED_DT;
    }
    this.place(this.me, this.predictor.body.x, this.predictor.body.y, this.predictor.body.vx);
    this.syncOthers(delta);
  }

  private readInput(): MoveInput {
    const k = this.keys;
    return {
      left: k.left.isDown || k.a.isDown,
      right: k.right.isDown || k.d.isDown,
      jump: k.space.isDown || k.alt.isDown,
    };
  }

  private syncOthers(delta: number) {
    const players = this.room.state.players as Map<string, PlayerView>;
    // shortcut: exponential smoothing toward the latest snapshot; switch to a snapshot
    // interpolation buffer if remote movement looks jittery under real latency.
    const t = Math.min(1, delta / 80);
    for (const [sessionId, p] of players) {
      if (sessionId === this.room.sessionId) continue;
      let avatar = this.others.get(sessionId);
      if (!avatar) {
        avatar = this.createAvatar(p);
        this.others.set(sessionId, avatar);
      }
      const { sprite } = avatar;
      this.place(avatar, sprite.x + (p.x - sprite.x) * t, sprite.y + (p.y - sprite.y) * t, p.vx);
    }
    for (const [sessionId, avatar] of this.others) {
      if (players.has(sessionId)) continue;
      avatar.sprite.destroy();
      avatar.label.destroy();
      this.others.delete(sessionId);
    }
  }

  private createAvatar(p: PlayerView): Avatar {
    const key = p.classId in CLASS_COLORS ? `player-${p.classId}` : 'player-ember-knight';
    const sprite = this.add.image(p.x, p.y, key).setOrigin(0.5, 1).setDepth(10);
    const label = this.add
      .text(p.x, p.y + 4, p.name, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#fff',
        backgroundColor: '#0008',
      })
      .setOrigin(0.5, 0)
      .setPadding(3, 1, 3, 1)
      .setDepth(11);
    return { sprite, label };
  }

  private place({ sprite, label }: Avatar, x: number, y: number, vx: number) {
    sprite.setPosition(Math.round(x), Math.round(y));
    if (vx !== 0) sprite.setFlipX(vx < 0);
    label.setPosition(Math.round(x), Math.round(y) + 4);
  }

  private drawWorld() {
    const { width, height, platforms } = this.map;
    this.cameras.main.setBackgroundColor(0x9fd8ff);
    this.add
      .tileSprite(0, height - 420, width, 256, 'bg-hills-far')
      .setOrigin(0, 0)
      .setScrollFactor(0.2, 1);
    this.add
      .tileSprite(0, height - 280, width, 200, 'bg-hills-near')
      .setOrigin(0, 0)
      .setScrollFactor(0.5, 1);
    const groundY = Math.max(...platforms.map((p) => p.y));
    for (const p of platforms) {
      this.add.tileSprite(p.x, p.y, p.width, 32, 'tile-grass').setOrigin(0, 0);
      if (p.y === groundY)
        this.add.tileSprite(p.x, p.y + 32, p.width, height - p.y - 32, 'tile-dirt').setOrigin(0, 0);
    }
  }

  private showStatus(text: string | null) {
    this.status.setText(text ?? '').setVisible(text !== null);
  }
}
