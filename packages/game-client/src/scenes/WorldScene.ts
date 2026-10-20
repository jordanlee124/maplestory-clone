import { MAPS, type MapDef } from '@cindervale/content';
import type { PlayerView } from '@cindervale/protocol';
import type { Room } from '@colyseus/sdk';
import Phaser from 'phaser';
import { createControls } from '../input/controls';
import { LocalPlayer } from '../player/LocalPlayer';
import { RemotePlayers } from '../player/RemotePlayers';
import { DebugOverlay } from '../ui/DebugOverlay';
import { GameMenu } from '../ui/GameMenu';
import { VIEWPORT } from '../viewport';
import { renderMap } from '../world/MapRenderer';

export interface WorldHooks {
  /** Leave the world (back to character select). */
  onExit: () => void;
}

/** The playable map. Wires together rendering, the local player, others, and the UI. */
export class WorldScene extends Phaser.Scene {
  private room!: Room;
  private map!: MapDef;
  private me!: LocalPlayer;
  private others!: RemotePlayers;
  private debug!: DebugOverlay;
  private menu!: GameMenu;
  private status!: Phaser.GameObjects.Text;

  constructor() {
    super('World');
  }

  create() {
    this.room = this.registry.get('room') as Room;
    const hooks = this.registry.get('hooks') as WorldHooks;
    const players = this.players();
    const mine = players.get(this.room.sessionId)!;
    this.map = MAPS[this.room.state.mapId as string]!;

    renderMap(this, this.map);
    this.me = new LocalPlayer(this, this.room, createControls(this), mine, this.map.geometry);
    this.others = new RemotePlayers(this);
    this.cameras.main
      .setBounds(0, 0, this.map.geometry.width, this.map.geometry.height)
      .startFollow(this.me.avatar.sprite, true, 0.15, 0.15);

    this.debug = new DebugOverlay(this);
    this.input.keyboard!.on('keydown-F3', () => this.debug.toggle());
    this.menu = new GameMenu(this, [
      { label: 'Resume', action: () => {} },
      { label: 'Toggle debug (F3)', action: () => this.debug.toggle() },
      { label: 'Exit to character select', action: hooks.onExit },
    ]);
    this.status = this.add
      .text(VIEWPORT.width / 2, 24, '', {
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
    this.showMapName();

    this.room.onStateChange(() => {
      const me = players.get(this.room.sessionId);
      if (me) this.me.reconcile(me);
    });
    this.room.onDrop(() => this.showStatus('Connection lost — reconnecting…'));
    this.room.onReconnect(() => this.showStatus(null));
    this.room.onLeave(() => this.showStatus('Disconnected. Refresh to rejoin.'));
  }

  override update(time: number, delta: number) {
    this.me.update(time, !this.menu.isOpen);
    this.others.sync(this.players(), this.room.sessionId, delta);
    this.debug.update({
      body: this.me.body,
      mapId: this.map.id,
      pendingInputs: this.me.predictor.pendingCount,
      players: this.others.count,
    });
  }

  private players() {
    return this.room.state.players as Map<string, PlayerView>;
  }

  private showMapName() {
    const banner = this.add
      .text(VIEWPORT.width / 2, 120, this.map.name, {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#fff8e1',
        stroke: '#78350f',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: 1500,
      duration: 800,
      onComplete: () => banner.destroy(),
    });
  }

  private showStatus(text: string | null) {
    this.status.setText(text ?? '').setVisible(text !== null);
  }
}
