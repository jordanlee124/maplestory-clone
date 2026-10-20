import { createDb } from '@cindervale/database';
import { ROOM_MAP } from '@cindervale/protocol';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { z } from 'zod';
import { createMapRoom } from './map-room';

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    GAME_PORT: z.coerce.number().default(2567),
  })
  .parse(process.env);

const { db } = createDb(env.DATABASE_URL);
const server = new Server({ transport: new WebSocketTransport() });
// One room per map (matched on the client's mapId). shortcut: no channels yet; add a
// channel option to filterBy when a map needs more than maxClients players.
server
  .define(ROOM_MAP, createMapRoom({ db, jwtSecret: new TextEncoder().encode(env.JWT_SECRET) }))
  .filterBy(['mapId']);
await server.listen(env.GAME_PORT);
console.log(`Game server listening on ws://localhost:${env.GAME_PORT}`);
