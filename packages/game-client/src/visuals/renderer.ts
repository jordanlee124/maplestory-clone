import Phaser from 'phaser';
import { attachmentPosition, sampleVisual, validateVisual, type VisualAsset } from './model';

/** No procedural fallback: every entry requires a recorded original-art approval. */
export function queueVisuals(
  scene: Phaser.Scene,
  assets: readonly VisualAsset[],
  allowCandidate = false,
) {
  const keys = new Set<string>();
  for (const a of assets) {
    validateVisual(a, allowCandidate);
    if (keys.has(a.key)) throw new Error(`Duplicate visual: ${a.key}`);
    keys.add(a.key);
    scene.load.image(a.key, a.url);
  }
}

export function registerVisuals(
  scene: Phaser.Scene,
  assets: readonly VisualAsset[],
  allowCandidate = false,
) {
  for (const a of assets) {
    validateVisual(a, allowCandidate);
    if (!scene.textures.exists(a.key)) throw new Error(`Visual failed to load: ${a.key}`);
    const texture = scene.textures.get(a.key);
    const image = texture.getSourceImage() as HTMLImageElement;
    if (image.width !== a.size.width || image.height !== a.size.height)
      throw new Error(`Visual dimensions differ: ${a.key}`);
    texture.setFilter(
      a.filter === 'nearest'
        ? Phaser.Textures.FilterMode.NEAREST
        : Phaser.Textures.FilterMode.LINEAR,
    );
    for (const f of a.frames)
      if (!texture.has(f.name)) texture.add(f.name, 0, f.x, f.y, f.width, f.height);
  }
}

export interface ActorLayer {
  asset: VisualAsset;
  depth: number;
  /** Root-body anchor, e.g. head or hand; omitted means the shared feet anchor. */
  attachTo?: string;
  /** Independent loop, such as face blink. Otherwise follows the body action. */
  independent?: string;
  actionDepth?: Record<string, number>;
}

/** Frame pivots and body anchors replace a shared cell-size restriction. */
export class LayeredActor {
  private action = 'idle';
  private started = 0;
  private layers: { def: ActorLayer; sprite: Phaser.GameObjects.Sprite }[];
  get sprite() {return this.layers[0]!.sprite;}
  constructor(
    private scene: Phaser.Scene,
    readonly body: VisualAsset,
    layers: ActorLayer[],
  ) {
    if (layers[0]?.asset !== body) throw new Error('Body must be the first actor layer');
    for (const layer of layers) {
      const clips = layer.independent ? [layer.independent] : Object.keys(body.clips);
      if (clips.some((clip) => !layer.asset.clips[clip]))
        throw new Error(`${layer.asset.key}: incomplete layer clips`);
      if (layer.attachTo && body.frames.some((frame) => !frame.anchors?.[layer.attachTo!]))
        throw new Error(`${body.key}: missing ${layer.attachTo} anchor`);
    }
    this.layers = layers.map((def) => ({
      def,
      sprite: scene.add.sprite(0, 0, def.asset.key, def.asset.frames[0]!.name),
    }));
  }
  play(action: string, initialElapsed = 0) {
    if (!this.body.clips[action]) throw new Error(`${this.body.key}: missing action ${action}`);
    this.action = action;
    this.started = this.scene.time.now - initialElapsed;
  }
  update(x: number, y: number, flip = false, scale = 1, depth = 20) {
    const now = this.scene.time.now;
    const bodyFrame = sampleVisual(this.body, this.action, now - this.started);
    for (const { def, sprite } of this.layers) {
      const clip = def.independent ?? this.action;
      const f = sampleVisual(def.asset, clip, def.independent ? now : now - this.started);
      const point = def.attachTo
        ? attachmentPosition({ x, y }, bodyFrame, def.attachTo, flip, scale)
        : { x, y };
      sprite
        .setFrame(f.name)
        .setOrigin((flip ? f.width - f.pivot.x : f.pivot.x) / f.width, f.pivot.y / f.height)
        .setPosition(point.x, point.y)
        .setFlipX(flip)
        .setScale(scale)
        .setDepth(depth + (def.actionDepth?.[this.action] ?? def.depth));
    }
  }
  destroy() {
    this.layers.forEach((l) => l.sprite.destroy());
  }
  snapshot() {
    return this.layers.map(({ sprite }) => ({
      key: sprite.texture.key,
      frame: sprite.frame.name,
      x: sprite.x,
      y: sprite.y,
      scale: sprite.scaleX,
      depth: sprite.depth,
    }));
  }
}

export function addParallax(
  scene: Phaser.Scene,
  asset: VisualAsset,
  x: number,
  y: number,
  factor: number,
  depth: number,
) {
  const f = sampleVisual(asset, 'idle', 0);
  return scene.add
    .image(x, y, asset.key, f.name)
    .setOrigin(f.pivot.x / f.width, f.pivot.y / f.height)
    .setScrollFactor(factor)
    .setDepth(depth);
}

/** Finite effect lifetime, independent texture size/clock, no gameplay outcome. */
export function playVisualEffect(
  scene: Phaser.Scene,
  asset: VisualAsset,
  clip: string,
  x: number,
  y: number,
  depth: number,
  flip = false,
  initialElapsed = 0,
) {
  if (!asset.clips[clip] || asset.clips[clip].loop)
    throw new Error('Effects require a finite clip');
  const started = scene.time.now - initialElapsed;
  const duration = asset.clips[clip].durations.reduce((a, b) => a + b, 0);
  const sprite = scene.add
    .sprite(x, y, asset.key, asset.frames[0]!.name)
    .setDepth(depth)
    .setFlipX(flip);
  const cleanup = () => {
    scene.events.off('update', update);
    scene.events.off('shutdown', cleanup);
    sprite.destroy();
  };
  const update = () => {
    if (scene.time.now - started >= duration) {
      cleanup();
      return;
    }
    const f = sampleVisual(asset, clip, scene.time.now - started);
    sprite
      .setFrame(f.name)
      .setOrigin((flip ? f.width - f.pivot.x : f.pivot.x) / f.width, f.pivot.y / f.height);
  };
  scene.events.on('update', update);
  scene.events.once('shutdown', cleanup);
  update();
  return sprite;
}

export function addAmbientParticles(scene: Phaser.Scene, asset: VisualAsset) {
  return scene.add
    .particles(0, 0, asset.key, {
      frame: asset.frames[0]!.name,
      x: { min: 80, max: 1200 },
      y: { min: 100, max: 450 },
      lifespan: 2400,
      frequency: 400,
      speedY: -10,
      speedX: { min: -8, max: 8 },
      alpha: { start: 0.4, end: 0 },
      maxParticles: 12,
    })
    .setDepth(12);
}
