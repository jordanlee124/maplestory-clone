import type { Body } from '@cindervale/game-core';
import type Phaser from 'phaser';
import { adventurerKey } from '../art/textures';
import { AnimationStateMachine } from '../combat/animation';
import { assetByKey, type SheetAsset } from '../art/manifest';
import { EquipmentLayers } from './EquipmentLayers';
import { liveVisual, PLAYER_VISUAL_SCALE } from '../visuals/approvedAssets';
import { LayeredActor } from '../visuals/renderer';
import {
  characterClip,
  DEFAULT_APPEARANCE,
  resolveAppearance,
  type CharacterAppearance,
} from './appearance';

/** A player's sprite + name tag, animated from its physics body. */
export class Avatar {
  readonly animation = new AnimationStateMachine();
  private hitAt = -Infinity;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private readonly classId: string;
  readonly equipment?: EquipmentLayers;
  private readonly visual?: LayeredActor;
  private clip = 'idle';
  private appearance: CharacterAppearance = { ...DEFAULT_APPEARANCE };
  private state = 'idle';

  constructor(scene: Phaser.Scene, view: { name: string; classId: string; x: number; y: number }) {
    this.classId = view.classId;
    const asset = assetByKey(adventurerKey(view.classId)) as SheetAsset;
    if (scene.registry.get('approvedArt')) {
      const body = liveVisual('adventurer-body');
      this.visual = new LayeredActor(scene, body, resolveAppearance(this.appearance, body).layers);
      this.sprite = this.visual.sprite;
      this.visual.update(view.x, view.y, false, PLAYER_VISUAL_SCALE, 10);
    } else {
      this.sprite = scene.add
        .sprite(view.x, view.y, adventurerKey(view.classId), 'idle0')
        .setOrigin(asset.origin.x, asset.origin.y)
        .setDepth(10);
      this.equipment = new EquipmentLayers(scene, this.sprite, asset);
    }
    this.label = scene.add
      .text(view.x, view.y + 4, view.name, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#fff',
        backgroundColor: '#0008',
      })
      .setOrigin(0.5, 0)
      .setPadding(3, 1, 3, 1)
      .setDepth(11);
  }

  /** Render position may differ from the body (smoothing); animation follows the body. */
  update(x: number, y: number, body: Body, dead = false) {
    const [rx, ry] = [Math.round(x), Math.round(y)];
    const now = this.sprite.scene.time.now;
    const hitAge = now - this.hitAt;
    // Cosmetic recoil only; the predictor follows authoritative knockback.
    const recoil =
      hitAge < 240 ? Math.round((1 - hitAge / 240) * 5) * (this.sprite.flipX ? 1 : -1) : 0;
    this.sprite.setPosition(rx + recoil, ry);
    this.label.setPosition(rx, ry + 4);
    const { state, phase } = this.animation.sample(now, body, dead);
    if (!phase && state !== 'hit' && state !== 'death' && body.vx !== 0)
      this.sprite.setFlipX(body.vx < 0);
    if (this.visual) {
      const clip = characterClip(this.visual.body, state);
      if (clip !== this.clip || state !== this.state) {
        this.visual.play(clip);
        this.clip = clip;
      }
      this.state = state;
      this.visual.setPlaybackSpeed(state === 'climb' && body.vy === 0 ? 0 : 1);
      this.visual.update(rx + recoil, ry, this.sprite.flipX, PLAYER_VISUAL_SCALE, 10);
      this.visual.setStyle(
        dead ? 0.35 : 1,
        hitAge < 160 ? 0xffeeee : dead ? 0x838383 : undefined,
        hitAge < 160,
      );
    } else if (phase) {
      this.sprite.anims.stop();
      this.sprite.setFrame(`${state}${phase === 'startup' ? 0 : phase === 'active' ? 1 : 2}`);
    } else if (state === 'hit' || state === 'death') {
      this.sprite.anims.stop();
      this.sprite.setFrame(state);
    } else
      this.sprite.play(
        `${adventurerKey(this.classId)}-${state === 'respawn' ? 'idle' : state}`,
        true,
      );
    if (hitAge < 160) this.sprite.setTintFill(0xffeeee);
    else if (dead && this.visual) this.sprite.setTint(0x838383);
    else this.sprite.clearTint();
    // Hang still on a ladder when not climbing.
    if (!this.visual && state === 'climb') {
      if (body.vy === 0) this.sprite.anims.pause();
      else this.sprite.anims.resume();
    }
    this.equipment?.sync();
  }

  attack(skill: boolean, facing: 'left' | 'right') {
    if (!this.animation.attack(this.sprite.scene.time.now, skill)) return;
    this.sprite.setFlipX(facing === 'left');
    if (this.visual) {
      this.clip = skill ? 'skill' : 'attack';
      this.state = this.clip;
      this.visual.play(this.clip);
    }
  }

  setAppearance(appearance: CharacterAppearance) {
    if (this.visual) this.visual.setLayers(resolveAppearance(appearance, this.visual.body).layers);
    this.appearance = { ...appearance, accessories: [...appearance.accessories] };
    this.sprite.setFlipX(appearance.facing === 'left');
  }

  hit() {
    this.hitAt = this.sprite.scene.time.now;
    this.animation.hit(this.hitAt);
  }

  destroy() {
    this.equipment?.destroy();
    if (this.visual) this.visual.destroy();
    else this.sprite.destroy();
    this.label.destroy();
  }
}
