# Network Protocol

Source of truth: `packages/protocol/src/index.ts` (Zod) and `apps/game-server/src/state.ts` (Colyseus schema).
Current **`PROTOCOL_VERSION = 3`** (v3: combat, monsters, EXP, loot. v2: ladders and per-map rooms). Bump it on any breaking change to room messages or synced state. Old clients are then rejected at join.

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

`JoinOptions = { characterId: uuid, mapId: string, protocolVersion: 3 }`

Rooms are matched per `mapId` (`filterBy(['mapId'])`). `mapId` must be the character's saved map.

Rejections (`ServerError` code): 400 bad options/version, unknown map, or not the character's map · 401 bad token · 403 not your character · 409 character already online.

### Client → server messages

| Type      | Payload                                                                 | Rules                                                                                                         |
| --------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `input`   | `{ seq: int32 ≥ 0, left, right, up, down, jump: bool }`                 | One per 1/60 s step. `seq` strictly increasing; duplicates/old dropped. Max 30 queued; ≤ 180 msg/s or kicked. |
| `attack`  | `{ requestId: int32, skillId: string ≤ 64, facing: 'left' or 'right' }` | The server decides hits, damage and kills from its own state. Result or rejection echoes `requestId`.         |
| `pickup`  | `{ dropId: string ≤ 64 }`                                               | Must be within 50 px, alive, and the owner (or the ownership window has passed).                              |
| `respawn` | `{}`                                                                    | Only while dead and at least 2 s after death; otherwise ignored.                                              |

A payload that fails its Zod schema (wrong type, unknown enum value, extra keys on `respawn`) **disconnects the client** (Colyseus `WITH_ERROR`). A legitimate client never sends one. Extra keys on other messages are stripped, so claimed damage is never read.

### Server → client messages

| Type                             | Payload                                                                                  | To        | When                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `attackResult`                   | `{ sessionId, requestId, skillId, facing, hits: [{ monsterId, damage, crit, killed }] }` | all       | Valid attack (`hits` may be empty: a swing that missed still uses the cooldown and MP)                                                                 |
| `attackRejected`                 | `{ requestId, reason }`                                                                  | attacker  | `unknown_skill`, `skill_not_owned`, `invalid_state` (dead/climbing), `too_fast` (350 ms global lock), `cooldown`, `insufficient_mp`. Nothing is spent. |
| `monsterKilled`                  | `{ monsterId, killerSessionId }`                                                         | all       | A monster's HP reaches 0                                                                                                                               |
| `lootSpawned`                    | `{ drops: DropView[] }`                                                                  | all       | Drops created at the monster                                                                                                                           |
| `itemPickedUp`                   | `{ sessionId, dropId, itemId (null = currency), quantity }`                              | all       | Pickup persisted                                                                                                                                       |
| `pickupRejected`                 | `{ dropId, reason }`                                                                     | requester | `not_found`, `invalid_state` (dead, or another pickup still in progress), `out_of_range`, `not_owner`, `inventory_full`, `error`                       |
| `expGained`                      | `{ amount, level, exp, expToNext }`                                                      | earner    | After each persisted grant; also on join with `amount: 0`. `expToNext: 0` = max level.                                                                 |
| `levelUp`                        | `{ sessionId, level }`                                                                   | all       | Level increased (stats recomputed, HP/MP refilled)                                                                                                     |
| `inventory`                      | `{ currency, capacity, items: [{ slot, itemId, quantity }] }`                            | owner     | On join and after every pickup                                                                                                                         |
| `playerHit`                      | `{ sessionId, monsterId, damage, hp }`                                                   | all       | A monster's attack landed (followed by 1 s invulnerability)                                                                                            |
| `playerDied` / `playerRespawned` | `{ sessionId }`                                                                          | all       |                                                                                                                                                        |

### Synced state (`MapState`)

```text
MapState { mapId: string, players: Map<sessionId, PlayerState>,
           monsters: Map<monsterId, MonsterState>, drops: Map<dropId, DropState> }
PlayerState  { characterId, name, classId: string, x, y, vx, vy: float64,
               grounded, climbing, dead: boolean, lastSeq, hp, maxHp, mp, maxMp: int32, level: uint16 }
MonsterState { monsterId: string (content id), x, y: float64, hp, maxHp: int32,
               mode: 'idle'|'patrol'|'chase'|'return'|'dead', facing: int8 (1|-1) }
DropState    { dropId, itemId ('' = currency), ownerId ('' = anyone): string, quantity: int32, x, y: float64 }
```

Monster keys (`m0`, `m1`, …) are stable per map. A dead monster stays in the map (`mode: 'dead'`, hidden by the client) until it respawns. Drops expire after 60 s. Being hit or respawning moves the player server-side (knockback, spawn point); the client's normal reconciliation absorbs this.

`x, y` is the bottom-centre (feet). `lastSeq` is the last input the server applied, used for reconciliation. Patches go out every 50 ms.

### Reconnection

- Network drop: the server keeps the seat for 20 s and `@colyseus/sdk` auto-reconnects.
- Page reload: the client stores `room.reconnectionToken` in `sessionStorage` and calls `client.reconnect(token)`. On reconnect the server clears the input queue, and the client resumes `seq` from `lastSeq + 1`.
- Reconnect resends the owner's `expGained` snapshot with `amount: 0` and current `inventory`. This restores the HUD without granting rewards again. Existing sessions retain their cooldowns and reward ownership.
- The client enables SDK recovery immediately after joining, and stops movement transmission and local fixed-step accumulation while disconnected. It does not queue offline movement or combat for later replay. Dead players still sequence neutral inputs, but local prediction leaves their authoritative body frozen until respawn.
- Final leave: x/y are saved to `characters` and the character is freed for a new join.

## Client integration (v3), owned by `game-client`

Phase 1A consumes the existing v3 contract without changing backend rules or wire formats:

1. **Monsters:** original temporary pixel sprites for all three content types, feet-aligned to their hurt boxes; movement, HP, defeat and respawn follow synced state. Hit/attack reactions follow confirmed events.
2. **Commands:** Ctrl sends `basic-attack`; Q/W/E/R are skill slots (currently only Q has a class skill); Z requests the nearest drop; Enter requests respawn while dead. All bindings can be changed for the current play session through the web host's Keybindings panel. W is reserved for skills, so climbing uses arrows.
3. **Presentation:** local swings start immediately, with 90/100/160 ms startup/active/recovery frames and a 180 ms attack input buffer. These windows are cosmetic: the server validates attacks immediately on receipt. Damage numbers, crits, hit reactions, defeat effects, remote actions and rewards use server events/state only.
4. **HUD:** HP/MP/level use synced player state; EXP and currency use owner snapshots captured before Phaser starts. Cooldowns are conservative local estimates from content, reconciled on acceptance/rejection. RTT uses the SDK's built-in `room.ping`, with no custom ping message.
5. **Lifecycle:** menus, settings, death and disconnect suppress combat commands; scene shutdown detaches room listeners. Drops render from synced state. Inventory snapshots are retained, but there is no inventory screen in this phase.

Remaining integration requirements:

- **Consumables:** keys 1/2 and potion slots are visibly unavailable because v3 has no use-item command. Add a typed, validated request and authoritative server handler before enabling use; never apply healing locally.
- **More skills:** W/E/R remain empty until content supplies additional skills for a class. Existing class skills can be moved to another physical key through remapping.
- **Monster windups:** v3 exposes monster locomotion/death modes and landed `playerHit` events, but no attack-start or windup event. The client shows a short attack pose on confirmed contact; accurate telegraphs and missed attacks require an authoritative event/state extension.
- **Final art:** sprites remain clearly marked temporary placeholders. Phase 1.5 replaces fractional FIT scaling with integer display steps; asset contracts and missing art are documented in `docs/art/PIXEL_ART_GUIDE.md`.
