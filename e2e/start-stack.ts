// Boots the full stack for Playwright: in-memory Postgres (PGlite), API, game server, web.
import { spawn } from 'node:child_process';
import { startTestDatabase } from '@cindervale/database/testing';

const webPort = Number(process.env.E2E_WEB_PORT ?? 3000);
const apiPort = Number(process.env.E2E_API_PORT ?? 4000);
const gamePort = Number(process.env.E2E_GAME_PORT ?? 2567);
if (![webPort, apiPort, gamePort].every((p) => Number.isInteger(p) && p > 0 && p <= 65535))
  throw new Error('E2E ports must be integers from 1 to 65535');
const db = await startTestDatabase();
const env = {
  ...process.env,
  DATABASE_URL: db.url,
  JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-secret-e2e-secret-e2e-secret-e2e',
  API_PORT: String(apiPort),
  GAME_PORT: String(gamePort),
  WEB_ORIGIN: `http://localhost:${webPort}`,
  NEXT_PUBLIC_API_URL: `http://localhost:${apiPort}`,
  NEXT_PUBLIC_GAME_URL: `ws://localhost:${gamePort}`,
  ART_VALIDATION_ENABLED: 'true',
  CINDERVALE_E2E_DEV: process.env.CI ? 'false' : 'true',
};
const webScript = process.env.CI ? 'start' : 'dev';

const children = [
  ['@cindervale/api', 'start'],
  ['@cindervale/game-server', 'start'],
  ['@cindervale/web', webScript],
].map(([pkg, script]) =>
  // shell: needed to resolve pnpm.cmd on Windows.
  spawn(
    pkg === '@cindervale/web'
      ? `pnpm --filter ${pkg} exec next ${script} --port ${webPort}`
      : `pnpm --filter ${pkg} ${script}`,
    { env, stdio: 'inherit', shell: true },
  ),
);

const stop = async () => {
  for (const c of children) c.kill();
  await db.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
