import { defineConfig, devices } from '@playwright/test';

const webPort = Number(process.env.E2E_WEB_PORT ?? 3000);
if (!Number.isInteger(webPort) || webPort < 1 || webPort > 65535)
  throw new Error('Invalid E2E_WEB_PORT');
const baseURL = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: 'e2e',
  snapshotPathTemplate: '{testDir}/snapshots/{testFileName}/{arg}{ext}',
  timeout: 60_000,
  // Scenarios share an authoritative map and software-rendered canvases; isolate them.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    stdout: 'pipe',
    command: 'pnpm exec tsx e2e/start-stack.ts',
    url: baseURL,
    reuseExistingServer: !process.env.CI && !process.env.E2E_WEB_PORT,
    timeout: 180_000,
  },
});
