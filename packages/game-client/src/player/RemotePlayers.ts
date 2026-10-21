import type { PlayerView } from '@cindervale/protocol';
import type Phaser from 'phaser';
import { Avatar } from './Avatar';

/** Everyone else on the map, rendered from synced server state. */
export class RemotePlayers {
  private avatars = new Map<string, Avatar>();

  constructor(private readonly scene: Phaser.Scene) {}

  get count() {
    return this.avatars.size;
  }

  get(sessionId: string) {
    return this.avatars.get(sessionId);
  }

  sync(players: Map<string, PlayerView>, mySessionId: string, delta: number) {
    // shortcut: exponential smoothing toward the latest snapshot; switch to a snapshot
    // interpolation buffer if remote movement looks jittery under real latency.
    const t = Math.min(1, delta / 80);
    for (const [sessionId, p] of players) {
      if (sessionId === mySessionId) continue;
      let avatar = this.avatars.get(sessionId);
      if (!avatar) {
        avatar = new Avatar(this.scene, p);
        this.avatars.set(sessionId, avatar);
      }
      const { x, y } = avatar.sprite;
      avatar.update(x + (p.x - x) * t, y + (p.y - y) * t, p, p.dead);
    }
    for (const [sessionId, avatar] of this.avatars) {
      if (players.has(sessionId)) continue;
      avatar.destroy();
      this.avatars.delete(sessionId);
    }
  }
}
