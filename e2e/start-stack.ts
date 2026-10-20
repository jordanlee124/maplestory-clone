// Boots the full stack for Playwright: in-memory Postgres (PGlite), API, game server, web.
import { spawn } from 'node:child_process';
import { startTestDatabase } from '@cindervale/database/testing';

const db = await startTestDatabase();
const env = {
  ...process.env,
  DATABASE_URL: db.url,
  JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-secret-e2e-secret-e2e-secret-e2e',
};
const webScript = process.env.CI ? 'start' : 'dev';

const children = [
  ['@cindervale/api', 'start'],
  ['@cindervale/game-server', 'start'],
  ['@cindervale/web', webScript],
].map(([pkg, script]) =>
  // shell: needed to resolve pnpm.cmd on Windows.
  spawn(`pnpm --filter ${pkg} ${script}`, { env, stdio: 'inherit', shell: true }),
);

const stop = async () => {
  for (const c of children) c.kill();
  await db.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
