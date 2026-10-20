import { stepBody, type Body, type MapGeometry, type MoveInput } from '@cindervale/game-core';
import type { InputMessage } from '@cindervale/protocol';

/**
 * Client-side prediction: apply inputs locally right away, keep them until the server
 * acknowledges them (lastSeq), then replay the unacknowledged ones on top of the
 * authoritative state. Uses the same deterministic stepBody as the server.
 */
export class Predictor {
  private pending: InputMessage[] = [];

  constructor(
    public body: Body,
    private nextSeq: number,
    private readonly map: MapGeometry,
  ) {}

  step(input: MoveInput): InputMessage {
    const msg: InputMessage = { seq: this.nextSeq++, ...input };
    this.body = stepBody(this.body, input, this.map);
    this.pending.push(msg);
    return msg;
  }

  reconcile(server: Body, lastSeq: number) {
    this.pending = this.pending.filter((p) => p.seq > lastSeq);
    this.body = this.pending.reduce((b, p) => stepBody(b, p, this.map), {
      x: server.x,
      y: server.y,
      vx: server.vx,
      vy: server.vy,
      grounded: server.grounded,
    });
  }

  get pendingCount() {
    return this.pending.length;
  }
}
