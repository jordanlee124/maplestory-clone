import { createDb } from '@cindervale/database';
import { z } from 'zod';
import { buildApp } from './app';

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    API_PORT: z.coerce.number().default(4000),
    WEB_ORIGIN: z.string().default('http://localhost:3000'),
  })
  .parse(process.env);

const { db } = createDb(env.DATABASE_URL);
const app = await buildApp({
  db,
  jwtSecret: new TextEncoder().encode(env.JWT_SECRET),
  webOrigin: env.WEB_ORIGIN,
});
await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
