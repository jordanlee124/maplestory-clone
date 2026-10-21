import Phaser from 'phaser';
import { integerDisplayScale, VIEWPORT } from './viewport';

/** Fixed logical viewport, nearest filtering, integer CSS zoom and horizontal letterboxing. */
export function createPixelGame(
  parent: HTMLElement,
  scenes: Phaser.Types.Scenes.SceneType[],
  options: { mixedFiltering?: boolean } = {},
) {
  const zoom = integerDisplayScale(parent.clientWidth);
  parent.style.height = `${VIEWPORT.height * zoom}px`;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    ...VIEWPORT,
    pixelArt: !options.mixedFiltering,
    roundPixels: true,
    antialias: !!options.mixedFiltering,
    antialiasGL: !!options.mixedFiltering,
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.NONE, zoom, autoRound: true },
    scene: scenes,
  });
  const resize = () => {
    if (!game.isBooted) return;
    const next = integerDisplayScale(parent.clientWidth);
    parent.style.height = `${VIEWPORT.height * next}px`;
    if (game.scale.zoom !== next) game.scale.setZoom(next);
    game.canvas.style.display = 'block';
    game.canvas.style.marginLeft = `${Math.max(0, Math.floor((parent.clientWidth - VIEWPORT.width * next) / 2))}px`;
    game.canvas.style.marginRight = '0';
    game.scale.updateBounds();
    game.canvas.style.imageRendering = 'pixelated';
  };
  const observer = new ResizeObserver(resize);
  observer.observe(parent);
  game.events.once('ready', resize);
  game.events.once('destroy', () => observer.disconnect());
  return game;
}
