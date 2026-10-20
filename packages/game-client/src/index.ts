// Browser-only entry: import dynamically from client components (Phaser touches `window`).
import type { PlayerView } from '@cindervale/protocol';
import Phaser from 'phaser';
import { joinMap, type GameSession } from './network';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { WorldScene } from './scenes/WorldScene';

export type { GameSession } from './network';

export const VIEWPORT = { width: 1280, height: 720 } as const;

/** Joins the player's map, then boots Phaser into `parent`. Returns a teardown function. */
export async function startGame(parent: HTMLElement, session: GameSession): Promise<() => void> {
  const room = await joinMap(session);
  // The first full state lands asynchronously after the join resolves.
  if (!room.state?.players?.has(room.sessionId)) {
    await new Promise<void>((resolve) => room.onStateChange.once(() => resolve()));
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, PreloadScene, WorldScene],
  });
  game.registry.set('room', room);

  // Read-only hook for e2e tests and debugging; exposes nothing the client can't already see.
  const debug = window as unknown as { cindervale?: unknown };
  debug.cindervale = {
    sessionId: room.sessionId,
    players: () =>
      [...(room.state.players as Map<string, PlayerView>).values()].map(({ name, x, y }) => ({
        name,
        x,
        y,
      })),
  };

  return () => {
    delete debug.cindervale;
    void room.leave();
    game.destroy(true);
  };
}
