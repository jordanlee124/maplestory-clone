import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema';

export * from './schema';
export { and, asc, eq, sql } from 'drizzle-orm';

export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString, max: 10 });
  return { db: drizzle(pool, { schema, casing: 'snake_case' }), pool };
}

export type Db = ReturnType<typeof createDb>['db'];

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

export function runMigrations(db: Db) {
  return migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}
