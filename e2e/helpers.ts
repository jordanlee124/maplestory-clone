import { expect, type Page } from '@playwright/test';

export interface Snapshot {
  name: string;
  x: number;
  y: number;
  climbing: boolean;
}

export const players = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { cindervale?: { players(): Snapshot[] } }).cindervale?.players() ?? [],
  );

export const xOf = async (page: Page, name: string) =>
  (await players(page)).find((p) => p.name === name)?.x;

export async function enterWorld(page: Page, name: string) {
  const username = `${name.toLowerCase()}_${Date.now() % 1_000_000}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Need an account?' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByLabel('New character name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-status', 'playing', {
    timeout: 20_000,
  }); // CI loads Phaser slowly
}

export const me = async (page: Page, name: string) =>
  (await players(page)).find((p) => p.name === name)!;
