# Network Protocol

Source of truth: `packages/protocol/src/index.ts` (Zod) and `apps/game-server/src/state.ts` (Colyseus schema).
Current **`PROTOCOL_VERSION = 2`** (v2: ladders, so `up`/`down` inputs and `climbing` state; per-map rooms, so `mapId` in join). Bump it on any breaking change to room messages or synced state. Old clients are then rejected at join.

## HTTP API (`apps/api`, default `:4000`)

All bodies are JSON. Errors return `{ statusCode, error, message }`.

| Method | Path             | Auth   | Body              | Success                  | Errors         |
| ------ | ---------------- | ------ | ----------------- | ------------------------ | -------------- |
| POST   | `/auth/register` | —      | `Credentials`     | 201 `{ token }`          | 400, 409 taken |
| POST   | `/auth/login`    | —      | `Credentials`     | 200 `{ token }`          | 400, 401       |
| GET    | `/characters`    | Bearer | —                 | 200 `CharacterSummary[]` | 401            |
| POST   | `/characters`    | Bearer | `CreateCharacter` | 201 `CharacterSummary`   | 400, 401, 409  |
| GET    | `/health`        | —      | —                 | 200 `{ ok: true }`       |                |

- `Credentials`: `{ username: /^[a-zA-Z0-9_]{3,16}$/, password: 8–128 chars }`. Usernames are case-insensitive.
- `CreateCharacter`: `{ name: /^[a-zA-Z0-9]{3,12}$/, classId: ClassId }`. Names are unique case-insensitively, max 6 per account.
- Token: JWT HS256, `iss=cindervale-api`, `aud=cindervale`, `sub=accountId`, 12 h expiry.

## Game server (`apps/game-server`, default `ws://:2567`)

### Join

`client.auth.token = jwt; client.joinOrCreate('map', JoinOptions)`

`JoinOptions = { characterId: uuid, mapId: string, protocolVersion: 2 }`

Rooms are matched per `mapId` (`filterBy(['mapId'])`). `mapId` must be the character's saved map.

Rejections (`ServerError` code): 400 bad options/version, unknown map, or not the character's map · 401 bad token · 403 not your character · 409 character already online.

### Client → server messages

| Type    | Payload                                                 | Rules                                                                                                         |
| ------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `input` | `{ seq: int32 ≥ 0, left, right, up, down, jump: bool }` | One per 1/60 s step. `seq` strictly increasing; duplicates/old dropped. Max 30 queued; ≤ 180 msg/s or kicked. |

### Synced state (`MapState`)

```text
MapState { mapId: string, players: Map<sessionId, PlayerState> }
PlayerState { characterId, name, classId: string,
              x, y, vx, vy: float64, grounded, climbing: boolean, lastSeq: int32 }
```

`x, y` is the bottom-centre (feet). `lastSeq` is the last input the server applied, used for reconciliation. Patches go out every 50 ms.

### Reconnection

- Network drop: the server keeps the seat for 20 s and `@colyseus/sdk` auto-reconnects.
- Page reload: the client stores `room.reconnectionToken` in `sessionStorage` and calls `client.reconnect(token)`. On reconnect the server clears the input queue, and the client resumes `seq` from `lastSeq + 1`.
- Final leave: x/y are saved to `characters` and the character is freed for a new join.
