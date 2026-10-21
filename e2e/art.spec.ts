import { expect, test, type Page } from '@playwright/test';

interface ArtSnapshot {
  scale: number;
  cameraZoom: number;
  roundPixels: boolean;
  assets: { key: string; status: string; loaded: boolean; nearest: boolean }[];
  body: { frame: string; x: number; y: number; flipX: boolean; tint: number; depth: number };
  equipment: { frame: string; x: number; y: number; flipX: boolean; tint: number; depth: number }[];
}
const snapshot = (page: Page) =>
  page.evaluate(() => (window as unknown as { cindervaleArt(): ArtSnapshot }).cindervaleArt());

test('art board preserves pose pixels and synchronized equipment overlays', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/art-preview');
  await expect(page.getByTestId('art-preview')).toHaveAttribute('data-ready', 'true', {
    timeout: 20_000,
  });
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const bounds = (await canvas.boundingBox())!;
  expect(bounds.width).toBe(1280);
  expect(bounds.height).toBe(720);
  expect(
    await page.screenshot({
      clip: { x: bounds.x + 100, y: bounds.y + 76, width: 1152, height: 280 },
    }),
  ).toMatchSnapshot('characters.png', { threshold: 0, maxDiffPixels: 0 });
  expect(
    await page.screenshot({
      clip: { x: bounds.x + 100, y: bounds.y + 392, width: 448, height: 208 },
    }),
  ).toMatchSnapshot('monsters.png', { threshold: 0, maxDiffPixels: 0 });
  const visited = new Set<string>();
  const directions = new Set<boolean>();
  for (let i = 0; i < 6; i++) {
    const { body, equipment } = await snapshot(page);
    visited.add(body.frame);
    directions.add(body.flipX);
    expect(equipment).toHaveLength(2);
    for (const layer of equipment) {
      expect(layer).toMatchObject({
        frame: body.frame,
        x: body.x,
        y: body.y,
        flipX: body.flipX,
        tint: body.tint,
      });
    }
    expect(equipment[0]!.depth).toBeLessThan(body.depth);
    expect(equipment[1]!.depth).toBeGreaterThan(body.depth);
    await page.waitForTimeout(400);
  }
  expect(visited.size).toBeGreaterThan(3);
  expect(directions.size).toBe(2);
  const art = await snapshot(page);
  expect(art.assets.filter((a) => a.status === 'approved').every((a) => a.loaded)).toBe(true);
  expect(art.assets.filter((a) => a.status === 'missing').every((a) => !a.loaded)).toBe(true);
  expect(art.assets.filter((a) => a.loaded).every((a) => a.nearest)).toBe(true);
  expect(errors).toEqual([]);
});

for (const deviceScaleFactor of [1, 2]) {
  test(`integer canvas sizing at desktop widths, DPR ${deviceScaleFactor}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor,
    });
    const page = await context.newPage();
    try {
      await page.goto('/art-preview');
      await expect(page.getByTestId('art-preview')).toHaveAttribute('data-ready', 'true', {
        timeout: 20_000,
      });
      for (const [width, height, scale] of [
        [1280, 720, 1],
        [1366, 768, 1],
        [1365, 768, 1],
        [1920, 1080, 1],
        [2560, 1440, 2],
        [3840, 2160, 3],
        [900, 720, 1],
      ] as const) {
        await page.setViewportSize({ width, height });
        await expect
          .poll(async () => (await page.locator('canvas').boundingBox())?.width)
          .toBe(1280 * scale);
        const bounds = (await page.locator('canvas').boundingBox())!;
        expect(bounds.height).toBe(720 * scale);
        expect(Number.isInteger(bounds.x)).toBe(true);
        expect(await page.locator('canvas').getAttribute('width')).toBe('1280');
        expect(await page.locator('canvas').getAttribute('height')).toBe('720');
        expect(
          await page.locator('canvas').evaluate((c) => getComputedStyle(c).imageRendering),
        ).toBe('pixelated');
        expect(await snapshot(page)).toMatchObject({ scale, cameraZoom: 1, roundPixels: true });
      }
    } finally {
      await context.close();
    }
  });
}
