// Browser-only entry: import dynamically from client components (Phaser touches `window`).
import type { PlayerView } from '@cindervale/protocol';
import { joinMap, type GameSession } from './network';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { WorldScene, type WorldHooks } from './scenes/WorldScene';
import { combatEvents } from './combat/events';
import { createPixelGame } from './pixelGame';
import { cameraZoom } from './visuals/model';

export type { GameSession } from './network';
export type { WorldHooks } from './scenes/WorldScene';
export { VIEWPORT } from './viewport';

/** Joins the player's map, then boots Phaser into `parent`. Returns a teardown function. */
export async function startGame(
  parent: HTMLElement,
  session: GameSession,
  hooks: WorldHooks,
): Promise<() => void> {
  cameraZoom(hooks.cameraZoom ?? 1);
  const room = await joinMap(session);
  // The first full state lands asynchronously after the join resolves.
  if (!room.state?.players?.has(room.sessionId)) {
    await new Promise<void>((resolve) => room.onStateChange.once(() => resolve()));
  }

  const game = createPixelGame(parent, [BootScene, PreloadScene, WorldScene], {
    mixedFiltering: room.state.mapId === 'fernreach-fields',
  });
  game.registry.set('room', room);
  game.registry.set('hooks', hooks);

  // Read-only hook for e2e tests and debugging; exposes nothing the client can't already see.
  const debug = window as unknown as { cindervale?: unknown };
  debug.cindervale = {
    sessionId: room.sessionId,
    mapId: room.state.mapId,
    players: () =>
      [...(room.state.players as Map<string, PlayerView>).values()].map(
        ({ name, x, y, climbing }) => ({ name, x, y, climbing }),
      ),
    combat: () =>
      game.scene.isActive('World')
        ? (game.scene.getScene('World') as WorldScene).combatSnapshot()
        : undefined,
  };

  return () => {
    delete debug.cindervale;
    game.scene.stop('World');
    game.destroy(true);
    combatEvents.get(room)?.destroy();
    void room.leave();
  };
}
