import { AUTO_GRIND, MAPS, SKILLS } from '@cindervale/content';
import type { AutoGrindConfig } from '@cindervale/protocol';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUTO_CONFIG,
  disabledAuto,
  normalizeConfig,
  pauseAuto,
  skipDrop,
  startAuto,
  stepAuto,
  type AutoGrind,
} from './autogrind';
import type { Drop } from './combat';
import { spawnMonsters } from './monsters';
import { createSession } from './session';

const map = MAPS['fernreach-fields']!; // ground 0..1500 at y 640; twigs at 520, 860, 1320
const NOW = 1_000_000;

function setup(x = 400, config: Partial<AutoGrindConfig> = {}, classId = 'runewaver') {
  const s = createSession('s1', { id: 'c1', classId, x, y: 640, level: 10, exp: 0 });
  s.body.grounded = true;
  const monsters = spawnMonsters(map, 0, () => 0.5);
  const auto = startAuto(disabledAuto({ ...DEFAULT_AUTO_CONFIG, ...config }), s, map, NOW);
  return { s, monsters, auto };
}
const step = (
  auto: AutoGrind,
  s: ReturnType<typeof setup>['s'],
  monsters = setup().monsters,
  drops: Drop[] = [],
  now = NOW,
) => stepAuto(auto, s, { map, monsters, drops, now });
const drop = (x: number, extra: Partial<Drop> = {}): Drop => ({
  id: `d${x}`,
  itemId: null,
  quantity: 5,
  x,
  y: 640,
  ownerId: null,
  ownerUntil: 0,
  expiresAt: NOW + 60_000,
  ...extra,
});

describe('auto-grind state machine', () => {
  it('refuses to start, or keep running, in a boss instance', () => {
    const boss = { ...map, bossInstance: true };
    const { s, auto } = setup();
    expect(startAuto(auto, s, boss, NOW)).toMatchObject({
      state: 'DISABLED',
      reason: 'boss_instance',
    });
    const r = stepAuto(auto, s, { map: boss, monsters: [], drops: [], now: NOW });
    expect(r.auto).toMatchObject({ state: 'DISABLED', reason: 'boss_instance' });
    expect(r.action).toBeUndefined();
  });

  it('stops on death and after the safety time limit', () => {
    const { s, monsters, auto } = setup();
    expect(step(auto, s, monsters, [], NOW + AUTO_GRIND.maxRunMs).auto).toMatchObject({
      state: 'DISABLED',
      reason: 'time_limit',
    });
    s.dead = true;
    expect(step(auto, s, monsters).auto).toMatchObject({ state: 'DISABLED', reason: 'died' });
  });

  it('pauses for manual input and resumes after the override window', () => {
    const { s, monsters, auto } = setup();
    const paused = pauseAuto(auto, NOW);
    expect(paused.state).toBe('PAUSED');
    const held = step(paused, s, monsters, [], NOW + AUTO_GRIND.manualOverrideMs - 1);
    expect(held.auto.state).toBe('PAUSED');
    expect(held.input).toEqual({ left: false, right: false, up: false, down: false, jump: false });
    expect(held.action).toBeUndefined();
    expect(step(paused, s, monsters, [], NOW + AUTO_GRIND.manualOverrideMs).auto.state).not.toBe(
      'PAUSED',
    );
  });

  it('keeps the run start when re-enabled, and extends a pause on further input', () => {
    const { s, monsters, auto } = setup();
    expect(startAuto(auto, s, map, NOW + 60_000).startedAt).toBe(NOW);
    const paused = pauseAuto(pauseAuto(auto, NOW), NOW + 2000);
    expect(paused.pausedUntil).toBe(NOW + 2000 + AUTO_GRIND.manualOverrideMs);
    expect(step(paused, s, monsters, [], NOW + AUTO_GRIND.manualOverrideMs).auto.state).toBe(
      'PAUSED',
    );
  });

  it('skips a drop whose pickup was refused instead of retrying it', () => {
    const { s, monsters, auto } = setup(400);
    const cash = drop(410, { id: 'cash' });
    expect(step(auto, s, monsters, [cash]).action).toEqual({ type: 'pickup', dropId: 'cash' });
    const r = step(skipDrop(auto, 'cash'), s, monsters, [cash]);
    expect(r.action?.type).not.toBe('pickup');
    expect(r.auto.state).not.toBe('LOOTING');
  });

  it('walks toward the bounds from a platform that misses them', () => {
    const { s, monsters } = setup(400);
    const far = setup(400, { bounds: { minX: 2000, maxX: 2400 } }).auto;
    const r = step(far, s, monsters);
    expect(r.auto.state).toBe('MOVING');
    expect(r.input.right).toBe(true);
  });

  it('walks toward the chosen target with ordinary inputs only', () => {
    const { s, monsters, auto } = setup(300);
    const r = step(auto, s, monsters);
    expect(r.auto).toMatchObject({ state: 'MOVING', targetId: 'm0' }); // twig at 520
    expect(r.input).toEqual({ left: false, right: true, up: false, down: false, jump: false });
  });

  it('selects targets by the configured rule, only on its own platform', () => {
    const { s, monsters } = setup(700, { target: 'nearest' });
    // m1 at 860 is nearest; m3 sits on a ledge above and is never considered.
    expect(step(setup(700).auto, s, monsters).auto.targetId).toBe('m1');
    monsters[2]!.hp = 1;
    const low = setup(700, { target: 'lowest_hp' }).auto;
    expect(step(low, s, monsters).auto.targetId).toBe('m2');
    monsters[2]!.ai = { ...monsters[2]!.ai, mode: 'dead' };
    expect(step(low, s, monsters).auto.targetId).not.toBe('m2');
  });

  it('never targets or walks beyond its bounds', () => {
    const { s, monsters, auto } = setup(400, { bounds: { minX: 300, maxX: 480 } });
    // Every twig is outside 300..480.
    const r = step(auto, s, monsters);
    expect(r.auto).toMatchObject({ state: 'SEARCHING', targetId: null });
    expect(r.input.left || r.input.right).toBe(false);

    s.body.x = 250; // outside: walk back in, toward the centre
    expect(step(auto, s, monsters).input.right).toBe(true);
  });

  it('attacks in priority order, skipping skills on cooldown or without MP', () => {
    const config = { skills: ['rune-burst', 'basic-attack'], mpPotionPct: 0 };
    const { s, monsters, auto } = setup(500, config);
    const first = step(auto, s, monsters);
    expect(first.action).toEqual({ type: 'attack', skillId: 'rune-burst', facing: 'right' });
    s.cooldowns.set('rune-burst', NOW + 1000);
    expect(step(first.auto, s, monsters).action).toMatchObject({ skillId: 'basic-attack' });
    s.cooldowns.clear();
    s.mp = 0;
    expect(step(first.auto, s, monsters).action).toMatchObject({ skillId: 'basic-attack' });
    s.nextAttackAt = NOW + 100; // global attack lock: hold, don't spam
    const held = step(first.auto, s, monsters);
    expect(held.action).toBeUndefined();
    expect(held.auto.state).toBe('ATTACKING');
  });

  it('only uses allowed skills, and casts allowed buffs that are not active', () => {
    const { s, monsters, auto } = setup(500, { skills: ['mana-weave', 'basic-attack'] });
    s.skills.set('mana-weave', 1);
    expect(step(auto, s, monsters).action).toMatchObject({ skillId: 'mana-weave' });
    s.buffs.set('mana-weave', { level: 1, until: NOW + 60_000 });
    expect(step(auto, s, monsters).action).toMatchObject({ skillId: 'basic-attack' });
    // An unlearned skill in the list is skipped rather than attempted.
    const r = step(setup(500, { skills: ['glyph-lance'] }).auto, s, monsters);
    expect(r.action).toBeUndefined();
  });

  it('collects permitted, owned-or-free loot between fights', () => {
    const { s, monsters, auto } = setup(400, { loot: 'currency' });
    const item = drop(410, { id: 'item', itemId: 'twig-bundle' });
    const cash = drop(430, { id: 'cash' });
    const foreign = drop(405, { id: 'foreign', ownerId: 'someone', ownerUntil: NOW + 5000 });
    const r = step(auto, s, monsters, [item, cash, foreign]);
    expect(r.auto.state).toBe('LOOTING');
    expect(r.action).toEqual({ type: 'pickup', dropId: 'cash' });
    const none = step(setup(400, { loot: 'none' }).auto, s, monsters, [item, cash]);
    expect(none.auto.state).not.toBe('LOOTING');
  });

  it('recovers below the potion threshold: drinks a held potion, else waits', () => {
    const { s, monsters, auto } = setup(500, { hpPotionPct: 50 });
    s.hp = 1;
    expect(step(auto, s, monsters)).toMatchObject({
      auto: { state: 'RECOVERING' },
      action: undefined,
    });
    s.potions.set('ember-tonic', 2);
    expect(step(auto, s, monsters).action).toEqual({ type: 'useItem', itemId: 'ember-tonic' });
    s.nextItemUseAt = NOW + 100; // item cooldown
    expect(step(auto, s, monsters).action).toBeUndefined();
  });
});

describe('normalizeConfig', () => {
  const base = { ...DEFAULT_AUTO_CONFIG };
  it("rejects other classes' skills, passives, unknown ids and duplicates", () => {
    expect(normalizeConfig({ ...base, skills: ['flame-cleave'] }, 'runewaver', 3840)).toBeNull();
    expect(normalizeConfig({ ...base, skills: ['runic-insight'] }, 'runewaver', 3840)).toBeNull();
    expect(normalizeConfig({ ...base, skills: ['__proto__'] }, 'runewaver', 3840)).toBeNull();
    expect(
      normalizeConfig({ ...base, skills: ['rune-burst', 'rune-burst'] }, 'runewaver', 3840),
    ).toBeNull();
    expect(
      normalizeConfig({ ...base, skills: ['rune-burst', 'mana-weave'] }, 'runewaver', 3840),
    ).not.toBeNull();
    expect(SKILLS['rune-burst']).toBeDefined();
  });

  it('clamps bounds to the map', () => {
    expect(
      normalizeConfig({ ...base, bounds: { minX: -50, maxX: 9999 } }, 'runewaver', 3840)?.bounds,
    ).toEqual({ minX: 0, maxX: 3840 });
    expect(
      normalizeConfig({ ...base, bounds: { minX: 5000, maxX: 6000 } }, 'runewaver', 3840),
    ).toBeNull();
  });
});
