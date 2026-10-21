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

  // Hold Up while approaching so a rendered-frame tap cannot skip the 10px grab band.
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await me(page, name)).climbing, { timeout: 15_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowRight');

  // Climb to the top and step onto the ledge.
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
