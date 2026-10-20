import { stepBody, type Body, type MapGeometry } from '@cindervale/game-core';
import { describe, expect, it } from 'vitest';
import { Predictor } from './predictor';

const map: MapGeometry = {
  width: 1000,
  height: 400,
  spawn: { x: 100, y: 300 },
  platforms: [{ x: 0, y: 300, width: 1000 }],
};
const start: Body = { x: 100, y: 300, vx: 0, vy: 0, grounded: true };
const right = { left: false, right: true, jump: false };

describe('Predictor', () => {
  it('predicts immediately and matches the server after reconciliation', () => {
    const p = new Predictor(start, 0, map);
    const sent = Array.from({ length: 10 }, () => p.step(right));
    const predicted = p.body;

    // Server has applied the first 4 inputs.
    const server = sent.slice(0, 4).reduce((b, i) => stepBody(b, i, map), start);
    p.reconcile(server, 3);
    expect(p.pendingCount).toBe(6);
    expect(p.body).toEqual(predicted);
  });

  it('snaps to server state when the server disagrees', () => {
    const p = new Predictor(start, 0, map);
    for (let i = 0; i < 5; i++) p.step(right);
    const corrected: Body = { ...start, x: 50 };
    p.reconcile(corrected, 4);
    expect(p.pendingCount).toBe(0);
    expect(p.body).toEqual(corrected);
  });
});
