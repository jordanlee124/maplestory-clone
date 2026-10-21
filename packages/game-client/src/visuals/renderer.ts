import Phaser from 'phaser';
import {
  attachmentPosition,
  sampleVisual,
  validateVisual,
  type VisualAsset,
  type Point,
} from './model';

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
    if (!scene.textures.exists(a.key)) scene.load.image(a.key, a.url);
  }
}

export function registerVisuals(
  scene: Phaser.Scene,
  assets: readonly VisualAsset[],
  allowCandidate = false,
  allowMissing = false,
) {
  const loaded: VisualAsset[] = [];
  for (const a of assets) {
    validateVisual(a, allowCandidate);
    if (!scene.textures.exists(a.key)) {
      if (allowMissing) continue;
      throw new Error(`Visual failed to load: ${a.key}`);
    }
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
    loaded.push(a);
  }
  return loaded;
}

type FacingDepth = number | { left: number; right: number };
export interface ActorLayer {
  asset: VisualAsset;
  depth: FacingDepth;
  /** Root-body anchor, e.g. head or hand; omitted means the shared feet anchor. */
  attachTo?: string;
  /** Independent loop, such as face blink. Otherwise follows the body action. */
  independent?: string;
  actionDepth?: Record<string, FacingDepth>;
  offsets?: Record<string, Point>;
  hiddenDuring?: readonly string[];
}

/** Frame pivots and body anchors replace a shared cell-size restriction. */
export class LayeredActor {
  private action = 'idle';
  private started = 0;
  private speed = 1;
  private independentStarted = 0;
  private independentElapsed = 0;
  private layers: { def: ActorLayer; sprite: Phaser.GameObjects.Sprite }[];
  get sprite() {
    return this.layers[0]!.sprite;
  }
  constructor(
    private scene: Phaser.Scene,
    public body: VisualAsset,
    layers: ActorLayer[],
  ) {
    if (layers[0]?.asset !== body) throw new Error('Body must be the first actor layer');
    this.validateLayers(layers);
    this.layers = layers.map((def) => ({
      def,
      sprite: scene.add.sprite(0, 0, def.asset.key, def.asset.frames[0]!.name),
    }));
  }
  private validateLayers(layers: ActorLayer[], body = this.body) {
    for (const layer of layers) {
      const clips = layer.independent ? [layer.independent] : ['idle'];
      if (clips.some((clip) => !layer.asset.clips[clip]))
        throw new Error(`${layer.asset.key}: incomplete layer clips`);
      if (layer.attachTo && body.frames.some((frame) => !frame.anchors?.[layer.attachTo!]))
        throw new Error(`${body.key}: missing ${layer.attachTo} anchor`);
    }
  }
  setLayers(layers: ActorLayer[]) {
    const root = layers[0];
    if (!root || root.attachTo || root.independent)
      throw new Error('Body must be the first actor layer');
    this.validateLayers(layers, root.asset);
    const replacements = layers.slice(1).map((def) => ({
      def,
      sprite: this.scene.add.sprite(0, 0, def.asset.key, def.asset.frames[0]!.name),
    }));
    this.layers.slice(1).forEach((l) => l.sprite.destroy());
    const sprite = this.layers[0]!.sprite;
    if (root.asset !== this.body) sprite.setTexture(root.asset.key, root.asset.frames[0]!.name);
    this.body = root.asset;
    if (!this.body.clips[this.action]) this.play('idle');
    this.layers = [{ def: root, sprite }, ...replacements];
  }
  setPlaybackSpeed(speed: number) {
    if (!Number.isFinite(speed) || speed < 0 || speed > 4)
      throw new Error('Playback speed must be 0–4');
    this.elapsed = this.currentElapsed();
    this.independentElapsed += (this.scene.time.now - this.independentStarted) * this.speed;
    this.independentStarted = this.scene.time.now;
    this.started = this.scene.time.now;
    this.speed = speed;
  }
  private elapsed = 0;
  private currentElapsed() {
    return this.elapsed + (this.scene.time.now - this.started) * this.speed;
  }
  anchors(x: number, y: number, flip = false, scale = 1) {
    const frame = sampleVisual(this.body, this.action, this.currentElapsed());
    return Object.fromEntries(
      Object.keys(frame.anchors ?? {}).map((anchor) => [
        anchor,
        attachmentPosition({ x, y }, frame, anchor, flip, scale),
      ]),
    );
  }
  play(action: string, initialElapsed = 0) {
    if (!this.body.clips[action]) throw new Error(`${this.body.key}: missing action ${action}`);
    this.action = action;
    this.started = this.scene.time.now;
    this.elapsed = initialElapsed;
  }
  update(x: number, y: number, flip = false, scale = 1, depth = 20) {
    const now = this.scene.time.now;
    const elapsed = this.currentElapsed();
    const bodyFrame = sampleVisual(this.body, this.action, elapsed);
    for (const { def, sprite } of this.layers) {
      const clip = def.independent ?? (def.asset.clips[this.action] ? this.action : 'idle');
      const bodyDuration = this.body.clips[this.action]!.durations.reduce((a, b) => a + b, 0);
      const layerDuration = def.asset.clips[clip]!.durations.reduce((a, b) => a + b, 0);
      const independentTime =
        this.independentElapsed + (now - this.independentStarted) * this.speed;
      const f = sampleVisual(
        def.asset,
        clip,
        def.independent ? independentTime : (elapsed * layerDuration) / bodyDuration,
      );
      const point = def.attachTo
        ? attachmentPosition({ x, y }, bodyFrame, def.attachTo, flip, scale)
        : { x, y };
      const order = def.actionDepth?.[this.action] ?? def.depth;
      const offset = def.offsets?.[bodyFrame.name] ?? { x: 0, y: 0 };
      sprite
        .setFrame(f.name)
        .setOrigin((flip ? f.width - f.pivot.x : f.pivot.x) / f.width, f.pivot.y / f.height)
        .setPosition(point.x + offset.x * scale * (flip ? -1 : 1), point.y + offset.y * scale)
        .setFlipX(flip)
        .setScale(scale)
        .setDepth(depth + (typeof order === 'number' ? order : flip ? order.left : order.right));
      if (def.hiddenDuring) sprite.setVisible(!def.hiddenDuring.includes(this.action));
    }
  }
  destroy() {
    this.layers.forEach((l) => l.sprite.destroy());
    this.layers = [];
  }
  setStyle(alpha: number, tint?: number, fill = false) {
    for (const { sprite } of this.layers) {
      sprite.setAlpha(alpha);
      if (tint === undefined) sprite.clearTint();
      else if (fill) sprite.setTintFill(tint);
      else sprite.setTint(tint);
    }
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
