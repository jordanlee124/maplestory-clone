# Architecture Overview

```text
 Browser ──────────────────────────────────────────┐
 │ apps/web (Next.js)                              │
 │   login · character select · <GameView>         │
 │        └─ dynamic import ─► packages/game-client│
 │             Phaser scenes + Predictor + SDK     │
 └──────┬──────────────────────────────┬───────────┘
        │ HTTPS (JSON, Bearer JWT)     │ WebSocket (Colyseus, JWT in auth)
 ┌──────▼──────────┐          ┌────────▼────────────────┐
 │ apps/api        │          │ apps/game-server        │
 │ Fastify         │          │ Colyseus MapRoom        │
 │ accounts, chars │          │ authoritative sim 60 Hz │
 └──────┬──────────┘          └────────┬────────────────┘
        └──────────► PostgreSQL ◄──────┘   (packages/database, Drizzle)

 Shared: game-core (deterministic rules) · protocol (Zod contracts, JWT) · content (data)
```

## Workspaces

| Path                   | Purpose                                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`             | Next.js site: auth UI, character select, hosts the Phaser canvas                                                                                                                                     |
| `apps/api`             | Fastify HTTP API: `/auth/register`, `/auth/login`, `/characters`                                                                                                                                     |
| `apps/game-server`     | Colyseus server: `map` room, movement and combat authority, progression (`progression.ts`), items (`items.ts`, `equipment.ts`), auto-grinding (`autogrind.ts`), rewards                              |
| `packages/game-core`   | Pure deterministic rules: `stepBody`, physics constants, map geometry                                                                                                                                |
| `packages/game-client` | Phaser 3: scenes (Boot, Preload, World), `player/` (LocalPlayer, RemotePlayers, Avatar), `world/` (map renderer), `ui/` (debug overlay, Esc menu), `art/` (placeholder sprites), prediction, network |
| `packages/protocol`    | Zod schemas for HTTP and room messages, `PROTOCOL_VERSION`, JWT helpers                                                                                                                              |
| `packages/content`     | Data: regions, maps, classes, monsters, bosses, balance (`balance.ts`), equipment and enhancement tables (`equipment.ts`)                                                                            |
| `packages/database`    | Drizzle schema, migrations, `createDb`, PGlite test helper                                                                                                                                           |
| `packages/ui`          | Shared React primitives (Panel, Button, Field)                                                                                                                                                       |
| `packages/config`      | Shared tsconfig and ESLint config                                                                                                                                                                    |

## Key flows

**Login → play.** Web calls the API for a JWT, then lists or creates a character. `GameView` dynamically imports `game-client`, which joins the `map` room with `{characterId, protocolVersion}` and the JWT. `onAuth` verifies the token, checks ownership, and rejects a character that's already online.

**Movement.** Each 1/60 s step the client samples keys, applies `stepBody` locally (prediction), and sends `{seq, left, right, jump}`. The server queues the inputs and applies them with the same `stepBody`, limited by wall-clock step credits so no client moves faster than real time. State patches (20 Hz) carry `lastSeq`. The client drops acknowledged inputs and replays the rest on top of the server state (reconciliation). Remote players are smoothed toward their latest position.

**Progression and items.** Stats are derived on the server from class scaling, level, worn equipment, learned passives and active buffs (`computeStats`). Only inputs to that are stored: level/EXP, `character_skills`, and equipment instance rows in `inventory_items`. Every item and skill operation is one transaction that locks the character row, re-validates against stored state, and logs to `item_transactions`. Retries are safe because requests name the expected current state (`level`, `fromAttempts`, `fromRolls`). The owner gets `characterStats` and `inventory` snapshots after each change.

**Auto-grinding.** The room calls the pure `stepAuto` once per tick for each player with automation running. Its movement input replaces idle client inputs in the normal step-credit loop. Its commands go through the normal attack, pickup and use-item handlers. Non-idle input or a manual command pauses it. `onDrop` turns it off.

**Disconnects.** Network drop: the server holds the session for 20 s (`allowReconnection`) and the SDK reconnects automatically. Page reload: the reconnection token in `sessionStorage` resumes the same session. On final leave, position is saved to Postgres and the character is freed.

## Local database options

- Docker: `infrastructure/docker/docker-compose.yml` (Postgres 17).
- No Docker: `pnpm db:pglite` (embedded Postgres over the wire protocol, data in `.data/`).
- Tests: in-process PGlite on a random port, migrated automatically.
