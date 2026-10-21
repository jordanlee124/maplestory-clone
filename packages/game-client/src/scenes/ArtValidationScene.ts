import Phaser from 'phaser';
import { createPixelGame } from '../pixelGame';
import { cameraZoom, type VisualAsset } from '../visuals/model';
import { ACTIONS, VALIDATION_ASSETS, VALIDATION_SLOTS } from '../visuals/validationAssets';
import { REVIEW_ASSETS, REVIEW_FROG_SCALE, REVIEW_PLAYER_SCALE } from '../visuals/reviewAssets';
import { VALIDATION_CANDIDATES, REVIEW_TWIG_SCALE } from '../visuals/validationCandidates';

const SCENE_ASSETS = [
  ...VALIDATION_ASSETS,
  ...REVIEW_ASSETS.filter((a) => !VALIDATION_ASSETS.some((b) => b.key === a.key)),
  ...VALIDATION_CANDIDATES,
];
import {
  addAmbientParticles,
  addParallax,
  LayeredActor,
  playVisualEffect,
  queueVisuals,
  registerVisuals,
  type ActorLayer,
} from '../visuals/renderer';

/** Isolated art calibration. No room, command transmission, damage or rewards. */
export class ArtValidationScene extends Phaser.Scene {
  private actor?: LayeredActor;
  private frog?: LayeredActor;
  private twig?: LayeredActor;
  private twigAction = 'idle';
  private loaded: readonly VisualAsset[] = [];
  private action: string = 'idle';
  private flip = false;
  private guides!: Phaser.GameObjects.Graphics;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private guideObjects: Phaser.GameObjects.GameObject[] = [];
  private rootX = 500;
  private rootY = 520;
  private status!: Phaser.GameObjects.Text;
  private pausedPreview = false;
  private asset(key: string) {
    return this.loaded.find((a) => a.key === key);
  }
  constructor(private readonly onReady: (keys: readonly string[]) => void = () => {}) {
    super('ArtValidationScene');
  }
  preload() {
    queueVisuals(this, SCENE_ASSETS, true);
  }
  create() {
    // Review-only fallback: show missing slots; gameplay keeps mandatory art loading strict.
    this.loaded = registerVisuals(this, SCENE_ASSETS, true, true);
    this.cameras.main.setBackgroundColor('#d4e7da').setRoundPixels(true);
    const background = [
      ['fern-sky', 0, 0, 0, 0],
      ['fern-far', -96, -48, 0.12, 2],
      ['fern-mid', 0, 0, 0.4, 5],
      ['fern-front', -384, -216, 1.15, 40],
      ['fern-platform', 640, 520, 1, 10],
    ] as const;
    for (const [key, x, y, factor, depth] of background) {
      const a = this.asset(key);
      if (a) {
        const image = addParallax(this, a, x, y, factor, depth);
        if (key === 'fern-far') image.setDisplaySize(1536, 864).setAlpha(0.86);
        if (key === 'fern-front') image.setDisplaySize(2048, 1152);
        if (key === 'fern-platform') image.setScale(800 / 2021);
      }
    }
    const body = this.asset('adventurer-body');
    if (body) {
      const layers: ActorLayer[] = [{ asset: body, depth: 0 }];
      for (const [key, depth, attachTo, independent] of [
        ['adventurer-hair-back', -2, 'head', undefined],
        ['adventurer-outfit', 1, undefined, undefined],
        ['adventurer-face', 2, 'head', 'blink'],
        ['adventurer-hair-front', 3, 'head', undefined],
        ['adventurer-weapon', 4, 'hand', undefined],
        ['adventurer-accessory', 5, 'head', 'sway'],
      ] as const) {
        const a = this.asset(key);
        if (a) layers.push({ asset: a, depth, attachTo, independent });
      }
      this.actor = new LayeredActor(this, body, layers);
    }
    const frog = this.asset('fern-frog');
    if (frog) this.frog = new LayeredActor(this, frog, [{ asset: frog, depth: 0 }]);
    const twig = this.asset('twig-creature');
    if (twig) this.twig = new LayeredActor(this, twig, [{ asset: twig, depth: 0 }]);
    const mote = this.asset('ambient-mote');
    if (mote) addAmbientParticles(this, mote);

    // These are measurement guides, never fallback game artwork.
    this.guides = this.add.graphics().setDepth(80);
    this.guides.lineStyle(1, 0x627d95, 0.8).strokeRect(240, 520, 800, 72);
    this.guides
      .lineStyle(1, 0x96d9ce)
      .strokeRect(488, 472, 24, 48)
      .strokeRect(744, 492, 32, 28)
      .strokeRect(906, 488, 28, 32);
    this.guides.lineStyle(1, 0xb4a0d9, 0.8);
    for (const h of [64, 80, 96]) this.guides.strokeRect(455, 520 - h, 90, h);
    this.guideObjects.push(this.guides);
    const label = (x: number, y: number, text: string, size = 14) =>
      this.add
        .text(x, y, text, {
          fontFamily: 'sans-serif',
          fontSize: `${size}px`,
          color: '#dae9ee',
          lineSpacing: 5,
        })
        .setDepth(101);
    this.guideObjects.push(
      label(255, 600, 'PLATFORM SLOT · surface y=520 · decorative roots may extend below'),
    );
    this.guideObjects.push(
      label(
        390,
        370,
        'ADVENTURER SLOT\n64 / 80 / 96 px visual-height trials\n24×48 collision guide',
      ),
    );
    this.guideObjects.push(label(705, 420, 'FERN FROG SLOT\n32×28 collision guide'));
    this.guideObjects.push(label(875, 405, 'TWIG STUDY\n28×32 collision guide'));

    const worldObjects = [...this.children.list];
    const panel = this.asset('ui-panel');
    const panelObject = panel
      ? addParallax(this, panel, 848, 112, 0, 100).setDisplaySize(400, 400 / 3)
      : this.add.graphics().lineStyle(1, 0x627d95).strokeRect(960, 120, 288, 120).setDepth(100);
    const panelLabel = label(
      920,
      165,
      panel ? 'SAMPLE HUD · Lv 12 · art review only' : 'UI PANEL SLOT\nArtwork unavailable',
      11,
    );
    const hud: Phaser.GameObjects.GameObject[] = [panelObject, panelLabel];
    if (panel) {
      for (const [i, name, value, max, color] of [
        [0, 'HP', 72, 100, 0xe47d85],
        [1, 'MP', 38, 60, 0x80b9ec],
        [2, 'EXP', 44, 100, 0xeac66f],
      ] as const) {
        const y = 190 + i * 11;
        hud.push(
          this.add.rectangle(960, y, 240, 8, 0x111e28).setOrigin(0).setDepth(101),
          this.add
            .rectangle(960, y, (240 * value) / max, 8, color)
            .setOrigin(0)
            .setDepth(102),
          label(930, y - 1, name, 10).setDepth(103),
          label(1050, y - 1, `${value} / ${max}`, 9).setDepth(103),
        );
      }
    }
    const title = label(24, 20, 'FERNREACH / ART VALIDATION', 24).setScrollFactor(0);
    this.status = label(24, 56, '').setScrollFactor(0);
    const missing = VALIDATION_SLOTS.filter(([key]) => !this.asset(key));
    const inventory = label(
      24,
      100,
      `LOADED: ${this.loaded.length} · APPROVED: ${VALIDATION_ASSETS.length}\n` +
        missing.map(([key]) => `Missing · ${key}`).join('\n'),
      12,
    ).setScrollFactor(0);
    this.uiCamera = this.cameras.add(0, 0, 1280, 720);
    this.uiCamera.ignore(worldObjects);
    this.cameras.main.ignore([title, this.status, inventory, ...hud]);
    inventory.setVisible(this.loaded.length !== SCENE_ASSETS.length);
    title
      .setText('FERNREACH · ART VALIDATION · TWIG / HUD CANDIDATES')
      .setFontSize(17)
      .setBackgroundColor('#123039dd')
      .setPadding(8);
    this.status.setBackgroundColor('#123039dd').setPadding(8).setY(62);
    this.setGuides(false);
    const shutdown = () => {
      this.actor?.destroy();
      this.frog?.destroy();
      this.twig?.destroy();
    };
    this.events.once('shutdown', shutdown);
    this.game.canvas.parentElement!.dataset.ready = 'true';
    this.refreshStatus();
    this.onReady(this.loaded.map((a) => a.key));
  }
  private refreshStatus() {
    this.status.setText(
      `6 direction-approved assets · Twig/HUD awaiting review · zoom ${this.cameras.main.zoom} · ${this.action}\nDraft animation coverage. Preview values only; no room or gameplay commands.`,
    );
  }
  setZoom(value: number) {
    this.cameras.main.setZoom(cameraZoom(value));
    this.refreshStatus();
  }
  setAction(action: string) {
    if (!(ACTIONS as readonly string[]).includes(action))
      throw new Error('Unknown validation action');
    if (this.actor && !this.asset('adventurer-body')?.clips[action])
      throw new Error('This study has no authored pose for that action');
    this.action = action;
    // Selecting a pose while paused holds its contact/cast frame for repeatable review.
    this.actor?.play(action, this.pausedPreview ? (action === 'attack' ? 120 : 180) : 0);
    this.actor?.update(this.rootX, this.rootY, this.flip, REVIEW_PLAYER_SCALE);
    if (action === 'attack' || action === 'skill') {
      const effect = this.asset(action === 'attack' ? 'attack-effect' : 'skill-effect');
      if (effect) {
        const sprite = playVisualEffect(
          this,
          effect,
          'play',
          this.rootX + (this.flip ? -50 : 50),
          this.rootY - 8,
          30,
          this.flip,
          this.pausedPreview ? 230 : 0,
        ).setScale(0.33);
        this.uiCamera.ignore(sprite);
      }
    }
    this.refreshStatus();
  }
  setFacing(left: boolean) {
    this.flip = left;
    this.update();
  }
  setTwigAction(action: string) {
    const asset = this.asset('twig-creature');
    if (!asset?.clips[action]) throw new Error('Unknown Twig study action');
    this.twigAction = action;
    this.twig?.play(action, this.pausedPreview && action === 'attack' ? 120 : 0);
    this.update();
  }
  setGuides(visible: boolean) {
    for (const obj of this.guideObjects) (obj as Phaser.GameObjects.Graphics).setVisible(visible);
  }
  pan(x: number) {
    this.cameras.main.setScroll(x, 0);
  }
  pausePreview(paused: boolean) {
    this.pausedPreview = paused;
    if (paused) this.scene.pause();
    else {
      this.scene.resume();
      this.events.once('update', () => this.setAction(this.action));
    }
  }
  override update() {
    this.actor?.update(this.rootX, this.rootY, this.flip, REVIEW_PLAYER_SCALE);
    this.frog?.update(760, 520, false, REVIEW_FROG_SCALE, 22);
    this.twig?.update(920, 520, this.flip, REVIEW_TWIG_SCALE, 22);
  }
  snapshot() {
    return {
      zoom: this.cameras.main.zoom,
      action: this.action,
      flip: this.flip,
      scrollX: this.cameras.main.scrollX,
      approved: VALIDATION_ASSETS.map((a) => a.key),
      candidates: this.loaded.filter((a) => a.candidate).map((a) => a.key),
      actor: this.actor?.snapshot(),
      frog: this.frog?.snapshot(),
      twig: this.twig?.snapshot(),
      twigAction: this.twigAction,
      hud: { sample: true, panel: !!this.asset('ui-panel') },
      effects: this.children.list
        .filter(
          (o): o is Phaser.GameObjects.Sprite =>
            o instanceof Phaser.GameObjects.Sprite && o.texture.key === 'skill-effect',
        )
        .map((o) => o.frame.name),
      missing: VALIDATION_SLOTS.filter(([k]) => !this.asset(k)).map(([k]) => k),
      slotsOnly: this.loaded.length === 0,
      logical: { width: 1280, height: 720 },
      collision: { player: { width: 24, height: 48 }, frog: { width: 32, height: 28 } },
    };
  }
}

export function startArtValidation(
  parent: HTMLElement,
  onReady: (keys: readonly string[]) => void,
) {
  const scene = new ArtValidationScene(onReady);
  const game = createPixelGame(parent, [scene], { mixedFiltering: true });
  const debug = window as unknown as {
    cindervaleValidation?: () => ReturnType<ArtValidationScene['snapshot']>;
  };
  debug.cindervaleValidation = () => scene.snapshot();
  return {
    zoom: (n: number) => scene.setZoom(n),
    action: (a: string) => scene.setAction(a),
    twigAction: (a: string) => scene.setTwigAction(a),
    facing: (left: boolean) => scene.setFacing(left),
    guides: (visible: boolean) => scene.setGuides(visible),
    pan: (x: number) => scene.pan(x),
    pause: (paused: boolean) => scene.pausePreview(paused),
    stop: () => {
      delete debug.cindervaleValidation;
      game.destroy(true);
    },
  };
}
