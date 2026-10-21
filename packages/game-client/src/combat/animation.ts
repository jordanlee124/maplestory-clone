import { bodyState, type Body, type BodyState } from '@cindervale/game-core';

// Presentation windows only; server hit validation is immediate and authoritative.
export const ATTACK_WINDOWS = { startup: 90, active: 100, recovery: 160 } as const;
export const REACTION_WINDOWS = { hit: 240, respawn: 400 } as const;
export type AnimationState = BodyState | 'attack' | 'skill' | 'hit' | 'death' | 'respawn';
export type AttackPhase = 'startup' | 'active' | 'recovery';

export class AnimationStateMachine {
  private started = -Infinity;
  private skill = false;
  private hitUntil = -Infinity;
  private dead = false;
  private respawnUntil = -Infinity;

  attack(now: number, skill: boolean) {
    if (this.dead || now < this.hitUntil) return false;
    this.started = now;
    this.skill = skill;
    this.respawnUntil = -Infinity;
    return true;
  }

  hit(now: number) {
    if (this.dead) return;
    this.hitUntil = now + REACTION_WINDOWS.hit;
    this.respawnUntil = -Infinity;
    this.started = -Infinity;
  }

  cancel() {
    this.started = -Infinity;
  }

  sample(now: number, body: Body, dead: boolean): { state: AnimationState; phase?: AttackPhase } {
    if (dead) {
      this.dead = true;
      this.cancel();
      this.hitUntil = -Infinity;
      return { state: 'death' };
    }
    if (this.dead) {
      this.dead = false;
      this.respawnUntil = now + REACTION_WINDOWS.respawn;
    }
    if (now < this.hitUntil) return { state: 'hit' };
    if (now < this.respawnUntil) return { state: 'respawn' };
    if (body.climbing) this.cancel();
    const elapsed = now - this.started;
    const { startup, active, recovery } = ATTACK_WINDOWS;
    if (elapsed < startup + active + recovery) {
      const phase =
        elapsed < startup ? 'startup' : elapsed < startup + active ? 'active' : 'recovery';
      return { state: this.skill ? 'skill' : 'attack', phase };
    }
    return { state: bodyState(body) };
  }
}
