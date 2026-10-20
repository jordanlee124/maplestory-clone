import { MAPS } from '@cindervale/content';
import { and, characters, eq, type Character, type Db } from '@cindervale/database';
import { stepBody, TICK_RATE, type Body, type MapGeometry } from '@cindervale/game-core';
import { ClientMessage, InputMessage, JoinOptions } from '@cindervale/protocol';
import { verifyToken } from '@cindervale/protocol/token';
import { Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import { MapState, PlayerState } from './state';

export interface MapRoomDeps {
  db: Db;
  jwtSecret: Uint8Array;
  /** Seconds a dropped client may take to reconnect before their session ends. */
  reconnectSeconds?: number;
}

/** Max inputs a player may have queued; extras are dropped. */
const MAX_QUEUED_INPUTS = 30;
/** Step credits a player can bank to absorb network jitter. */
const MAX_STEP_CREDITS = 10;

interface Session {
  characterId: string;
  body: Body;
  inputs: InputMessage[];
  lastQueuedSeq: number;
  lastSeq: number;
  credits: number;
}

type MapClient = Client<{ auth: Character }>;

/**
 * Builds the authoritative map room. A factory so deps are injected without globals.
 * Movement authority: clients send one input per fixed step; the server replays them
 * through the shared game-core simulation. Step credits accrue with elapsed wall time
 * (not tick count, since timers can fire late), so a client can never move faster
 * than real time (speed hacks are throttled).
 */
export function createMapRoom({ db, jwtSecret, reconnectSeconds = 20 }: MapRoomDeps) {
  // Characters currently in any room of this process (including those awaiting reconnect).
  // shortcut: process-local; move to Redis/presence when running multiple game-server processes.
  const activeCharacters = new Set<string>();

  return class MapRoom extends Room<{ state: MapState; client: MapClient }> {
    override maxClients = 100;
    override maxMessagesPerSecond = TICK_RATE * 3;
    private map!: MapGeometry;
    private mapId!: string;
    private sessions = new Map<string, Session>();

    // Options come from the first client's join (rooms are matched per mapId); untrusted.
    override onCreate(options: { mapId?: unknown }) {
      const mapId = String(options.mapId);
      const def = Object.hasOwn(MAPS, mapId) ? MAPS[mapId] : undefined;
      if (!def) throw new ServerError(400, 'Unknown map');
      this.mapId = def.id;
      this.map = def.geometry;
      this.state = new MapState({ mapId: def.id });

      this.onMessage(ClientMessage.Input, InputMessage, (client, input) => {
        const s = this.sessions.get(client.sessionId);
        if (!s || input.seq <= s.lastQueuedSeq || s.inputs.length >= MAX_QUEUED_INPUTS) return;
        s.inputs.push(input);
        s.lastQueuedSeq = input.seq;
      });

      this.setTimestep((deltaMs) => this.tick(deltaMs), 1000 / TICK_RATE);
    }

    override async onAuth(_client: MapClient, rawOptions: unknown, context: AuthContext) {
      const options = JoinOptions.safeParse(rawOptions);
      if (!options.success) throw new ServerError(400, 'Invalid join options or protocol version');
      const accountId = context.token && (await verifyToken(context.token, jwtSecret));
      if (!accountId) throw new ServerError(401, 'Not authenticated');
      // Checked before the read: while the id is active its leave-save may not have committed,
      // and reading now would resume a stale row.
      if (activeCharacters.has(options.data.characterId))
        throw new ServerError(409, 'Character is already in game');

      const character = await db.query.characters.findFirst({
        where: and(
          eq(characters.id, options.data.characterId),
          eq(characters.accountId, accountId),
        ),
      });
      if (!character) throw new ServerError(403, 'Character not found');
      if (character.mapId !== this.mapId) throw new ServerError(400, 'Character is on another map');
      if (activeCharacters.has(character.id))
        throw new ServerError(409, 'Character is already in game');
      return character;
    }

    override onJoin(client: MapClient) {
      const c = client.auth!;
      // Re-checked here: two joins may pass onAuth concurrently.
      if (activeCharacters.has(c.id)) throw new ServerError(409, 'Character is already in game');
      activeCharacters.add(c.id);

      const body: Body = { x: c.x, y: c.y, vx: 0, vy: 0, grounded: false, climbing: false };
      this.sessions.set(client.sessionId, {
        characterId: c.id,
        body,
        inputs: [],
        lastQueuedSeq: -1,
        lastSeq: -1,
        credits: 0,
      });
      this.state.players.set(
        client.sessionId,
        new PlayerState({
          characterId: c.id,
          name: c.name,
          classId: c.classId,
          ...body,
          lastSeq: -1,
        }),
      );
    }

    override onDrop(client: MapClient) {
      // Not awaited: an expired window rejects the deferred, and onLeave handles cleanup.
      this.allowReconnection(client, reconnectSeconds);
    }

    override onReconnect(client: MapClient) {
      // A reloaded client resumes its input seq from the synced lastSeq + 1.
      const s = this.sessions.get(client.sessionId);
      if (!s) return;
      s.inputs = [];
      s.lastQueuedSeq = s.lastSeq;
    }

    override async onLeave(client: MapClient) {
      const s = this.sessions.get(client.sessionId);
      this.sessions.delete(client.sessionId);
      this.state.players.delete(client.sessionId);
      if (!s) return;
      // shortcut: saves only on leave and a failed save is just logged; add periodic saves
      // and retries before EXP/items are persisted (a crash loses progress since join).
      try {
        await db
          .update(characters)
          .set({ x: s.body.x, y: s.body.y, updatedAt: new Date() })
          .where(eq(characters.id, s.characterId));
      } catch (err) {
        console.error(`Failed to save character ${s.characterId}`, err);
      } finally {
        activeCharacters.delete(s.characterId);
      }
    }

    private tick(deltaMs: number) {
      for (const [sessionId, s] of this.sessions) {
        s.credits = Math.min(s.credits + (deltaMs * TICK_RATE) / 1000, MAX_STEP_CREDITS);
        while (s.credits >= 1 && s.inputs.length > 0) {
          const input = s.inputs.shift()!;
          s.body = stepBody(s.body, input, this.map);
          s.lastSeq = input.seq;
          s.credits--;
        }
        const p = this.state.players.get(sessionId);
        if (p) Object.assign(p, s.body, { lastSeq: s.lastSeq });
      }
    }
  };
}
