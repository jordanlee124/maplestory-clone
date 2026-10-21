# Architecture Decisions

Short ADRs. Add new entries at the bottom: context, decision, consequences.

## ADR-001: Just-in-time internal packages (2026-10-20)

Internal packages export `src/*.ts` directly. Next transpiles them (`transpilePackages`), servers run under `tsx`, and Vitest handles TS natively.
**Why:** no build ordering, instant cross-package edits. **Cost:** servers need `tsx` at runtime.
`// shortcut:` bundle servers with esbuild before production deployment.

## ADR-002: Server-authoritative movement via input replay (2026-10-20)

Clients send one input per fixed 1/60 s step and the server runs the same deterministic `game-core` `stepBody`. We chose this over clients sending positions plus server bounds checks, because it makes speed hacks and teleports impossible by construction and gives exact client reconciliation.
Throughput is capped by **wall-clock step credits** (max 10 banked). We measured Node timers firing at ~48 Hz on Windows, so tick-count credits made the server fall behind.
We didn't use Colyseus 0.18's built-in `defineInput`/`setFixedTimestep` pipeline. It's new and requires Schema-class inputs, while the explicit queue is ~20 lines and easy to reason about. Revisit if we need lag compensation or rewind.

## ADR-003: Separate API (Fastify) and game server (Colyseus) processes (2026-10-20)

HTTP account and character flows don't belong on the realtime server. Both share Postgres and a JWT (HS256, `JWT_SECRET`) defined once in `@cindervale/protocol/token`.

## ADR-004: PGlite for tests and Docker-less development (2026-10-20)

`@electric-sql/pglite-socket` serves embedded Postgres over the wire protocol, so the apps always use plain `pg`, with one driver path. Tests need no Docker or CI service container. Production and Docker dev use real Postgres 17.

## ADR-005: Colyseus 0.18 split packages (2026-10-20)

We use `@colyseus/core` + `@colyseus/ws-transport` + `@colyseus/schema` rather than the `colyseus` meta-package, which pulls in Redis drivers and a monitor we don't need yet. Client: `@colyseus/sdk`.

## ADR-006: Phaser 3, not 4 (2026-10-20)

Phaser 4 is npm `latest`, but the project spec requires Phaser 3. Pinned `phaser@~3.90`. Revisit as a deliberate migration.

## ADR-007: TypeScript 6.0, not 7 (2026-10-20)

`typescript-eslint` supports TS `<6.1`. Upgrade when it supports TS 7.

## ADR-008: One room per map, Fernreach Fields as start map (2026-10-20)

Rooms are matched with `filterBy(['mapId'])`. The client sends its character's `mapId`, and the server validates it against the saved character. New characters start in Fernreach Fields (the beginner region); existing Cindervale Town characters stay in town until portals exist.
Channels (several rooms per map) come later as another `filterBy` key.

## ADR-009: Procedural placeholder art (2026-10-20)

Placeholder sprites and tiles are drawn in code at load time (`game-client/src/art/`), at native resolution, behind stable texture keys and frame names (`adventurer-<class>`, `idle0…climb1`). Real sprite sheets in `/assets` replace them without touching scene code.

## ADR-010: Idempotent rewards via a ledger table (2026-10-20)

Each EXP/loot grant inserts a unique key into `granted_rewards` (`exp:<monsterLifeId>:<characterId>`, `drop:<dropId>`) **in the same transaction** as the reward, with `ON CONFLICT DO NOTHING`. A replayed, raced, or duplicated grant is a no-op, even across processes. The character row is locked (`FOR UPDATE`) so concurrent grants to one character apply in sequence. A pickup also claims the drop in memory before awaiting the database, so two pickups in flight can't both pass validation. Loot is all-or-nothing: if it doesn't fit, the transaction rolls back (including the ledger key) and the drop is restored.
`// shortcut:` the ledger grows without bound; prune keys older than a day once volume matters.

## ADR-011: Combat rules split pure / server (2026-10-20)

Formulas, leveling, hitboxes, drop rolls and the monster AI state machine are pure functions in `game-core`, with injected `now` and `rng`, so they're unit-tested deterministically. Validation and resolution that mutate session state are in `game-server/src/combat.ts`, with no IO. `map-room.ts` only wires messages, ticks and persistence. Balance numbers live only in `content`.

## ADR-014: Derived stat sheet and skill points (2026-10-21)

Stats are derived, never stored: `deriveStats` (game-core) computes base + perLevel × (level − 1) + flat bonuses, then adds the class's primary/secondary stat × `STAT_FORMULA` to attack (physical) or magic. All numbers live in `content` (`CLASS_SCALING`, `STAT_FORMULA`, `PROGRESSION`, `SKILLS`). Primary stats grow automatically per level; there is no manual stat allocation. Bonuses are flat `Partial<Stats>` from passives and buffs, which is also the hook for equipment. Only learned skill levels are persisted (`character_skills`). Skill points are computed as earned − spent, so they can't drift from the stored levels. Learning runs in the room, in a transaction that locks the character row, and names the target level so a retry is a no-op. Buffs end on leave and on death. Spent points are recomputed from current skill data, so making a learned skill innate refunds a point and lowering `maxLevel` can leave a character negative (blocked from learning, never over-powered). Migrate stored levels when changing either. Advancement stages are data (`ADVANCEMENT_LEVELS`, `SkillDef.stage`), with no advancement flow yet.

## ADR-015: Equipment instances are inventory rows (2026-10-21)

An equipment instance is an `inventory_items` row with quantity 1. Its id is the instance id, and the row carries its own bonus lines, forge level and imprints. A row is in a bag `slot` or a worn `equipSlot`, never both (a check constraint), so moving an item never copies it. Rejected alternative: a separate equipment table, which would need cross-table bag-slot uniqueness. Equip, unequip, forge, imprint and use run in one transaction that locks the character row and writes an `item_transactions` entry. Forge and imprint requests name the item's attempt/reroll count, so a retry can't pay twice (the forge level alone isn't enough: a failed attempt can keep it). The random outcome is rolled with the server rng inside the transaction, and the table version is logged. Migrations are additive. `migrations/rollback/phase-2.sql` reverts Phase 2 by hand (tested).

## ADR-016: Auto-grinding drives the normal input path (2026-10-21)

Automation is a pure state machine (`stepAuto`) that outputs a `MoveInput` and at most one command per tick. The room substitutes that input for idle client inputs inside the existing step-credit loop. Commands go to the same `handleAttack`/`handlePickup`/`handleUseItem` as client messages. There's no separate combat, movement or reward code, so speed, collision, cooldowns, MP and reward idempotency are enforced by construction. Running state is session-only (stopped by `onDrop`); only the config is persisted. `// shortcut:` targets are limited to the player's current platform. Add platform-graph pathing (jumps, ladders) for multi-level grinding.
