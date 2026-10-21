import { expect, test, type Page } from '@playwright/test';
import { enterWorld, me } from './helpers';

interface CombatSnapshot {
  connected: boolean;
  facing: 'left' | 'right';
  queuedMessages: number;
  accepted: number;
  remoteAccepted: number;
  hits: number;
  playerHits: number;
  latency?: number;
  exp?: { amount: number; level: number; exp: number; expToNext: number };
  inventory?: { currency: number; items: { slot: number; itemId: string; quantity: number }[] };
  lastAttack?: { skillId: string; hits: number; monsterIds: string[] };
  monsters: {
    id: string;
    monsterId: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    mode: string;
  }[];
  renderedMonsters: { id: string; frame: string; visible: boolean; hpWidth: number }[];
}

const combat = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { cindervale: { combat(): CombatSnapshot } }).cindervale.combat(),
  );

async function approach(page: Page, name: string, monsterId: string) {
  for (let i = 0; i < 80; i++) {
    const p = await me(page, name);
    const target = (await combat(page)).monsters.find((m) => m.id === monsterId)!;
    const dx = target.x - p.x;
    const key = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    if (Math.abs(dx) < 38 && Math.abs(p.y - target.y) < 30) {
      const facing = dx > 0 ? 'right' : 'left';
      if ((await combat(page)).facing !== facing) {
        await page.keyboard.down(key);
        await expect
          .poll(async () => (await combat(page)).facing, { intervals: [10, 20, 50] })
          .toBe(facing);
        await page.keyboard.up(key);
      }
      return;
    }
    await page.keyboard.down(key);
    await page.waitForTimeout(100);
    await page.keyboard.up(key);
  }
  throw new Error('Could not approach the shared monster');
}

async function strike(page: Page, name: string, monsterId: string) {
  for (let i = 0; i < 5; i++) {
    await approach(page, name, monsterId);
    const before = (await combat(page)).accepted;
    await page.keyboard.press('Control');
    await expect.poll(async () => (await combat(page)).accepted).toBeGreaterThan(before);
    if ((await combat(page)).lastAttack?.monsterIds.includes(monsterId)) return;
    await page.waitForTimeout(620);
  }
  throw new Error('No server-confirmed hit on the shared monster');
}

test('two Phaser players damage the same monster, take AI damage, share its death and reconnect with rewards intact', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const suffix = Date.now() % 1000000;
  const nameA = `Duo${suffix}`;
  const nameB = `Pal${suffix}`;
  await enterWorld(page, nameA);
  const partner = await context.newPage();
  partner.on('pageerror', (error) => errors.push(error.message));
  await enterWorld(partner, nameB);
  await expect
    .poll(async () => (await combat(page))?.monsters[0]?.hp, { timeout: 12_000 })
    .toBe(40);
  const target = (await combat(page)).monsters[0]!.id;
  await page.locator('canvas').click();
  await approach(page, nameA, target);
  await partner.locator('canvas').click();
  await strike(partner, nameB, target);
  await expect.poll(async () => (await combat(page)).monsters[0]!.hp).toBeLessThan(40);
  // Leave the damaged monster alive long enough to see its authoritative retaliation.
  await expect
    .poll(async () => (await combat(partner)).playerHits, { timeout: 8000 })
    .toBeGreaterThan(0);
  await page.locator('canvas').click();
  await strike(page, nameA, target);
  await expect.poll(async () => (await combat(partner)).remoteAccepted).toBeGreaterThan(0);
  for (let i = 0; i < 5; i++) {
    if ((await combat(page)).monsters[0]!.mode === 'dead') break;
    await page.waitForTimeout(650);
    await strike(page, nameA, target);
  }
  for (const client of [page, partner]) {
    await expect.poll(async () => (await combat(client)).monsters[0]!.mode).toBe('dead');
    await expect
      .poll(
        async () => (await combat(client)).renderedMonsters.find((m) => m.id === target)?.visible,
      )
      .toBe(false);
    await expect.poll(async () => (await combat(client)).exp?.amount).toBeGreaterThan(0);
    await expect.poll(async () => (await combat(client)).inventory).toBeTruthy();
  }
  await page.screenshot({ path: testInfo.outputPath('two-player-combat.png') });
  const before = await combat(page);
  await page.reload();
  await expect(page.getByTestId('game')).toHaveAttribute('data-status', 'playing', {
    timeout: 20_000,
  });
  await expect.poll(async () => (await combat(page))?.exp).toEqual({ ...before.exp!, amount: 0 });
  await expect.poll(async () => (await combat(page))?.inventory).toEqual(before.inventory);
  await page.waitForTimeout(400);
  expect((await combat(page)).exp).toEqual({ ...before.exp!, amount: 0 });
  // A real socket drop must not buffer 60 movement commands per offline second.
  await page.waitForTimeout(1200);
  await context.setOffline(true);
  try {
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect.poll(async () => (await combat(page)).connected).toBe(false);
    await page.waitForTimeout(3500);
    expect((await combat(page)).queuedMessages).toBe(0);
  } finally {
    await context.setOffline(false);
  }
  await expect.poll(async () => (await combat(page)).connected, { timeout: 15_000 }).toBe(true);
  expect((await combat(page)).exp).toEqual({ ...before.exp!, amount: 0 });
  await page.locator('canvas').click();
  const x = (await me(page, nameA)).x;
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await me(page, nameA)).x).toBeGreaterThan(x + 40);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
  await partner.close();
});

test('hotkeys attack live monsters, show server rewards and remote actions, and support remapping', async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const name = `Cbt${Date.now() % 1000000}`;
  await enterWorld(page, name);
  const observer = await context.newPage();
  observer.on('pageerror', (error) => errors.push(error.message));
  await enterWorld(observer, `Obs${Date.now() % 1000000}`);
  await page.bringToFront();
  await page.locator('canvas').click();
  await expect.poll(async () => (await combat(page))?.exp).toBeTruthy();
  await expect.poll(async () => (await combat(page)).latency).toBeGreaterThanOrEqual(0);
  await expect.poll(async () => (await combat(page)).monsters[0]?.hp, { timeout: 12_000 }).toBe(40);
  expect((await combat(page)).renderedMonsters.filter((m) => m.visible)).toHaveLength(9);

  const targetId = (await combat(page)).monsters[0]!.id;
  // Reuse the shared facing/approach helper after each authoritative knockback.
  for (let attempt = 0; attempt < 8; attempt++) {
    const state = await combat(page);
    if (state.monsters[0]!.mode === 'dead') break;
    await strike(page, name, targetId);
    await page.waitForTimeout(650);
  }
  await expect.poll(async () => (await combat(page)).hits).toBeGreaterThan(0);
  await expect.poll(async () => (await combat(page)).exp?.amount).toBeGreaterThan(0);
  await expect.poll(async () => (await combat(observer)).remoteAccepted).toBeGreaterThan(0);
  await page.keyboard.press('q');
  await expect.poll(async () => (await combat(page)).lastAttack?.skillId).toBe('flame-cleave');
  await page.screenshot({ path: testInfo.outputPath('combat.png') });

  // Leave neighbouring monsters before spending time in the settings panel.
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await me(page, name)).x).toBeLessThan(240);
  await page.keyboard.up('ArrowLeft');

  // Settings are accessible outside the canvas and suppress gameplay input while open.
  await page.getByText('Keybindings', { exact: true }).click();
  await page.getByRole('button', { name: 'Rebind attack', exact: true }).click();
  await page.keyboard.press('f');
  await expect(page.getByRole('button', { name: 'Rebind attack', exact: true })).toContainText('F');
  await page.getByText('Keybindings', { exact: true }).click();
  await page.locator('canvas').click();
  const before = (await combat(page)).accepted;
  await page.waitForTimeout(600);
  await page.keyboard.press('f');
  await expect.poll(async () => (await combat(page)).accepted).toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Exit to character select', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
  await observer.close();
});
