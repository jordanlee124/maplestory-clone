import { COMBAT, LOOT, MAPS, SKILLS, type AttackSkillDef } from '@cindervale/content';
import { describe, expect, it } from 'vitest';
import { monsterHitsPlayer, resolveAttack, validatePickup, type Drop } from './combat';
import { spawnMonsters, type Monster } from './monsters';
import { createSession, expireBuffs, type Session } from './session';

const rng = () => 0.5; // no crits (0.5 ≥ critRate), variance exactly 1.0
const map = MAPS['fernreach-fields']!;
const NOW = 100_000;

function setup(classId = 'runewaver', level = 1) {
  const monsters = spawnMonsters(map, 0, rng);
  const twig = monsters[0]!; // twig-creature at x=520, y=640
  const s = createSession('s1', { id: 'c1', classId, x: twig.ai.x - 40, y: 640, level, exp: 0 });
  s.body.grounded = true;
  return { s, twig, monsters };
}
const attack = (skillId = 'basic-attack', facing: 'left' | 'right' = 'right') => ({
  requestId: 1,
  skillId,
  facing,
});

describe('resolveAttack', () => {
  it('hits a monster in range with server-computed damage', () => {
    const { s, twig, monsters } = setup();
    const r = resolveAttack(s, attack(), monsters, NOW, rng);
    // runewaver L1 attack 13 × 1.0 × defense 100/102 × 1.0 → 12
    expect(r).toMatchObject({
      ok: true,
      hits: [{ monster: twig, damage: 12, crit: false, killed: false }],
    });
    expect(twig.hp).toBe(twig.def.hp - 12);
    expect(twig.damageBy.get('c1')).toBe(12);
    expect(twig.ai).toMatchObject({ mode: 'chase', targetId: 's1' });
    expect(twig.ai.x).toBe(520 + (SKILLS['basic-attack'] as AttackSkillDef).knockback);
  });

  it('misses targets behind the player or out of range (but still spends the swing)', () => {
    const { s, twig, monsters } = setup();
    expect(resolveAttack(s, attack('basic-attack', 'left'), monsters, NOW, rng)).toEqual({
      ok: true,
      hits: [],
    });
    s.body.x = twig.ai.x - 200;
    expect(resolveAttack(s, attack(), monsters, NOW + 1000, rng)).toEqual({ ok: true, hits: [] });
    expect(twig.hp).toBe(twig.def.hp);
  });

  it('rejects unknown skills, including prototype keys', () => {
    for (const skillId of ['fireball', '__proto__', 'constructor', 'toString']) {
      const { s, monsters } = setup();
      expect(resolveAttack(s, attack(skillId), monsters, NOW, rng)).toEqual({
        ok: false,
        reason: 'unknown_skill',
      });
    }
  });

  it("rejects another class's skill", () => {
    const { s, monsters } = setup('runewaver');
    expect(resolveAttack(s, attack('flame-cleave'), monsters, NOW, rng)).toEqual({
      ok: false,
      reason: 'skill_not_owned',
    });
  });

  it('rejects attacks while dead or climbing', () => {
    const { s, monsters } = setup();
    s.dead = true;
    expect(resolveAttack(s, attack(), monsters, NOW, rng)).toMatchObject({
      reason: 'invalid_state',
    });
    s.dead = false;
    s.body.climbing = true;
    expect(resolveAttack(s, attack(), monsters, NOW, rng)).toMatchObject({
      reason: 'invalid_state',
    });
  });

  it('enforces the global attack lock and per-skill cooldowns', () => {
    const { s, monsters } = setup();
    expect(resolveAttack(s, attack(), monsters, NOW, rng).ok).toBe(true);
    expect(resolveAttack(s, attack(), monsters, NOW + 10, rng)).toMatchObject({
      reason: 'too_fast',
    });
    const later = NOW + COMBAT.attackLockMs;
    expect(resolveAttack(s, attack(), monsters, later, rng)).toMatchObject({ reason: 'cooldown' });
    expect(
      resolveAttack(s, attack(), monsters, NOW + SKILLS['basic-attack']!.cooldownMs, rng).ok,
    ).toBe(true);
  });

  it('charges MP and rejects when MP is insufficient, without charging', () => {
    const { s, monsters } = setup('runewaver');
    const cost = SKILLS['rune-burst']!.mpCost;
    s.mp = cost;
    expect(resolveAttack(s, attack('rune-burst'), monsters, NOW, rng).ok).toBe(true);
    expect(s.mp).toBe(0);
    expect(resolveAttack(s, attack('rune-burst'), monsters, NOW + 60_000, rng)).toEqual({
      ok: false,
      reason: 'insufficient_mp',
    });
    expect(s.mp).toBe(0);
  });

  it('kills exactly once, never over-counting damage, and ignores dead monsters', () => {
    const { s, twig, monsters } = setup('runewaver', 30);
    const r = resolveAttack(s, attack(), monsters, NOW, rng);
    expect(r).toMatchObject({ ok: true, hits: [{ killed: true }] });
    expect(twig.hp).toBe(0);
    expect(twig.damageBy.get('c1')).toBe(twig.def.hp);
    expect(twig.ai.mode).toBe('dead');
    expect(resolveAttack(s, attack(), monsters, NOW + 10_000, rng)).toEqual({ ok: true, hits: [] });
  });

  it('caps the number of targets per skill', () => {
    const { s, twig } = setup('runewaver', 1);
    const crowd: Monster[] = Array.from({ length: 6 }, (_, i) => ({
      ...twig,
      id: `x${i}`,
      ai: { ...twig.ai },
      damageBy: new Map(),
    }));
    s.mp = 999;
    const r = resolveAttack(s, attack('rune-burst'), crowd, NOW, rng);
    expect(r.ok && r.hits.length).toBe((SKILLS['rune-burst'] as AttackSkillDef).maxTargets);
  });
});

describe('skills in combat', () => {
  it('rejects a learnable skill until it is learned, and passives always', () => {
    const { s, monsters } = setup('runewaver', 10);
    expect(resolveAttack(s, attack('glyph-lance'), monsters, NOW, rng)).toEqual({
      ok: false,
      reason: 'skill_not_owned',
    });
    s.skills.set('runic-insight', 1);
    expect(resolveAttack(s, attack('runic-insight'), monsters, NOW, rng)).toEqual({
      ok: false,
      reason: 'not_usable',
    });
  });

  it('scales damage with skill level', () => {
    const { s, twig, monsters } = setup('runewaver', 1);
    s.mp = 999;
    const at1 = resolveAttack(s, attack('rune-burst'), monsters, NOW, rng);
    twig.hp = twig.def.hp;
    s.skills.set('rune-burst', 5);
    const at5 = resolveAttack(s, attack('rune-burst'), monsters, NOW + 60_000, rng);
    // magic 13 × (2.2 | 2.2 + 4 × 0.12) × 100/102
    expect(at1.ok && at1.hits[0]!.damage).toBe(28);
    expect(at5.ok && at5.hits[0]!.damage).toBe(34);
  });

  it('applies a buff to stats without hitting, and refreshes on recast', () => {
    const { s, monsters } = setup('ember-knight', 5);
    s.skills.set('kindled-will', 3);
    s.mp = 999;
    const before = s.stats.attack;
    expect(resolveAttack(s, attack('kindled-will'), monsters, NOW, rng)).toEqual({
      ok: true,
      hits: [],
    });
    expect(s.stats.attack).toBe(before + 4 + 2);
    expect(s.buffs.get('kindled-will')).toEqual({ level: 3, until: NOW + 120_000 });
    resolveAttack(s, attack('kindled-will'), monsters, NOW + 5000, rng);
    expect(s.buffs.get('kindled-will')!.until).toBe(NOW + 125_000);
    expect(s.stats.attack).toBe(before + 6);
  });

  it('expires buffs on time, restoring stats and capping vitals', () => {
    const { s, monsters } = setup('runewaver', 5);
    s.skills.set('mana-weave', 1);
    const base = s.stats.magic;
    resolveAttack(s, attack('mana-weave'), monsters, NOW, rng);
    expect(s.stats.magic).toBe(base + 5);
    const until = NOW + 120_000;
    expect(expireBuffs(s, until - 1)).toBe(false);
    expect(expireBuffs(s, until)).toBe(true);
    expect(s.buffs.size).toBe(0);
    expect(s.stats.magic).toBe(base);
    expect(s.mp).toBeLessThanOrEqual(s.stats.maxMp);
  });
});

describe('monsterHitsPlayer', () => {
  it('damages, knocks back, and grants brief invulnerability', () => {
    const { s, twig } = setup();
    const hp = s.hp;
    const hit = monsterHitsPlayer(twig, s, NOW, rng, map.geometry.width)!;
    expect(hit.damage).toBeGreaterThan(0);
    expect(s.hp).toBe(hp - hit.damage);
    expect(s.body.x).toBe(twig.ai.x - 40 - COMBAT.playerKnockback.x);
    expect(monsterHitsPlayer(twig, s, NOW + 10, rng, map.geometry.width)).toBeNull();
  });

  it('kills at 0 HP and ignores dead players', () => {
    const { s, twig } = setup();
    s.hp = 1;
    expect(monsterHitsPlayer(twig, s, NOW, rng, map.geometry.width)).toMatchObject({ died: true });
    expect(s).toMatchObject({ hp: 0, dead: true, deadAt: NOW });
    expect(monsterHitsPlayer(twig, s, NOW + 60_000, rng, map.geometry.width)).toBeNull();
  });
});

describe('validatePickup', () => {
  const drop = (over: Partial<Drop> = {}): Drop => ({
    id: 'd1',
    itemId: 'twig-bundle',
    quantity: 1,
    x: 100,
    y: 640,
    ownerId: 'c1',
    ownerUntil: NOW + 1000,
    expiresAt: NOW + 60_000,
    ...over,
  });
  const at = (x: number): Session => {
    const s = setup().s;
    s.body.x = x;
    return s;
  };

  it('allows the owner in range', () => {
    expect(validatePickup(at(100), drop(), NOW)).toBeNull();
  });

  it('rejects missing drops, dead players, and distant players', () => {
    expect(validatePickup(at(100), undefined, NOW)).toBe('not_found');
    const dead = at(100);
    dead.dead = true;
    expect(validatePickup(dead, drop(), NOW)).toBe('invalid_state');
    expect(validatePickup(at(100 + LOOT.pickupRange.x + 1), drop(), NOW)).toBe('out_of_range');
  });

  it('reserves a drop for its owner until the window ends', () => {
    expect(validatePickup(at(100), drop({ ownerId: 'someone-else' }), NOW)).toBe('not_owner');
    expect(validatePickup(at(100), drop({ ownerId: 'someone-else' }), NOW + 1000)).toBeNull();
  });
});
