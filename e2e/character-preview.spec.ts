import { expect, test } from '@playwright/test';

test('development character preview changes metadata without disguising missing artwork', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/art-validation');
  await expect(page.getByTestId('art-validation')).toHaveAttribute('data-ready', 'true', {
    timeout: 20_000,
  });
  const preview = page.getByRole('group', {
    name: 'Character customization · development preview',
  });
  // Production deliberately omits the customization interface, even on an opted-in review route.
  if (process.env.CI) {
    await expect(preview).toHaveCount(0);
    return;
  }
  await expect(preview).toBeVisible();
  await page.getByLabel('Face left', { exact: true }).check();
  for (const [label, value] of [
    ['Body variant', 'adventurer-tall'],
    ['Skin tone', 'deep'],
    ['Face', 'calm'],
    ['Eyes', 'mint'],
    ['Hairstyle', 'braided'],
    ['Hair color', 'silver'],
    ['Outfit', 'traveler'],
    ['Weapon', 'seed-blade'],
    ['Hat', 'fern-cap'],
    ['Cape', 'leaf-mantle'],
  ])
    await preview.getByRole('combobox', { name: label!, exact: true }).selectOption(value!);
  await expect(preview.getByRole('status')).toContainText('weapon:seed-blade');
  await preview.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('0.5');
  await preview.getByRole('combobox', { name: 'Sprite scale', exact: true }).selectOption('0.3');
  await preview.getByRole('combobox', { name: 'Background', exact: true }).selectOption('dark');
  await page.getByLabel('Measurement guides', { exact: true }).check();
  await page.getByLabel('Pause preview', { exact: true }).check();
  const snapshot = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          cindervaleValidation(): {
            appearance: { facing: string; weapon: string };
            placeholderAction: boolean;
            action: string;
            actor: { frame: string }[];
            playbackSpeed: number;
            playerScale: number;
            background: string;
          };
        }
      ).cindervaleValidation(),
    );
  for (const action of ['walk', 'jump', 'fall', 'climb', 'hit', 'death', 'respawn']) {
    await page.getByLabel('Pose', { exact: true }).selectOption(action);
    expect(await snapshot()).toMatchObject({ action, placeholderAction: true });
  }
  expect(await snapshot()).toMatchObject({
    appearance: { facing: 'left', weapon: 'seed-blade' },
    playbackSpeed: 0.5,
    playerScale: 0.3,
    background: 'dark',
  });
  await page.getByLabel('Pose', { exact: true }).selectOption('attack');
  expect((await snapshot()).actor[0]!.frame).toBe('contact');
  await page.screenshot({ path: testInfo.outputPath('character-customization-controls.png') });
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('character-anchors-left.png') });
  await page.getByLabel('Face left', { exact: true }).uncheck();
  await preview.getByRole('combobox', { name: 'Background', exact: true }).selectOption('forest');
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('character-anchors-right.png') });
  await page.getByLabel('Pause preview', { exact: true }).uncheck();
  await preview.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('0');
  const frame = (await snapshot()).actor[0]!.frame;
  // A rendered pause holds the sampled frame while the Phaser scene continues running.
  await expect.poll(async () => (await snapshot()).actor[0]!.frame).toBe(frame);
  await page.reload();
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});
