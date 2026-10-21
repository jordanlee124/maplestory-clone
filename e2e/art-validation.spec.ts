import { expect, test } from '@playwright/test';

test('validation scene contains player, frog, Twig study and preview HUD with explicit approval status', async ({
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
            twig: { key: string; frame: string; y: number; scale: number }[];
            twigAction: string;
            hud: { sample: boolean; panel: boolean };
            effects: string[];
          };
        }
      ).cindervaleValidation(),
    );
  expect(await state()).toMatchObject({ slotsOnly: false, zoom: 1 });
  expect((await state()).approved).toHaveLength(8);
  expect((await state()).candidates).toEqual([]);
  expect((await state()).missing).toHaveLength(10);
  expect((await state()).actor).toHaveLength(1);
  expect((await state()).frog).toHaveLength(1);
  expect((await state()).actor[0]).toMatchObject({ key: 'adventurer-body', y: 520 });
  expect((await state()).frog[0]).toMatchObject({ key: 'fern-frog', y: 520 });
  expect((await state()).twig[0]).toMatchObject({ key: 'twig-creature', y: 520 });
  expect((await state()).hud).toEqual({ sample: true, panel: true });
  const canvas = page.locator('canvas');
  await canvas.screenshot({ path: testInfo.outputPath('expanded-validation-1280x720.png') });
  await page.getByLabel('Pause preview', { exact: true }).check();
  await page.getByLabel('Pose', { exact: true }).selectOption('skill');
  await page.getByLabel('Twig pose', { exact: true }).selectOption('attack');
  expect((await state()).twig[0]!.frame).toBe('strike');
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
  await page.getByLabel('Twig pose', { exact: true }).selectOption('idle');
  for (const [width, height, scale] of [
    [1920, 1080, 1],
    [2560, 1440, 2],
    [3440, 1440, 2],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect.poll(async () => (await canvas.boundingBox())?.width).toBe(1280 * scale);
    const bounds = (await canvas.boundingBox())!;
    expect(bounds.width / bounds.height).toBeCloseTo(1280 / 720);
    const fps = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const start = performance.now();
          let frames = 0;
          const tick = () => {
            frames++;
            const elapsed = performance.now() - start;
            if (elapsed >= 1000) resolve(Math.round((frames * 1000) / elapsed));
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
    testInfo.annotations.push({ type: `preview FPS ${width}x${height}`, description: String(fps) });
    console.log(`preview FPS ${width}x${height}: ${fps}`);
    await canvas.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({
      path: testInfo.outputPath(`expanded-validation-${width}x${height}.png`),
    });
  }
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

test('a missing review PNG remains an explicit empty slot without substituting final art', async ({
  page,
}) => {
  await page.route('**/twig-creature-v01.png', (route) => route.abort());
  await page.goto('/art-validation');
  await expect(page.getByTestId('art-validation')).toHaveAttribute('data-ready', 'true', {
    timeout: 20_000,
  });
  await expect(page.getByLabel('Twig pose', { exact: true })).toBeDisabled();
  const missing = await page.evaluate(
    () =>
      (
        window as unknown as { cindervaleValidation(): { missing: string[] } }
      ).cindervaleValidation().missing,
  );
  expect(missing).toContain('twig-creature');
});
