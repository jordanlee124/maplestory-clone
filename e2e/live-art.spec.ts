import { expect, test } from '@playwright/test';
import { enterWorld } from './helpers';

test('live Fernreach loads approved art at real gameplay coordinates', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let joins = 0;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname.startsWith('/matchmake/joinOrCreate/')) joins++;
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await enterWorld(page, `Art${Date.now() % 1000000}`);
  expect(joins, 'a canceled React mount must not join a second room').toBe(1);
  const state = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          cindervale: {
            combat: () => {
              appearance: { style: string; playerTexture: string; playerScale: number };
              hud: { panel: string; stats: string };
              renderedMonsters: { texture: string }[];
            };
          };
        }
      ).cindervale.combat(),
    );
  await expect
    .poll(async () => (await state()).appearance.playerTexture)
    .toBe('approved-adventurer-body');
  expect((await state()).appearance.style).toBe('approved-fernreach');
  expect(
    (await state()).renderedMonsters.filter((m) => m.texture === 'approved-fern-frog'),
  ).toHaveLength(5);
  expect(
    (await state()).renderedMonsters.filter((m) => m.texture === 'approved-twig-creature'),
  ).toHaveLength(4);
  expect((await state()).hud.panel).toBe('approved-ui-panel');
  await expect.poll(async () => (await state()).hud.stats).toMatch(/Lv 1.*Art/);
  expect((await state()).hud.stats).toMatch(/HP \d+\/\d+/);
  expect((await state()).hud.stats).not.toContain('SAMPLE');
  expect((await state()).appearance.playerScale).toBeCloseTo(96 / 426);
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('live-fernreach-1280x720.png') });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect.poll(async () => (await page.locator('canvas').boundingBox())?.width).toBe(1280);
  await page.screenshot({ path: testInfo.outputPath('live-fernreach-1920x1080.png') });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(3500);
  await page.keyboard.up('ArrowRight');
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('live-fernreach-scrolled.png') });
  expect(errors).toEqual([]);
});
