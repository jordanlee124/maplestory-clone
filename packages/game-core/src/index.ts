// Deterministic gameplay rules shared by the client (prediction) and server (authority).
// No browser or Node APIs allowed here.

/** Simulation runs in fixed steps; one client input == one step. */
export const TICK_RATE = 60;
export const FIXED_DT = 1 / TICK_RATE;

export const PHYSICS = {
  walkSpeed: 180,
  jumpSpeed: 560,
  gravity: 1500,
  maxFallSpeed: 900,
  climbSpeed: 120,
  /** How far from a ladder's centre the body may be and still grab it. */
  ladderGrab: 10,
  /** Jumping off a ladder sideways uses a fraction of the normal jump. */
  ladderJumpFactor: 0.6,
  bodyWidth: 24,
  bodyHeight: 48,
} as const;

/** A one-way platform: solid from above, passable from below and the sides. */
export interface Platform {
  x: number;
  y: number;
  width: number;
}

/** A vertical ladder or rope centred on `x`, spanning `top` (exit onto a platform) to `bottom`. */
export interface Ladder {
  x: number;
  top: number;
  bottom: number;
}

export interface MapGeometry {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  platforms: readonly Platform[];
  ladders: readonly Ladder[];
}

export interface MoveInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
}

/** Position is the bottom-center of the body (the feet). */
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  climbing: boolean;
}

export type BodyState = 'idle' | 'walk' | 'jump' | 'fall' | 'climb';

export function bodyState(body: Body): BodyState {
  if (body.climbing) return 'climb';
  if (!body.grounded) return body.vy < 0 ? 'jump' : 'fall';
  return body.vx !== 0 ? 'walk' : 'idle';
}

export function spawnBody(map: MapGeometry): Body {
  return { x: map.spawn.x, y: map.spawn.y, vx: 0, vy: 0, grounded: false, climbing: false };
}

function grabbableLadder(body: Body, input: MoveInput, map: MapGeometry): Ladder | undefined {
  if (input.up === input.down) return undefined;
  return map.ladders.find(
    (l) =>
      Math.abs(body.x - l.x) <= PHYSICS.ladderGrab &&
      // Up: feet within the ladder's span. Down: standing on (or just above) its top.
      (input.up ? body.y > l.top && body.y <= l.bottom : body.grounded && body.y === l.top),
  );
}

function stepClimbing(body: Body, input: MoveInput, map: MapGeometry): Body {
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (input.jump && dir !== 0) {
    return stepAir(
      { ...body, climbing: false, vy: -PHYSICS.jumpSpeed * PHYSICS.ladderJumpFactor },
      { ...input, jump: false },
      map,
    );
  }
  const ladder = map.ladders.find((l) => l.x === body.x && body.y >= l.top && body.y <= l.bottom);
  if (!ladder) return { ...body, climbing: false };

  const vy = ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * PHYSICS.climbSpeed;
  const y = body.y + vy * FIXED_DT;
  // Leaving either end hands control back to normal physics, which lands on the platform there.
  if (y <= ladder.top)
    return { ...body, y: ladder.top, vx: 0, vy: 0, grounded: true, climbing: false };
  if (y >= ladder.bottom)
    return { ...body, y: ladder.bottom, vx: 0, vy: 0, grounded: false, climbing: false };
  return { ...body, y, vx: 0, vy, grounded: false, climbing: true };
}

function stepAir(body: Body, input: MoveInput, map: MapGeometry): Body {
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const vx = dir * PHYSICS.walkSpeed;
  let vy = body.grounded && input.jump ? -PHYSICS.jumpSpeed : body.vy;
  vy = Math.min(vy + PHYSICS.gravity * FIXED_DT, PHYSICS.maxFallSpeed);

  const half = PHYSICS.bodyWidth / 2;
  const x = Math.min(Math.max(body.x + vx * FIXED_DT, half), map.width - half);
  let y = body.y + vy * FIXED_DT;
  let grounded = false;

  if (vy >= 0) {
    // Land on the highest platform whose top we crossed this step.
    let landY = Infinity;
    for (const p of map.platforms) {
      if (body.y <= p.y && y >= p.y && x >= p.x && x <= p.x + p.width && p.y < landY) {
        landY = p.y;
      }
    }
    if (landY !== Infinity) {
      y = landY;
      vy = 0;
      grounded = true;
    }
  }

  // Fell out of the world.
  if (y > map.height + PHYSICS.bodyHeight) return spawnBody(map);

  return { x, y, vx, vy, grounded, climbing: false };
}

/** Advance one fixed step. Pure: returns a new body. */
export function stepBody(body: Body, input: MoveInput, map: MapGeometry): Body {
  if (body.climbing) return stepClimbing(body, input, map);
  const ladder = grabbableLadder(body, input, map);
  if (ladder) {
    return stepClimbing(
      { ...body, x: ladder.x, vx: 0, vy: 0, grounded: false, climbing: true },
      input,
      map,
    );
  }
  return stepAir(body, input, map);
}

export * from './combat';
export * from './rules';
export * from './monster-ai';
