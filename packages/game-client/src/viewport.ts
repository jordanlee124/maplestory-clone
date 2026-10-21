/** Fixed world/HUD resolution; presentation scales in whole multiples, never fractional FIT. */
export const VIEWPORT = { width: 1280, height: 720 } as const;

export const integerDisplayScale = (availableWidth: number) =>
  Math.max(1, Math.floor(availableWidth / VIEWPORT.width));
