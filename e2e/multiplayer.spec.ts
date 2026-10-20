import { expect, test } from '@playwright/test';
import { enterWorld, players, xOf } from './helpers';

// Phase 0 success condition: two authenticated players share a map, see each other
// move, and a player reconnects (page reload) without losing their character.

test('two players see each other move and survive a reload', async ({ browser }) => {
  const suffix = String(Date.now() % 100_000);
  const [nameA, nameB] = [`Ann${suffix}`, `Ben${suffix}`];
  const [ctxA, ctxB] = [await browser.newContext(), await browser.newContext()];
  // Close them afterwards: two Phaser games left rendering starve later tests on slow CI.
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await enterWorld(pageA, nameA);
  await enterWorld(pageB, nameB);
  await expect.poll(async () => (await players(pageB)).map((p) => p.name)).toContain(nameA);
  const startX = (await xOf(pageB, nameA))!;

  // Frame rate varies a lot across machines (CI renders WebGL in software); record it.
  for (const [label, page] of [
    ['A', pageA],
    ['B', pageB],
  ] as const) {
    const fps = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let frames = 0;
          const start = performance.now();
          const tick = () => {
            frames++;
            if (performance.now() - start < 1000) requestAnimationFrame(tick);
            else resolve(frames);
          };
          requestAnimationFrame(tick);
        }),
    );
    test.info().annotations.push({ type: `fps ${label}`, description: String(fps) });
    console.log(`fps ${label}: ${fps}`);
  }

  // A walks right until B sees it; asserts replication, not speed.
  await pageA.locator('canvas').click();
  await pageA.keyboard.down('ArrowRight');
  await expect.poll(() => xOf(pageB, nameA), { timeout: 15_000 }).toBeGreaterThan(startX + 100);
  await pageA.keyboard.up('ArrowRight');
  // Let the server finish applying in-flight inputs before recording the position.
  let movedX = -1;
  await expect
    .poll(async () => {
      const [prev, next] = [movedX, (await xOf(pageA, nameA))!];
      movedX = next;
      return next === prev;
    })
    .toBe(true);

  // A reloads: same character, same position, still visible to B.
  await pageA.reload();
  await expect(pageA.getByTestId('game')).toHaveAttribute('data-status', 'playing', {
    timeout: 20_000,
  }); // CI loads Phaser slowly
  await expect.poll(() => xOf(pageA, nameA)).toBeCloseTo(movedX, 0);
  await expect
    .poll(async () => (await players(pageB)).filter((p) => p.name === nameA))
    .toHaveLength(1);
  await Promise.all([ctxA.close(), ctxB.close()]);
});

// Phaser caps frame delta while the window is unfocused; movement must still run in real time.
test('moves at real-time speed while unfocused and below 60 fps', async ({ page }) => {
  const name = `Foc${Date.now() % 100_000}`;
  await enterWorld(page, name);
  await page.locator('canvas').click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });

  const x0 = (await xOf(page, name))!;
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowRight');
  // Held >= 1s at 180 px/s; the bug moved ~55 px.
  await expect.poll(() => xOf(page, name), { timeout: 5000 }).toBeGreaterThan(x0 + 150);
});
