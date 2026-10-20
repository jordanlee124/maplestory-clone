import { describe, expect, it } from 'vitest';
import { PHYSICS, stepBody, type Body, type MapGeometry, type MoveInput } from './index';

const map: MapGeometry = {
  width: 400,
  height: 300,
  spawn: { x: 100, y: 200 },
  platforms: [
    { x: 0, y: 200, width: 400 },
    { x: 150, y: 120, width: 100 },
  ],
};
const idle: MoveInput = { left: false, right: false, jump: false };
const run = (body: Body, input: MoveInput, steps: number) => {
  for (let i = 0; i < steps; i++) body = stepBody(body, input, map);
  return body;
};
const standing: Body = { x: 100, y: 200, vx: 0, vy: 0, grounded: true };

describe('stepBody', () => {
  it('stays grounded when idle on a platform', () => {
    expect(run(standing, idle, 60)).toEqual({ ...standing, vx: 0, vy: 0 });
  });

  it('walks right at walkSpeed', () => {
    const b = run(standing, { ...idle, right: true }, 60);
    expect(b.x).toBeCloseTo(100 + PHYSICS.walkSpeed, 5);
    expect(b.grounded).toBe(true);
  });

  it('clamps to map bounds', () => {
    const b = run(standing, { ...idle, left: true }, 120);
    expect(b.x).toBe(PHYSICS.bodyWidth / 2);
  });

  it('jumps, rises, and lands back on the ground', () => {
    let b = stepBody(standing, { ...idle, jump: true }, map);
    expect(b.grounded).toBe(false);
    expect(b.y).toBeLessThan(200);
    b = run(b, idle, 120);
    expect(b).toMatchObject({ y: 200, grounded: true });
  });

  it('cannot jump in mid-air', () => {
    const airborne = stepBody(standing, { ...idle, jump: true }, map);
    const again = stepBody(airborne, { ...idle, jump: true }, map);
    expect(again.vy).toBeGreaterThan(airborne.vy);
  });

  it('passes up through a one-way platform and lands on top of it', () => {
    let b: Body = { ...standing, x: 200 };
    b = stepBody(b, { ...idle, jump: true }, map);
    let landedHigh = false;
    for (let i = 0; i < 120 && !landedHigh; i++) {
      b = stepBody(b, idle, map);
      landedHigh = b.grounded && b.y === 120;
    }
    expect(landedHigh).toBe(true);
  });

  it('respawns after falling out of the world', () => {
    const b = run({ x: 100, y: 250, vx: 0, vy: 0, grounded: false }, idle, 120);
    expect(b).toMatchObject({ x: map.spawn.x, y: map.spawn.y });
  });

  it('is deterministic', () => {
    const inputs = Array.from({ length: 300 }, (_, i) => ({
      left: i % 7 < 2,
      right: i % 5 < 3,
      jump: i % 40 === 0,
    }));
    const play = () => inputs.reduce((b, inp) => stepBody(b, inp, map), standing);
    expect(play()).toEqual(play());
  });
});
