import { BASIC_ATTACK_ID, COMBAT, SKILLS } from '@cindervale/content';
import type { AttackRejected, AttackRequest, AttackResult } from '@cindervale/protocol';

export const INPUT_BUFFER_MS = 180;

/** Local pacing and display only. Never computes hits, HP, MP, EXP or rewards. */
export class CombatController {
  private readonly classSkills;
  /** Server-reported skill levels; until the first snapshot, innate skills count as level 1. */
  private learned = new Map<string, number>();
  private queued?: { skillId: string; expires: number };
  private cooldowns = new Map<string, number>();
  private pending = new Map<number, AttackRequest>();
  private latest = new Map<string, number>();
  private nextId = 0;
  private lockedUntil = 0;

  constructor(classId: string) {
    // Passives are never sent; they only show in a skill window.
    this.classSkills = Object.values(SKILLS).filter(
      (s) => s.classId === classId && s.kind !== 'passive',
    );
  }

  /** Slot skills: this class's attack and buff skills that are learned. */
  get skills() {
    return this.classSkills.filter((s) => (this.learned.get(s.id) ?? (s.innate ? 1 : 0)) > 0);
  }

  /** Applies `characterStats.skills` (effective levels from the server). */
  setLearned(skills: readonly { skillId: string; level: number }[]) {
    this.learned = new Map(skills.map((s) => [s.skillId, s.level]));
  }

  queue(skillId: string, now: number) {
    if (skillId !== BASIC_ATTACK_ID && !this.skills.some((s) => s.id === skillId)) return;
    this.queued = { skillId, expires: now + INPUT_BUFFER_MS };
  }

  clear() {
    this.queued = undefined;
  }

  next(now: number, facing: AttackRequest['facing'], enabled: boolean): AttackRequest | undefined {
    if (!enabled) this.clear();
    const q = this.queued;
    if (!q) return;
    if (now > q.expires) {
      this.clear();
      return;
    }
    if (now < this.lockedUntil || this.remaining(q.skillId, now) > 0) return;
    this.clear();
    const request = { requestId: this.nextId++, skillId: q.skillId, facing };
    this.lockedUntil = now + COMBAT.attackLockMs;
    this.cooldowns.set(q.skillId, now + SKILLS[q.skillId]!.cooldownMs);
    this.pending.set(request.requestId, request);
    this.latest.set(q.skillId, request.requestId);
    // A dropped connection may never answer old requests.
    if (this.pending.size > 32) this.pending.delete(this.pending.keys().next().value!);
    return request;
  }

  remaining(skillId: string, now: number) {
    return Math.max(0, (this.cooldowns.get(skillId) ?? 0) - now);
  }

  confirm(result: AttackResult, mySessionId: string, now: number) {
    if (result.sessionId !== mySessionId) return;
    this.pending.delete(result.requestId);
    if (this.latest.get(result.skillId) !== result.requestId) return;
    const skill = SKILLS[result.skillId];
    if (skill) this.cooldowns.set(result.skillId, now + skill.cooldownMs);
  }

  reject(result: AttackRejected) {
    const request = this.pending.get(result.requestId);
    if (!request) return false;
    this.pending.delete(result.requestId);
    if (
      this.latest.get(request.skillId) === result.requestId &&
      result.reason !== 'cooldown' &&
      result.reason !== 'too_fast'
    )
      this.cooldowns.delete(request.skillId);
    const current = result.requestId === this.nextId - 1;
    if (current && result.reason !== 'too_fast') this.lockedUntil = 0;
    return current;
  }
}
