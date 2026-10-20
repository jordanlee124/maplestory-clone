import { MAPS, START_MAP_ID } from '@cindervale/content';
import { accounts, characters, eq, sql, type Db } from '@cindervale/database';
import {
  CreateCharacter,
  Credentials,
  type AuthResponse,
  type CharacterSummary,
} from '@cindervale/protocol';
import cors from '@fastify/cors';
import Fastify, { type FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { signToken, verifyToken } from '@cindervale/protocol/token';
import { hashPassword, verifyPassword } from './auth';

export const MAX_CHARACTERS_PER_ACCOUNT = 6;

export interface AppConfig {
  db: Db;
  jwtSecret: Uint8Array;
  webOrigin: string;
}

const httpError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode });

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw httpError(400, result.error.issues[0]?.message ?? 'Invalid request');
  return result.data;
}

const isUniqueViolation = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } };
  return (err.cause?.code ?? err.code) === '23505';
};

const toSummary = (c: typeof characters.$inferSelect): CharacterSummary => ({
  id: c.id,
  name: c.name,
  classId: c.classId as CharacterSummary['classId'],
  level: c.level,
  mapId: c.mapId,
});

export async function buildApp({ db, jwtSecret, webOrigin }: AppConfig) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  await app.register(cors, { origin: webOrigin });

  async function requireAccount(req: FastifyRequest): Promise<string> {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    const accountId = token && (await verifyToken(token, jwtSecret));
    if (!accountId) throw httpError(401, 'Not authenticated');
    return accountId;
  }

  app.get('/health', async () => ({ ok: true }));

  // shortcut: no login rate limiting yet; add @fastify/rate-limit before public deployment.
  app.post('/auth/register', async (req, reply): Promise<AuthResponse> => {
    const { username, password } = parse(Credentials, req.body);
    try {
      const [account] = await db
        .insert(accounts)
        .values({ username: username.toLowerCase(), passwordHash: await hashPassword(password) })
        .returning({ id: accounts.id });
      reply.code(201);
      return { token: await signToken(account!.id, jwtSecret) };
    } catch (e) {
      if (isUniqueViolation(e)) throw httpError(409, 'Username is taken');
      throw e;
    }
  });

  app.post('/auth/login', async (req): Promise<AuthResponse> => {
    const { username, password } = parse(Credentials, req.body);
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.username, username.toLowerCase()),
    });
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      throw httpError(401, 'Invalid username or password');
    }
    return { token: await signToken(account.id, jwtSecret) };
  });

  app.get('/characters', async (req): Promise<CharacterSummary[]> => {
    const accountId = await requireAccount(req);
    const rows = await db.query.characters.findMany({
      where: eq(characters.accountId, accountId),
      orderBy: characters.createdAt,
    });
    return rows.map(toSummary);
  });

  app.post('/characters', async (req, reply): Promise<CharacterSummary> => {
    const accountId = await requireAccount(req);
    const { name, classId } = parse(CreateCharacter, req.body);
    const spawn = MAPS[START_MAP_ID]!.geometry.spawn;
    try {
      const created = await db.transaction(async (tx) => {
        // Lock the account row so concurrent creates can't exceed the limit.
        await tx.execute(
          sql`select 1 from ${accounts} where ${accounts.id} = ${accountId} for update`,
        );
        const [{ count } = { count: 0 }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(characters)
          .where(eq(characters.accountId, accountId));
        if (count >= MAX_CHARACTERS_PER_ACCOUNT) throw httpError(409, 'Character limit reached');
        const [row] = await tx
          .insert(characters)
          .values({ accountId, name, classId, mapId: START_MAP_ID, x: spawn.x, y: spawn.y })
          .returning();
        return row!;
      });
      reply.code(201);
      return toSummary(created);
    } catch (e) {
      if (isUniqueViolation(e)) throw httpError(409, 'Name is taken');
      throw e;
    }
  });

  return app;
}
