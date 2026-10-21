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

| Type         | Payload                                                                 | Rules                                                                                                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input`      | `{ seq: int32 ≥ 0, left, right, up, down, jump: bool }`                 | One per 1/60 s step. `seq` strictly increasing; duplicates/old dropped. Max 30 queued; ≤ 180 msg/s or kicked.                                                                                                                       |
| `attack`     | `{ requestId: int32, skillId: string ≤ 64, facing: 'left' or 'right' }` | The server decides hits, damage and kills from its own state. Result or rejection echoes `requestId`.                                                                                                                               |
| `pickup`     | `{ dropId: string ≤ 64 }`                                               | Must be within 50 px, alive, and the owner (or the ownership window has passed).                                                                                                                                                    |
| `respawn`    | `{}`                                                                    | Only while dead and at least 2 s after death; otherwise ignored.                                                                                                                                                                    |
| `learnSkill` | `{ skillId: string ≤ 64, level: int 1..100 }`                           | Spends 1 skill point raising the skill to `level`, which must be its current level + 1 (a resent request is rejected as `stale`, never applied twice). One at a time: wait for `characterStats` or `skillRejected` before the next. |

A payload that fails its Zod schema (wrong type, unknown enum value, extra keys on `respawn`) **disconnects the client** (Colyseus `WITH_ERROR`). A legitimate client never sends one. Extra keys on other messages are stripped, so claimed damage is never read.

### Server → client messages

| Type                             | Payload                                                                                          | To        | When                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attackResult`                   | `{ sessionId, requestId, skillId, facing, hits: [{ monsterId, damage, crit, killed }] }`         | all       | Valid attack (`hits` may be empty: a swing that missed still uses the cooldown and MP)                                                                                                                                                                                                                          |
| `attackRejected`                 | `{ requestId, reason }`                                                                          | attacker  | `unknown_skill`, `skill_not_owned`, `invalid_state` (dead/climbing), `too_fast` (350 ms global lock), `cooldown`, `insufficient_mp`, `not_usable` (passive skill). `skill_not_owned` also covers a skill not yet learned. Nothing is spent.                                                                     |
| `monsterKilled`                  | `{ monsterId, killerSessionId }`                                                                 | all       | A monster's HP reaches 0                                                                                                                                                                                                                                                                                        |
| `lootSpawned`                    | `{ drops: DropView[] }`                                                                          | all       | Drops created at the monster                                                                                                                                                                                                                                                                                    |
| `itemPickedUp`                   | `{ sessionId, dropId, itemId (null = currency), quantity }`                                      | all       | Pickup persisted                                                                                                                                                                                                                                                                                                |
| `pickupRejected`                 | `{ dropId, reason }`                                                                             | requester | `not_found`, `invalid_state` (dead, or another pickup still in progress), `out_of_range`, `not_owner`, `inventory_full`, `error`                                                                                                                                                                                |
| `expGained`                      | `{ amount, level, exp, expToNext }`                                                              | earner    | After each persisted grant; also on join with `amount: 0`. `expToNext: 0` = max level.                                                                                                                                                                                                                          |
| `levelUp`                        | `{ sessionId, level }`                                                                           | all       | Level increased (stats recomputed, HP/MP refilled)                                                                                                                                                                                                                                                              |
| `inventory`                      | `{ currency, capacity, items: [{ slot, itemId, quantity }] }`                                    | owner     | On join and after every pickup                                                                                                                                                                                                                                                                                  |
| `playerHit`                      | `{ sessionId, monsterId, damage, hp }`                                                           | all       | A monster's attack landed (followed by 1 s invulnerability)                                                                                                                                                                                                                                                     |
| `playerDied` / `playerRespawned` | `{ sessionId }`                                                                                  | all       |                                                                                                                                                                                                                                                                                                                 |
| `characterStats`                 | `{ stats: Stats, skillPoints, skills: [{ skillId, level }], buffs: [{ skillId, remainingMs }] }` | owner     | On join/reconnect, level-up, skill learned, buff cast and buff expiry. `stats` is the full sheet (STR/DEX/INT/LUK, maxHp, maxMp, attack, magic, defense, critRate, critDamage, bossDamage, ignoreDefense) with passives and buffs applied. `skills` lists every skill the class can see; level 0 = not learned. |
| `skillRejected`                  | `{ skillId, reason }`                                                                            | requester | `unknown_skill`, `wrong_class`, `level_too_low`, `prerequisite`, `max_level`, `no_skill_points`, `stale`, `busy` (another learn in flight), `error`. Nothing is spent.                                                                                                                                          |

Buff skills are cast with `attack` like any skill: the result is an `attackResult` with empty `hits` (so other clients can play the cast) followed by `characterStats` to the caster. Buffs end with the session.

These additions are backwards compatible with v3 clients, so `PROTOCOL_VERSION` stays 3. A client that subscribes to every `ServerMessage` value must add the two new types to its message map.

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
- Final leave: x/y are saved to `characters` and the character is freed for a new join.

## Client integration (v3), owned by `game-client`

The server side of combat is complete and tested. The client still needs to:

1. **Render monsters** from `state.monsters` (sprite per `monsterId`, flip by `facing`, hide when `mode === 'dead'`, HP bar from `hp/maxHp`).
2. **Render drops** from `state.drops`, and send `pickup` for the nearest drop on a key (e.g. Z).
3. **Send `attack`** on a key (e.g. Ctrl for `basic-attack`, plus a skill hotkey per class: `flame-cleave`, `gust-arrow`, `rune-burst`, `twin-thorn`) with the current facing. Play the swing immediately, and show damage numbers from `attackResult`.
4. Show HP/MP/level from the local `PlayerState`, EXP from `expGained`, inventory and currency from `inventory`.
5. React to `playerHit` (flash, damage number), `playerDied` (death UI with a respawn button that sends `respawn`), `levelUp` (effect), `itemPickedUp`, `lootSpawned`, `monsterKilled`.
6. Skill data (range, cooldown, MP) is in `@cindervale/content` `SKILLS`, for cooldown UI. The server remains authoritative.

### Phase 2 progression (client work, owned by `game-client`)

1. Build skill slots from `characterStats.skills`: only `level > 0` skills whose `SKILLS[id].kind` is `attack` or `buff`. Passives are never sent. Each class now has 4 skills (innate attack, passive, buff, second attack), not one.
2. A skill window: list the class's skills with level, `maxLevel`, `requiredLevel`, `requires` and `skillPoints`; send `learnSkill { skillId, level: current + 1 }` and show `skillRejected` reasons.
3. A stats window from `characterStats.stats`, and buff icons from `buffs[].remainingMs`.
