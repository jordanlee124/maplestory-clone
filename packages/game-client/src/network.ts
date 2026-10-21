import { PROTOCOL_VERSION, ROOM_MAP } from '@cindervale/protocol';
import { Client, type Room } from '@colyseus/sdk';
import { CombatEvents, combatEvents } from './combat/events';

export interface GameSession {
  gameUrl: string;
  token: string;
  characterId: string;
  mapId: string;
}

const reconnectKey = (characterId: string) => `cindervale:reconnect:${characterId}`;

/**
 * Joins the map room, first trying to resume a session that survived a page reload.
 * Mid-session network drops are handled by the SDK's built-in auto-reconnect.
 */
export async function joinMap({ gameUrl, token, characterId, mapId }: GameSession): Promise<Room> {
  const client = new Client(gameUrl);
  client.auth.token = token;
  const key = reconnectKey(characterId);
  const saved = sessionStorage.getItem(key);

  let room = saved ? await client.reconnect(saved).catch(() => undefined) : undefined;
  for (let attempt = 0; !room; attempt++) {
    try {
      room = await client.joinOrCreate(ROOM_MAP, {
        characterId,
        mapId,
        protocolVersion: PROTOCOL_VERSION,
      });
    } catch (e) {
      // 409: a previous session is still held (up to the 20s reconnect window) or saving.
      if ((e as { code?: number }).code !== 409 || attempt >= 24) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // The server reserves the seat even if the connection drops immediately after join.
  room.reconnection.minUptime = 0;
  combatEvents.set(room, new CombatEvents(room));
  const remember = () => sessionStorage.setItem(key, room.reconnectionToken);
  remember();
  room.onReconnect(remember);
  room.onLeave(() => sessionStorage.removeItem(key));
  return room;
}
