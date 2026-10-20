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
  bodyWidth: 24,
  bodyHeight: 48,
} as const;

/** A one-way platform: solid from above, passable from below and the sides. */
export interface Platform {
  x: number;
  y: number;
  width: number;
}

export interface MapGeometry {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  platforms: readonly Platform[];
}

export interface MoveInput {
  left: boolean;
  right: boolean;
  jump: boolean;
}

/** Position is the bottom-center of the body (the feet). */
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
}

export function spawnBody(map: MapGeometry): Body {
  return { x: map.spawn.x, y: map.spawn.y, vx: 0, vy: 0, grounded: false };
}

/** Advance one fixed step. Pure: returns a new body. */
export function stepBody(body: Body, input: MoveInput, map: MapGeometry): Body {
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

  return { x, y, vx, vy, grounded };
}
