import { expect, test, type Page } from '@playwright/test';
import { enterWorld, me } from './helpers';

// Phase 0.1: new characters start in Fernreach Fields, can climb ladders, and the Esc
// menu can leave the world. Positions come from the server's synced state.

const LADDER = { x: 1160, top: 360 }; // first ladder in Fernreach Fields (content package)

async function tap(page: Page, key: string, ms = 30) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test('climbs a ladder in Fernreach Fields and exits via the Esc menu', async ({ page }) => {
  const name = `Clm${Date.now() % 100_000}`;
  await enterWorld(page, name);
  expect(
    await page.evaluate(
      () => (window as unknown as { cindervale: { mapId: string } }).cindervale.mapId,
    ),
  ).toBe('fernreach-fields');
  await page.locator('canvas').click();

  // Walk to the ladder, then nudge until within grab range.
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => (await me(page, name)).x, { timeout: 15_000, intervals: [50] })
    .toBeGreaterThan(LADDER.x - 60);
  await page.keyboard.up('ArrowRight');
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(200);
    const { x } = await me(page, name);
    if (Math.abs(x - LADDER.x) <= 6) break;
    await tap(page, x < LADDER.x ? 'ArrowRight' : 'ArrowLeft');
  }

  // Climb to the top and step onto the ledge.
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await me(page, name)).climbing).toBe(true);
  await expect
    .poll(async () => me(page, name), { timeout: 10_000 })
    .toMatchObject({ x: LADDER.x, y: LADDER.top, climbing: false });
  await page.keyboard.up('ArrowUp');

  // Esc → Resume, Toggle debug, Exit: pick Exit.
  await tap(page, 'Escape');
  await tap(page, 'ArrowDown');
  await tap(page, 'ArrowDown');
  await tap(page, 'Enter');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});
