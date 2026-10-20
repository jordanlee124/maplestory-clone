// Test helper: an in-memory Postgres (PGlite) behind a real socket, migrated and ready.
// Apps under test connect with plain `pg`, exactly as they do in production.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createDb, runMigrations } from './index';

export async function startTestDatabase() {
  const pglite = await PGlite.create();
  const server = new PGLiteSocketServer({ db: pglite, port: 0, maxConnections: 20 });
  await server.start();
  const url = `postgres://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable`;
  const { db, pool } = createDb(url);
  await runMigrations(db);
  await pool.end();
  return {
    url,
    async stop() {
      await server.stop();
      await pglite.close();
    },
  };
}
