export interface Point {
  x: number;
  y: number;
}
export interface VisualFrame {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Pixel pivot within this frame, retained even outside a trimmed image. */
  pivot: Point;
  anchors?: Record<string, Point>;
}
export interface VisualClip {
  frames: string[];
  durations: number[];
  loop: boolean;
}
interface VisualData {
  key: string;
  url: string;
  size: { width: number; height: number };
  filter: 'nearest' | 'linear';
  frames: VisualFrame[];
  clips: Record<string, VisualClip>;
}
export type VisualAsset = VisualData &
  (
    | {
        approval: { by: string; date: string; provenance: string; license: string };
        candidate?: never;
      }
    | { candidate: { date: string; provenance: string }; approval?: never }
  );

export function validateVisual(asset: VisualAsset, allowCandidate = false) {
  const fail = () => {
    throw new Error(`Invalid visual or unapproved candidate: ${asset.key}`);
  };
  const source = asset.approval ?? (allowCandidate ? asset.candidate : undefined);
  const fields = asset.approval ? ['by', 'date', 'provenance', 'license'] : ['date', 'provenance'];
  if (
    !source ||
    !fields.every((k) => Object.hasOwn(source, k)) ||
    !Object.values(source).every((v) => typeof v === 'string' && v.trim())
  )
    fail();
  if (
    !/^[a-z0-9-]+$/.test(asset.key) ||
    !asset.url.startsWith('/assets/') ||
    !asset.url.endsWith('.png') ||
    asset.url.includes('..') ||
    !['nearest', 'linear'].includes(asset.filter) ||
    ![asset.size.width, asset.size.height].every((n) => Number.isInteger(n) && n > 0) ||
    !asset.frames.length ||
    new Set(asset.frames.map((f) => f.name)).size !== asset.frames.length
  )
    fail();
  for (const f of asset.frames) {
    if (
      !f.name ||
      ![f.x, f.y, f.width, f.height].every(Number.isInteger) ||
      f.x < 0 ||
      f.y < 0 ||
      f.width <= 0 ||
      f.height <= 0 ||
      f.x + f.width > asset.size.width ||
      f.y + f.height > asset.size.height ||
      ![f.pivot, ...Object.values(f.anchors ?? {})].every(
        (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
      )
    )
      fail();
  }
  if (!Object.keys(asset.clips).length) fail();
  for (const c of Object.values(asset.clips)) {
    if (
      !c.frames.length ||
      c.frames.length !== c.durations.length ||
      c.durations.some((n) => !Number.isFinite(n) || n <= 0) ||
      c.frames.some((name) => !asset.frames.some((f) => f.name === name))
    )
      fail();
  }
}

/** Sampling is independent of renderer FPS and supports unequal frame timing. */
export function sampleVisual(asset: VisualAsset, clipName: string, elapsed: number) {
  const clip = asset.clips[clipName];
  if (!clip) throw new Error(`${asset.key}: missing clip ${clipName}`);
  const total = clip.durations.reduce((a, b) => a + b, 0);
  let time = Math.max(0, elapsed);
  time = clip.loop ? time % total : Math.min(time, total - Number.EPSILON);
  let index = 0;
  while (index < clip.frames.length - 1 && time >= clip.durations[index]!) {
    time -= clip.durations[index++]!;
  }
  return asset.frames.find((f) => f.name === clip.frames[index])!;
}

export function attachmentPosition(
  root: Point,
  parent: VisualFrame,
  anchor: string,
  flip: boolean,
  scale = 1,
) {
  const point = parent.anchors?.[anchor];
  if (!point) throw new Error(`Missing attachment anchor: ${anchor}`);
  return {
    x: root.x + (point.x - parent.pivot.x) * scale * (flip ? -1 : 1),
    y: root.y + (point.y - parent.pivot.y) * scale,
  };
}

export function cameraZoom(value: number) {
  if (!Number.isFinite(value) || value < 0.5 || value > 2)
    throw new Error('Camera zoom must be 0.5–2');
  return value;
}
