import { FIXED_DT, type MapGeometry } from '@cindervale/game-core';
import { ClientMessage, type PlayerView } from '@cindervale/protocol';
import type { Room } from '@colyseus/sdk';
import type Phaser from 'phaser';
import type { createControls } from '../input/controls';
import { Predictor } from '../predictor';
import { Avatar } from './Avatar';

/**
 * The player this client controls: samples input every fixed step, predicts locally with
 * the shared simulation, sends the input to the server, and reconciles on state patches.
 * It never decides outcomes; the server's state always wins.
 */
export class LocalPlayer {
  readonly avatar: Avatar;
  readonly predictor: Predictor;
  private accumulator = 0;
  private lastTime?: number;

  constructor(
    scene: Phaser.Scene,
    private readonly room: Room,
    private readonly controls: ReturnType<typeof createControls>,
    view: PlayerView,
    map: MapGeometry,
  ) {
    this.predictor = new Predictor({ ...view }, view.lastSeq + 1, map);
    this.avatar = new Avatar(scene, view);
  }

  get body() {
    return this.predictor.body;
  }

  reconcile(view: PlayerView) {
    this.predictor.reconcile(view, view.lastSeq);
  }

  update(time: number, inputEnabled: boolean) {
    // Raw frame time, not Phaser's `delta`: Phaser caps delta at 16.7ms while the window is
    // unfocused, which would run the simulation in slow motion below 60 fps.
    const elapsed = this.lastTime === undefined ? 0 : time - this.lastTime;
    this.lastTime = time;
    this.accumulator += Math.min(elapsed, 250) / 1000;
    while (this.accumulator >= FIXED_DT) {
      const input = this.predictor.step(this.controls.read(inputEnabled));
      this.room.send(ClientMessage.Input, input);
      this.accumulator -= FIXED_DT;
    }
    const b = this.predictor.body;
    this.avatar.update(b.x, b.y, b);
  }
}
