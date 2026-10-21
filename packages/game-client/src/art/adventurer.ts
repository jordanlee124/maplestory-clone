import { CHARACTER_FRAMES, SPRITE_CELL } from './manifest';
// Temporary original art: the existing 32x48 drawing is padded, never rescaled.
export type AdventurerFrame = (typeof CHARACTER_FRAMES)[number];
export interface AdventurerPalette {
  tunic: string;
  tunicShade: string;
}

// 'T' and 'S' stand for the palette's tunic and tunicShade.
type Rect = [x: number, y: number, w: number, h: number, color: string];
type Leg = [dx: number, lift: number];
interface Pose {
  dy: number;
  legs: [Leg, Leg];
  back: Rect[][];
  front: Rect[][];
  rear?: boolean;
}

const OUTLINE = '#2b1d16';
const SKIN = '#ffd9b8';
const HAIR = '#b0592b';
const HAIR_LIGHT = '#e08a4a';
const HAIR_DARK = '#7f3c1c';
const LEAF = '#6bcf3f';
const PANTS = '#435285';
const PANTS_SHADE = '#323d66';
const BOOT = '#7a4524';
const BOOT_SHADE = '#5c3218';
const BELT = '#5a3520';

const hang = (sx: number, swing: number, c: string): Rect[] => [
  [sx + Math.trunc(swing / 2), 25, 3, 3, c],
  [sx + swing, 28, 3, 2, c],
  [sx + swing, 30, 3, 2, SKIN],
];

const raised = (sx: number, top: number, c: string): Rect[] => [
  [sx, top + 2, 3, 25 - top, c],
  [sx, top, 3, 2, SKIN],
];

const spread = (dir: -1 | 1, c: string): Rect[] =>
  dir < 0
    ? [
        [4, 24, 6, 3, c],
        [2, 23, 2, 3, SKIN],
      ]
    : [
        [22, 24, 6, 3, c],
        [28, 23, 2, 3, SKIN],
      ];

function leg(x: number, [dx, lift]: Leg, pants: string, boot: string, rear = false): Rect[] {
  const foot = 47 - lift;
  const rects: Rect[] = [
    [x + Math.trunc(dx / 2), 33, 4, 6, pants],
    [x + dx, 38, 4, foot - 42, pants],
    [x + dx, foot - 4, 4, 5, boot],
  ];
  if (!rear) rects.push([x + dx + 4, foot - 2, 1, 3, boot]);
  return rects;
}

const TORSO: Rect[] = [
  [10, 24, 12, 11, 'T'],
  [9, 32, 14, 3, 'T'],
];

function torsoDetail(rear: boolean): Rect[] {
  const rects: Rect[] = [
    [10, 24, 2, 6, 'S'],
    [9, 34, 14, 1, 'S'],
    [10, 30, 12, 2, BELT],
  ];
  if (!rear) rects.push([15, 30, 2, 2, '#f5c542'], [15, 24, 2, 2, SKIN], [16, 26, 1, 1, SKIN]);
  return rects;
}

function head(rear: boolean): Rect[] {
  const rects: Rect[] = [
    [16, 2, 1, 2, LEAF],
    [17, 1, 3, 2, LEAF],
    [13, 2, 3, 1, LEAF],
    [9, 4, 14, 1, HAIR],
    [7, 5, 18, 5, HAIR],
    [8, 9, 16, 14, SKIN],
    [7, 11, 18, 10, SKIN],
    [10, 23, 12, 1, SKIN],
    [5, 8, 5, 12, HAIR],
    [4, 10, 1, 5, HAIR],
    [22, 4, 2, 1, HAIR],
    [7, 3, 2, 2, HAIR],
  ];
  if (rear) rects.push([7, 9, 18, 12, HAIR], [8, 21, 16, 1, HAIR]);
  else rects.push([22, 9, 3, 6, HAIR], [9, 10, 13, 2, HAIR]);
  return rects;
}

function face(rear: boolean): Rect[] {
  const rects: Rect[] = [
    [11, 6, 4, 1, HAIR_LIGHT],
    [10, 7, 1, 1, HAIR_LIGHT],
    [17, 2, 1, 1, '#a6ef7a'],
  ];
  if (rear) return [...rects, [15, 10, 1, 9, HAIR_DARK], [8, 14, 1, 5, HAIR_DARK]];
  return [
    ...rects,
    [6, 10, 1, 5, HAIR_LIGHT],
    [9, 12, 2, 1, HAIR],
    [12, 12, 3, 1, HAIR],
    [13, 13, 1, 1, HAIR],
    [17, 12, 3, 1, HAIR],
    [18, 13, 1, 1, HAIR],
    ...[13, 19].flatMap((x): Rect[] => [
      [x, 14, 3, 4, OUTLINE],
      [x, 16, 3, 2, '#3f6fd6'],
      [x + 1, 14, 1, 1, '#ffffff'],
    ]),
    [11, 19, 2, 1, '#f59a9a'],
    [22, 19, 2, 1, '#f59a9a'],
    [18, 20, 2, 1, '#b0503c'],
  ];
}

const idle = (dy: number): Pose => ({
  dy,
  legs: [
    [0, 0],
    [0, 0],
  ],
  back: [hang(9, 0, 'S')],
  front: [hang(20, 0, 'T')],
});

const walk = (stride: number, back: number, front: number): Pose => ({
  dy: stride === 0 ? -1 : 0,
  legs: [
    [-stride, back],
    [stride, front],
  ],
  back: [hang(9, stride && Math.sign(stride) * 2, 'S')],
  front: [hang(20, stride && -Math.sign(stride) * 2, 'T')],
});

const climb = (left: number, right: number): Pose => ({
  dy: 0,
  legs: [
    [0, left === 10 ? 0 : 3],
    [0, left === 10 ? 3 : 0],
  ],
  back: [],
  front: [raised(7, left, 'T'), raised(22, right, 'T')],
  rear: true,
});

const POSES: Record<AdventurerFrame, Pose> = {
  idle0: idle(0),
  idle1: idle(1),
  walk0: walk(3, 0, 0),
  walk1: walk(0, 2, 0),
  walk2: walk(-3, 0, 0),
  walk3: walk(0, 0, 2),
  jump: {
    dy: 0,
    legs: [
      [-1, 4],
      [2, 3],
    ],
    back: [raised(4, 15, 'S')],
    front: [raised(23, 14, 'T')],
  },
  fall: {
    dy: 0,
    legs: [
      [-2, 0],
      [2, 0],
    ],
    back: [spread(-1, 'S')],
    front: [spread(1, 'T')],
  },
  climb0: climb(10, 17),
  climb1: climb(17, 10),
  attack0: { ...idle(0), front: [raised(21, 18, 'T')] },
  attack1: { ...idle(0), front: [spread(1, 'T')] },
  attack2: { ...idle(0), front: [hang(22, 2, 'T')] },
  skill0: { ...idle(0), front: [raised(23, 10, 'T')] },
  skill1: { ...idle(0), back: [spread(-1, 'S')], front: [spread(1, 'T')] },
  skill2: { ...idle(0), front: [raised(22, 17, 'T')] },
  hit: { ...idle(2), back: [spread(-1, 'S')], front: [raised(22, 20, 'T')] },
  death: idle(0),
};

function blit(
  ctx: CanvasRenderingContext2D,
  ox: number,
  dy: number,
  rects: Rect[],
  p: AdventurerPalette,
  outlined = true,
): void {
  if (outlined) {
    ctx.fillStyle = OUTLINE;
    for (const [x, y, w, h] of rects) ctx.fillRect(ox + x - 1, y + dy - 1, w + 2, h + 2);
  }
  for (const [x, y, w, h, c] of rects) {
    ctx.fillStyle = c === 'T' ? p.tunic : c === 'S' ? p.tunicShade : c;
    ctx.fillRect(ox + x, y + dy, w, h);
  }
}

/**
 * One row of untrimmed 64x64 cells. The original 32x48 art sits at (16,16).
 * Faces RIGHT; feet remain at (32,64) in every cell.
 */
export function drawAdventurerSheet(
  ctx: CanvasRenderingContext2D,
  palette: AdventurerPalette,
): void {
  ctx.save();
  ctx.translate(0, 16);
  CHARACTER_FRAMES.forEach((name, i) => {
    const ox = i * SPRITE_CELL.width + 16;
    if (name === 'death') {
      blit(
        ctx,
        ox,
        0,
        [
          [3, 39, 10, 8, SKIN],
          [13, 38, 10, 9, 'T'],
          [23, 41, 7, 6, PANTS],
        ],
        palette,
      );
      return;
    }
    const { dy, legs, back, front, rear = false } = POSES[name];
    for (const arm of back) blit(ctx, ox, dy, arm, palette);
    blit(ctx, ox, 0, leg(11, legs[0], PANTS_SHADE, BOOT_SHADE, rear), palette);
    blit(ctx, ox, 0, leg(17, legs[1], PANTS, BOOT, rear), palette);
    blit(ctx, ox, dy, TORSO, palette);
    blit(ctx, ox, dy, torsoDetail(rear), palette, false);
    blit(ctx, ox, dy, head(rear), palette);
    blit(ctx, ox, dy, face(rear), palette, false);
    for (const arm of front) blit(ctx, ox, dy, arm, palette);
  });
  ctx.restore();
}
