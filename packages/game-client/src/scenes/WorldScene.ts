import { BASIC_ATTACK_ID, MAPS, type MapDef } from '@cindervale/content';
import {
  ClientMessage,
  type PlayerView,
  type MonsterView,
  type DropView,
} from '@cindervale/protocol';
import type { Room } from '@colyseus/sdk';
import Phaser from 'phaser';
import { createControls } from '../input/controls';
import { LocalPlayer } from '../player/LocalPlayer';
import { RemotePlayers } from '../player/RemotePlayers';
import { DebugOverlay } from '../ui/DebugOverlay';
import { GameMenu } from '../ui/GameMenu';
import { VIEWPORT } from '../viewport';
import { renderMap } from '../world/MapRenderer';
import { CombatController } from '../combat/controller';
import { combatEvents, type CombatEvent, type CombatEvents } from '../combat/events';
import { CombatEffects } from '../combat/effects';
import { DEFAULT_BINDINGS, type Keybindings } from '../input/bindings';
import { Monsters } from '../world/Monsters';
import { Drops } from '../world/Drops';
import { CombatHud } from '../ui/CombatHud';
import { cameraZoom } from '../visuals/model';

export interface WorldHooks {
  /** Leave the world (back to character select). */
  onExit: () => void;
  bindings?: () => Keybindings;
  inputEnabled?: () => boolean;
  cameraZoom?: number;
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
  private controls!: ReturnType<typeof createControls>;
  private combat!: CombatController;
  private eventsFeed!: CombatEvents;
  private effects!: CombatEffects;
  private monsters!: Monsters;
  private drops!: Drops;
  private hud!: CombatHud;
  private hooks!: WorldHooks;
  private latency?: number;
  private connected = true;
  private accepted = 0;
  private remoteAccepted = 0;
  private hitCount = 0;
  private playerHitCount = 0;
  private lastAttack?: { skillId: string; hits: number; monsterIds: string[] };

  constructor() {
    super('World');
  }

  create() {
    this.room = this.registry.get('room') as Room;
    const hooks = this.registry.get('hooks') as WorldHooks;
    this.hooks = hooks;
    const players = this.players();
    const mine = players.get(this.room.sessionId)!;
    this.map = MAPS[this.room.state.mapId as string]!;

    renderMap(this, this.map);
    this.controls = createControls(this, () => hooks.bindings?.() ?? DEFAULT_BINDINGS);
    this.me = new LocalPlayer(this, this.room, this.controls, mine, this.map.geometry);
    this.others = new RemotePlayers(this);
    this.combat = new CombatController(mine.classId);
    this.eventsFeed = combatEvents.get(this.room)!;
    if (this.eventsFeed.stats) this.combat.setLearned(this.eventsFeed.stats.skills);
    this.effects = new CombatEffects(this);
    this.monsters = new Monsters(this, this.effects);
    this.drops = new Drops(this);
    this.monsters.sync(this.monsterViews());
    this.others.sync(players, this.room.sessionId, 100);
    this.hud = new CombatHud(this);
    this.cameras.main
      .setRoundPixels(true)
      .setZoom(cameraZoom(hooks.cameraZoom ?? 1))
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

    const stateChanged = () => {
      const me = players.get(this.room.sessionId);
      if (me) this.me.reconcile(me);
    };
    const dropped = () => {
      this.connected = false;
      this.latency = undefined;
      this.controls.clear();
      this.combat.clear();
      this.showStatus('Connection lost — reconnecting…');
    };
    const reconnected = () => {
      this.connected = true;
      this.showStatus(null);
    };
    const left = () => {
      this.connected = false;
      this.showStatus('Disconnected. Refresh to rejoin.');
    };
    this.room.onStateChange(stateChanged);
    this.room.onDrop(dropped);
    this.room.onReconnect(reconnected);
    this.room.onLeave(left);
    const offCombat = this.eventsFeed.subscribe((event) => this.onCombat(event));
    const ping = () => {
      if (this.connected)
        this.room.ping((ms) => {
          this.latency = ms;
        });
    };
    ping();
    this.time.addEvent({ delay: 2000, loop: true, callback: ping });
    this.events.once('shutdown', () => {
      this.room.onStateChange.remove(stateChanged);
      this.room.onDrop.remove(dropped);
      this.room.onReconnect.remove(reconnected);
      this.room.onLeave.remove(left);
      offCombat();
    });
  }

  override update(time: number, delta: number) {
    const enabled = this.connected && !this.menu.isOpen && (this.hooks.inputEnabled?.() ?? true);
    for (const action of this.controls.actions(enabled)) {
      if (action === 'attack') this.combat.queue(BASIC_ATTACK_ID, time);
      else if (action.startsWith('skill')) {
        const skill = this.combat.skills[Number(action.slice(-1)) - 1];
        if (skill) this.combat.queue(skill.id, time);
        else this.hud.message('No skill assigned to this slot.');
      } else if (action === 'potion1' || action === 'potion2')
        this.hud.message('Potion use is not available on this server yet.');
      else if (action === 'respawn' && this.me.dead) this.room.send(ClientMessage.Respawn, {});
      else if (action === 'pickup') this.pickup();
    }
    this.me.update(time, enabled, this.connected && this.room.connection.isOpen);
    this.others.sync(this.players(), this.room.sessionId, delta);
    const facing = this.me.facing;
    const request = this.combat.next(
      time,
      facing,
      enabled && !this.me.dead && !this.me.body.climbing,
    );
    if (request) {
      this.room.send(ClientMessage.Attack, request);
      this.me.avatar.attack(request.skillId !== BASIC_ATTACK_ID, request.facing);
    }
    this.monsters.sync(this.monsterViews());
    this.drops.sync(this.dropViews());
    const mine = this.players().get(this.room.sessionId);
    if (mine)
      this.hud.update(
        mine,
        this.combat,
        this.eventsFeed,
        this.hooks.bindings?.() ?? DEFAULT_BINDINGS,
        this.latency,
      );
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

  private monsterViews() {
    return this.room.state.monsters as Map<string, MonsterView>;
  }
  private dropViews() {
    return this.room.state.drops as Map<string, DropView>;
  }

  private avatar(sessionId: string) {
    return sessionId === this.room.sessionId ? this.me.avatar : this.others.get(sessionId);
  }

  private onCombat(event: CombatEvent) {
    const now = this.time.now;
    switch (event.type) {
      case 'attackResult': {
        const result = event.data;
        this.combat.confirm(result, this.room.sessionId, now);
        const avatar = this.avatar(result.sessionId);
        if (result.sessionId === this.room.sessionId) {
          this.accepted++;
          this.lastAttack = {
            skillId: result.skillId,
            hits: result.hits.length,
            monsterIds: result.hits.map((hit) => hit.monsterId),
          };
        } else {
          this.remoteAccepted++;
          avatar?.attack(result.skillId !== BASIC_ATTACK_ID, result.facing);
        }
        if (avatar)
          this.effects.attack(avatar.sprite.x, avatar.sprite.y, result.skillId, result.facing);
        for (const hit of result.hits) {
          const monster = this.monsterViews().get(hit.monsterId);
          if (monster) {
            this.effects.damage(monster.x, monster.y, hit.damage, hit.crit);
            this.monsters.hit(hit.monsterId);
          }
          this.hitCount++;
        }
        break;
      }
      case 'attackRejected':
        if (this.combat.reject(event.data)) this.me.avatar.animation.cancel();
        this.hud.message(`Attack rejected: ${event.data.reason.replaceAll('_', ' ')}`);
        break;
      case 'playerHit': {
        if (event.data.sessionId === this.room.sessionId) this.playerHitCount++;
        const avatar = this.avatar(event.data.sessionId);
        avatar?.hit();
        if (avatar)
          this.effects.damage(avatar.sprite.x, avatar.sprite.y, event.data.damage, false, true);
        // v3 reports landed monster attacks, but has no windup/attack-start event.
        this.monsters.attack(event.data.monsterId);
        break;
      }
      case 'playerDied':
        if (event.data.sessionId === this.room.sessionId) {
          this.me.dead = true;
          this.combat.clear();
        }
        break;
      case 'playerRespawned': {
        const p = this.players().get(event.data.sessionId);
        if (p) this.effects.burst(p.x, p.y, 0xa9edce);
        break;
      }
      case 'monsterKilled': {
        const m = this.monsterViews().get(event.data.monsterId);
        if (m) this.effects.burst(m.x, m.y, 0xe6d08d);
        break;
      }
      case 'levelUp': {
        const p = this.players().get(event.data.sessionId);
        if (p) this.effects.burst(p.x, p.y, 0xffdc77);
        if (event.data.sessionId === this.room.sessionId)
          this.hud.message(`Level ${event.data.level}!`);
        break;
      }
      case 'itemPickedUp':
        if (event.data.sessionId === this.room.sessionId)
          this.hud.message(`Picked up ${event.data.quantity} ${event.data.itemId ?? 'coins'}`);
        break;
      case 'pickupRejected':
        this.hud.message(`Pickup: ${event.data.reason.replaceAll('_', ' ')}`);
        break;
      case 'characterStats':
        this.combat.setLearned(event.data.skills);
        break;
    }
  }

  private pickup() {
    const p = this.me.body;
    const nearest = [...this.dropViews().values()].sort(
      (a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
    )[0];
    if (nearest) this.room.send(ClientMessage.Pickup, { dropId: nearest.dropId });
  }

  /** Read-only browser test diagnostics. */
  combatSnapshot() {
    return {
      connected: this.connected,
      facing: this.me.facing,
      queuedMessages: this.room.reconnection.enqueuedMessages.length,
      accepted: this.accepted,
      remoteAccepted: this.remoteAccepted,
      hits: this.hitCount,
      playerHits: this.playerHitCount,
      lastAttack: this.lastAttack,
      latency: this.latency,
      exp: this.eventsFeed?.exp,
      inventory: this.eventsFeed?.inventory,
      monsters: [...this.monsterViews().entries()].map(([id, m]) => ({
        id,
        monsterId: m.monsterId,
        x: m.x,
        y: m.y,
        hp: m.hp,
        maxHp: m.maxHp,
        mode: m.mode,
      })),
      renderedMonsters: this.monsters.snapshot(),
    };
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
