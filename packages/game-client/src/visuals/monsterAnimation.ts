import type { MonsterView } from '@cindervale/protocol';
import { sampleVisual, type VisualAsset } from './model';

/** Selects presentation clips from server modes and confirmed event timers, never HP or damage. */
export class MonsterAnimation {
  private clip = '';
  private started = 0;

  sample(
    asset: VisualAsset,
    mode: MonsterView['mode'],
    now: number,
    events: { hitUntil: number; attackUntil: number; respawnUntil?: number },
  ) {
    const action =
      mode === 'dead'
        ? 'defeat'
        : now < (events.respawnUntil ?? 0)
          ? 'respawn'
          : now < events.hitUntil
            ? 'hit'
            : now < events.attackUntil
              ? 'attack'
              : mode === 'idle'
                ? 'idle'
                : 'walk';
    const clip = asset.clips[action] ? action : 'idle';
    if (clip !== this.clip) {
      this.clip = clip;
      this.started = now;
    }
    return { action, frame: sampleVisual(asset, clip, now - this.started) };
  }
}
