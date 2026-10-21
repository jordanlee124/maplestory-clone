import { expect, test } from '@playwright/test';

test('visual candidate contains one player, frog and layered scenery while preserving approval status', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/art-validation');
  await expect(page.getByTestId('art-validation')).toHaveAttribute('data-ready', 'true', {
    timeout: 20_000,
  });
  const state = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          cindervaleValidation: () => {
            zoom: number;
            action: string;
            flip: boolean;
            scrollX: number;
            slotsOnly: boolean;
            approved: string[];
            missing: string[];
            candidates: string[];
            actor: { key: string; frame: string; y: number; scale: number }[];
            frog: { key: string; frame: string; y: number; scale: number }[];
            effects: string[];
          };
        }
      ).cindervaleValidation(),
    );
  expect(await state()).toMatchObject({ slotsOnly: false, approved: [], zoom: 1 });
  expect((await state()).candidates).toHaveLength(6);
  expect((await state()).missing).toHaveLength(11);
  expect((await state()).actor).toHaveLength(1);
  expect((await state()).frog).toHaveLength(1);
  expect((await state()).actor[0]).toMatchObject({ key: 'adventurer-body', y: 520 });
  expect((await state()).frog[0]).toMatchObject({ key: 'fern-frog', y: 520 });
  const canvas = page.locator('canvas');
  await canvas.screenshot({ path: testInfo.outputPath('candidate-1280x720.png') });
  await page.getByLabel('Pause preview', { exact: true }).check();
  await page.getByLabel('Pose', { exact: true }).selectOption('skill');
  expect((await state()).effects).toHaveLength(1);
  await canvas.screenshot({ path: testInfo.outputPath('candidate-skill-1280x720.png') });
  await page.getByLabel('Pause preview', { exact: true }).uncheck();
  await page.getByLabel('Camera zoom', { exact: true }).selectOption('1.25');
  await page.getByLabel('Pose', { exact: true }).selectOption('attack');
  await page.getByLabel('Face left', { exact: true }).check();
  await expect.poll(state).toMatchObject({ zoom: 1.25, action: 'attack', flip: true });
  await page.getByLabel('Pose', { exact: true }).selectOption('skill');
  await page.getByLabel('Parallax pan', { exact: true }).fill('160');
  await expect.poll(state).toMatchObject({ action: 'skill', scrollX: 160 });
  await page.getByLabel('Measurement guides', { exact: true }).uncheck();
  await page.getByLabel('Measurement guides', { exact: true }).check();
  await page.getByLabel('Camera zoom', { exact: true }).selectOption('1');
  await page.getByLabel('Measurement guides', { exact: true }).uncheck();
  await page.getByLabel('Parallax pan', { exact: true }).fill('0');
  await page.getByLabel('Face left', { exact: true }).uncheck();
  await page.getByLabel('Pose', { exact: true }).selectOption('idle');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect.poll(async () => (await canvas.boundingBox())?.width).toBe(1280);
  await page.screenshot({ path: testInfo.outputPath('candidate-1920x1080.png'), fullPage: true });
  await page.getByText('Before / candidate comparison', { exact: true }).click();
  for (const alt of [
    'Temporary rectangular character and monster sprites, tiled soil and geometric hills',
    'Original chibi adventurer and Fern Frog on an organic platform with botanical woodland scenery',
  ]) {
    const image = page.getByAltText(alt, { exact: true });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1280);
  }
  expect(errors).toEqual([]);
});
