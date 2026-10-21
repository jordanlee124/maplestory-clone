import { describe, expect, it } from 'vitest';
import { AnimationStateMachine, ATTACK_WINDOWS } from './animation';
import { CombatController } from './controller';
import { DEFAULT_BINDINGS, actionForCode, rebind } from '../input/bindings';

const standing = { x: 0, y: 0, vx: 0, vy: 0, grounded: true, climbing: false };

describe('animation presentation', () => {
  it('follows locomotion and gives death and hit priority over attacks', () => {
    const a = new AnimationStateMachine();
    expect(a.sample(0, standing, false).state).toBe('idle');
    expect(a.sample(0, { ...standing, climbing: true }, false).state).toBe('climb');
    a.attack(0, false);
    expect(a.sample(0, standing, false).state).toBe('attack');
    a.cancel();
    expect(a.sample(0, { ...standing, vx: 1 }, false).state).toBe('walk');
    expect(a.sample(0, { ...standing, grounded: false, vy: -1 }, false).state).toBe('jump');
    expect(a.sample(0, { ...standing, grounded: false, vy: 1 }, false).state).toBe('fall');
    a.attack(0, true);
    expect(a.sample(0, standing, false)).toEqual({ state: 'skill', phase: 'startup' });
    expect(a.sample(ATTACK_WINDOWS.startup, standing, false).phase).toBe('active');
    expect(a.sample(ATTACK_WINDOWS.startup + ATTACK_WINDOWS.active, standing, false).phase).toBe(
      'recovery',
    );
    a.hit(200);
    expect(a.sample(200, standing, false).state).toBe('hit');
    expect(a.sample(200, standing, true).state).toBe('death');
    expect(a.sample(1000, standing, false).state).toBe('idle');
  });
});

describe('hotkeys', () => {
  it('reserves W for skills, keeps Space and Ctrl, and removes duplicate bindings', () => {
    expect(actionForCode(DEFAULT_BINDINGS, 'KeyW')).toBe('skill2');
    expect(actionForCode(DEFAULT_BINDINGS, 'Space')).toBe('jump');
    expect(actionForCode(DEFAULT_BINDINGS, 'ControlRight')).toBe('attack');
    const changed = rebind(DEFAULT_BINDINGS, 'skill1', 'KeyW');
    expect(actionForCode(changed, 'KeyW')).toBe('skill1');
    expect(changed.skill2).toEqual([]);
    expect(DEFAULT_BINDINGS.skill2).toEqual(['KeyW']);
    expect(() => rebind(DEFAULT_BINDINGS, 'attack', 'Escape')).toThrow();
  });
});

describe('combat commands and cooldowns', () => {
  it('buffers a late press, expires old presses, and sends commands only', () => {
    const c = new CombatController('ember-knight');
    c.queue('basic-attack', 0);
    expect(c.next(0, 'right', true)).toEqual({
      requestId: 0,
      skillId: 'basic-attack',
      facing: 'right',
    });
    c.queue('basic-attack', 400);
    expect(c.next(450, 'left', true)).toBeUndefined();
    expect(c.next(500, 'left', true)?.facing).toBe('left');
    c.queue('basic-attack', 600);
    expect(c.next(1000, 'left', true)).toBeUndefined();
  });

  it('reconciles cooldowns from acceptance/rejection without treating remote events as local', () => {
    const c = new CombatController('ember-knight');
    c.queue('flame-cleave', 0);
    const request = c.next(0, 'right', true)!;
    expect(c.remaining('flame-cleave', 100)).toBe(1400);
    c.reject({ requestId: request.requestId, reason: 'insufficient_mp' });
    expect(c.remaining('flame-cleave', 100)).toBe(0);
    c.confirm(
      { sessionId: 'other', requestId: 9, skillId: 'flame-cleave', facing: 'left', hits: [] },
      'me',
      200,
    );
    expect(c.remaining('flame-cleave', 200)).toBe(0);
    c.queue('flame-cleave', 400);
    const second = c.next(400, 'right', true)!;
    c.confirm({ ...second, sessionId: 'me', hits: [] }, 'me', 500);
    expect(c.remaining('flame-cleave', 500)).toBe(1500);
  });

  it('does not queue unavailable skills or send during a menu, death, or climbing', () => {
    const c = new CombatController('ember-knight');
    c.queue('gust-arrow', 0);
    expect(c.next(0, 'right', true)).toBeUndefined();
    c.queue('basic-attack', 0);
    expect(c.next(0, 'right', false)).toBeUndefined();
    expect(c.next(10, 'right', true)).toBeUndefined();
    expect(c.skills.map((s) => s.id)).toEqual(['flame-cleave']);
  });

  it('ignores stale replies and retains a conservative timer after server cooldown rejection', () => {
    const c = new CombatController('ember-knight');
    c.queue('basic-attack', 0);
    const old = c.next(0, 'right', true)!;
    c.queue('basic-attack', 500);
    const current = c.next(500, 'left', true)!;
    expect(c.reject({ requestId: old.requestId, reason: 'invalid_state' })).toBe(false);
    expect(c.remaining('basic-attack', 500)).toBe(500);
    c.reject({ requestId: current.requestId, reason: 'cooldown' });
    expect(c.remaining('basic-attack', 600)).toBe(400);
  });
});
