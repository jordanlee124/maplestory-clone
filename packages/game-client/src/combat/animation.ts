import { bodyState, type Body, type BodyState } from '@cindervale/game-core';

// Presentation windows only; server hit validation is immediate and authoritative.
export const ATTACK_WINDOWS = { startup: 90, active: 100, recovery: 160 } as const;
export type AnimationState = BodyState | 'attack' | 'skill' | 'hit' | 'death';
export type AttackPhase = 'startup' | 'active' | 'recovery';

export class AnimationStateMachine {
  private started = -Infinity;
  private skill = false;
  private hitUntil = -Infinity;

  attack(now: number, skill: boolean) {
    this.started = now;
    this.skill = skill;
  }

  hit(now: number) {
    this.hitUntil = now + 240;
    this.started = -Infinity;
  }

  cancel() {
    this.started = -Infinity;
  }

  sample(now: number, body: Body, dead: boolean): { state: AnimationState; phase?: AttackPhase } {
    if (dead) {
      this.cancel();
      this.hitUntil = -Infinity;
      return { state: 'death' };
    }
    if (now < this.hitUntil) return { state: 'hit' };
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
