import { expect, test, type Page } from '@playwright/test';

// Phase 0 success condition: two authenticated players share a map, see each other
// move, and a player reconnects (page reload) without losing their character.

interface Snapshot {
  name: string;
  x: number;
  y: number;
}

const players = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { cindervale?: { players(): Snapshot[] } }).cindervale?.players() ?? [],
  );

const xOf = async (page: Page, name: string) =>
  (await players(page)).find((p) => p.name === name)?.x;

async function enterWorld(page: Page, name: string) {
  const username = `${name.toLowerCase()}_${Date.now() % 1_000_000}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Need an account?' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByLabel('New character name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-status', 'playing');
}

test('two players see each other move and survive a reload', async ({ browser }) => {
  const suffix = String(Date.now() % 100_000);
  const [nameA, nameB] = [`Ann${suffix}`, `Ben${suffix}`];
  const pageA = await (await browser.newContext()).newPage();
  const pageB = await (await browser.newContext()).newPage();

  await enterWorld(pageA, nameA);
  await enterWorld(pageB, nameB);
  await expect.poll(async () => (await players(pageB)).map((p) => p.name)).toContain(nameA);
  const startX = (await xOf(pageB, nameA))!;

  // A walks right; B sees it.
  await pageA.locator('canvas').click();
  await pageA.keyboard.down('ArrowRight');
  await pageA.waitForTimeout(1000);
  await pageA.keyboard.up('ArrowRight');
  await expect.poll(() => xOf(pageB, nameA)).toBeGreaterThan(startX + 100);
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
  await expect(pageA.getByTestId('game')).toHaveAttribute('data-status', 'playing');
  await expect.poll(() => xOf(pageA, nameA)).toBeCloseTo(movedX, 0);
  await expect
    .poll(async () => (await players(pageB)).filter((p) => p.name === nameA))
    .toHaveLength(1);
});
