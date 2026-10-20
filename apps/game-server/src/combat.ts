// Authoritative combat rules. Pure apart from mutating the passed session/monsters; no IO.
import { COMBAT, LOOT, SKILLS } from '@cindervale/content';
import {
  aggroMonster,
  attackBox,
  hurtBox,
  killMonster,
  rectsOverlap,
  rollDamage,
  type Rng,
} from '@cindervale/game-core';
import type { AttackRejectReason, AttackRequest, PickupRejectReason } from '@cindervale/protocol';
import type { Monster } from './monsters';
import type { Session } from './session';

export interface Hit {
  monster: Monster;
  damage: number;
  crit: boolean;
  killed: boolean;
}

export type AttackOutcome = { ok: false; reason: AttackRejectReason } | { ok: true; hits: Hit[] };

/**
 * Validates and resolves one attack request. The client only chooses the skill and facing;
 * position, range, targets, damage and kills come from server state.
 */
export function resolveAttack(
  s: Session,
  req: AttackRequest,
  monsters: Iterable<Monster>,
  now: number,
  rng: Rng,
): AttackOutcome {
  const skill = Object.hasOwn(SKILLS, req.skillId) ? SKILLS[req.skillId] : undefined;
  if (!skill) return { ok: false, reason: 'unknown_skill' };
  if ((skill.classId !== null && skill.classId !== s.classId) || s.level < skill.requiredLevel) {
    return { ok: false, reason: 'skill_not_owned' };
  }
  if (s.dead || s.body.climbing) return { ok: false, reason: 'invalid_state' };
  if (now < s.nextAttackAt) return { ok: false, reason: 'too_fast' };
  if (now < (s.cooldowns.get(skill.id) ?? 0)) return { ok: false, reason: 'cooldown' };
  if (s.mp < skill.mpCost) return { ok: false, reason: 'insufficient_mp' };

  s.mp -= skill.mpCost;
  s.nextAttackAt = now + COMBAT.attackLockMs;
  s.cooldowns.set(skill.id, now + skill.cooldownMs);
  s.facing = req.facing === 'left' ? -1 : 1;

  // shortcut: no lag compensation; hits test the server's current positions. Rewind
  // monster positions by the client's latency if melee feels unfair at high ping.
  const box = attackBox(s.body, s.facing, skill.range);
  const targets = [...monsters]
    .filter((m) => m.ai.mode !== 'dead' && rectsOverlap(box, hurtBox(m.ai.x, m.y, m.def.size)))
    .sort((a, b) => Math.abs(a.ai.x - s.body.x) - Math.abs(b.ai.x - s.body.x))
    .slice(0, skill.maxTargets);

  const hits = targets.map((m): Hit => {
    const { damage, crit } = rollDamage(
      s.stats.attack,
      skill.multiplier,
      s.stats.critRate,
      m.def.defense,
      COMBAT.damage,
      rng,
    );
    const dealt = Math.min(damage, m.hp);
    m.hp -= dealt;
    m.damageBy.set(s.characterId, (m.damageBy.get(s.characterId) ?? 0) + dealt);
    const killed = m.hp <= 0;
    if (killed) {
      m.ai = killMonster(m.ai, now, m.def.behavior);
    } else {
      const x = Math.min(Math.max(m.ai.x + s.facing * skill.knockback, m.bounds.min), m.bounds.max);
      m.ai = { ...aggroMonster(m.ai, s.sessionId), x };
    }
    return { monster: m, damage, crit, killed };
  });
  return { ok: true, hits };
}

/** A monster's attack on a player. Returns null if it doesn't land (dead, invulnerable). */
export function monsterHitsPlayer(
  m: Monster,
  s: Session,
  now: number,
  rng: Rng,
  mapWidth: number,
): { damage: number; died: boolean } | null {
  if (s.dead || now < s.invulnUntil) return null;
  const { damage } = rollDamage(m.def.attack, 1, 0, s.stats.defense, COMBAT.damage, rng);
  s.hp = Math.max(0, s.hp - damage);
  s.invulnUntil = now + COMBAT.hitInvulnMs;
  // Knock the player away from the monster (and off any ladder).
  const dir = s.body.x >= m.ai.x ? 1 : -1;
  const { x: kx, vy } = COMBAT.playerKnockback;
  s.body = {
    ...s.body,
    x: Math.min(Math.max(s.body.x + dir * kx, 12), mapWidth - 12),
    vy,
    grounded: false,
    climbing: false,
  };
  const died = s.hp === 0;
  if (died) {
    s.dead = true;
    s.deadAt = now;
  }
  return { damage, died };
}

export interface Drop {
  id: string;
  /** null = currency. */
  itemId: string | null;
  quantity: number;
  x: number;
  y: number;
  ownerId: string | null;
  ownerUntil: number;
  expiresAt: number;
}

export function validatePickup(
  s: Session,
  drop: Drop | undefined,
  now: number,
): PickupRejectReason | null {
  if (!drop) return 'not_found';
  if (s.dead) return 'invalid_state';
  const { x, y } = LOOT.pickupRange;
  if (Math.abs(drop.x - s.body.x) > x || Math.abs(drop.y - s.body.y) > y) return 'out_of_range';
  if (drop.ownerId && drop.ownerId !== s.characterId && now < drop.ownerUntil) return 'not_owner';
  return null;
}
