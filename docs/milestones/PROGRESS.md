# Progress Log

Newest last. One short entry per task: date · agent · what changed · tests · open issues.

## 2026-10-20 · Claude Code · Phase 0 foundation

- **Built:** monorepo (7 packages, 3 apps); deterministic movement core; Fastify auth and characters; Drizzle schema with first migration; Colyseus 0.18 authoritative map room with prediction/reconciliation, reconnection and persistence; Next.js and Phaser client with placeholder pixel art; CI workflow; docs.
- **Found via CI:** the client simulated in slow motion whenever the window was unfocused and below 60 fps, because Phaser caps `delta` at 16.7 ms when unfocused. `WorldScene` now uses the raw frame time; covered by an e2e test.
- **Review fixes:** rejoin-while-saving race (could resume a stale row), reconnect-timeout error noise, input `seq` capped at int32, client 409 retry now covers the 20 s reconnect window.
- **Tests:** 30 Vitest (unit + DB/API/room integration on PGlite) and 1 Playwright e2e, all passing. Lint, format, typecheck and build are clean.
- **Found and fixed:** server step credits were per tick; Node timers on Windows fire at ~48 Hz, so the server fell behind real-time input. Credits now use wall-clock time, with a regression test.
- **Open:**
  - CI and Docker Compose are not yet run (no push, no Docker locally).
  - No login rate limiting (`shortcut:` in `apps/api/src/app.ts`).
  - Duplicate-login guard is process-local (single game-server process only).
  - Position is saved only on leave; a server crash loses movement since join.
  - Remote players use simple smoothing, not a snapshot buffer.
  - A client that stops sending inputs (e.g. hidden tab) freezes in place, including mid-air.

## 2026-10-20 · Claude Code · Phase 0.1 web client

- **Built:**
  - Ladders: shared `game-core` physics, so they're server-authoritative too.
  - Fernreach Fields test map, now the start map. Rooms are per map.
  - Animated adventurer placeholder sprite (idle/walk/jump/fall/climb, 4 class palettes).
  - Esc menu (resume, toggle debug, exit) and an F3 debug overlay (FPS, position, state).
  - Client split into LocalPlayer, RemotePlayers, Avatar, MapRenderer and UI modules.
  - Protocol v2.
- **Tests:** 39 Vitest (+7 ladder/state, +1 per-map rooms, +1 content) and 3 Playwright (+1: climb a ladder, exit via menu). Lint, format, typecheck and build are clean.
- **Open:**
  - The canvas is FIT-scaled, so sprites scale fractionally (still nearest-neighbour, no blur). Integer zoom is left for later.
  - No portals yet, so town characters can't reach Fernreach.
  - The debug overlay is on by default.

## 2026-10-20 · Claude Code · Phase 1B combat server

- **Built:**
  - Server-authoritative attacks and skills (validation, cooldowns, MP, hitboxes, crits, defense, knockback).
  - Monster AI (idle, patrol, detect, chase, attack, return, death, respawn) for the Twig Creature, Fern Frog and Crystal Beetle.
  - Player HP/MP, regen, death and respawn.
  - EXP split by damage, leveling with stat growth, persisted progression.
  - Drop tables, owned loot, validated pickups, a 24-slot inventory, and currency.
  - An idempotency ledger for every reward. Protocol v3.
  - New Duskmire Caverns test map.
- **Tests:** 97 Vitest (+58), covering:
  - The formula, progression, AI and drop rolls.
  - Malicious commands: unknown/prototype skill ids, other classes' skills, spam, cooldowns, MP, dead/climbing, out of range, foreign or far loot, malformed payloads.
  - Racing duplicate grants.
  - Two-player kills with an EXP split, level-up, owned loot with a double pickup, and a monster killing a player followed by respawn.

  The 3 Playwright tests still pass.

- **Security review fixes:**
  - HP/MP are now persisted on leave, so a rejoin can't heal you, and leaving while dead keeps you dead.
  - A monster heading home ignores re-aggro, which stops kiting from a safe spot.
  - Only one pickup transaction can be in flight per player.
- **Not done (Codex / client):** no rendering of monsters, drops, damage or HUD yet; see "Client integration (v3)" in `NETWORK_PROTOCOL.md`. Until then, combat works only through the protocol (proven by the integration tests).
- **Open:**
  - No lag compensation for melee.
  - Consumables can't be used yet.
  - Position and HP/MP are saved only on leave (a crash loses them since join).
  - The reward ledger is never pruned.

## 2026-10-21 · Claude Code · Phase 2 progression, equipment, enhancement, auto-grinding (server)

- **Audited first:** Phase 0/1 already had levels, a configurable EXP curve and max level, idempotent EXP/loot grants, level-up events, account ownership checks on join, per-class growth and one skill per class. No Phase 1 repairs were needed. Codex's Phase 1A/integration/art work exists only as uncommitted changes in the main checkout. This work is on `phase-2-progression` in a separate worktree, branched from the shared HEAD.
- **Milestones 1–2 (`b1d21e6`):** full stat sheet (STR/DEX/INT/LUK, HP/MP, attack, magic, defense, crit rate/damage, boss damage, ignore defense) derived by `deriveStats` from data (`CLASS_SCALING`, `STAT_FORMULA`). The damage formula now uses crit damage, boss damage and ignore defense, and level-1 outputs are unchanged. 4 starter skills per class (innate attack, passive, buff, second attack) with levels, requirements, prerequisites, MP costs and cooldowns. Skill points are earned minus spent. `learnSkill` is transactional and idempotent. Buffs expire and end on death. `character_skills` table.
- **Milestones 3–4 (`dc3200e`):** 11 equipment slots, 5 rarities, 15 items; per-copy instances with bonus stats rolled at drop; equip/unequip with swap; potions usable server-side. Forge Ascension, Arcane Imprints and Relic Resonance tables are versioned in content, and every attempt is logged with its table version. Each operation is one transaction that locks the character row and writes `item_transactions`. Forge/imprint retries can't pay twice.
- **Milestone 5 (`80e7768`):** a pure auto-grind state machine (DISABLED/SEARCHING/MOVING/ATTACKING/LOOTING/RECOVERING/PAUSED). The room feeds its input through the normal step-credit movement and its commands through the normal attack/pickup/use-item handlers. Manual input pauses it; disconnect, death, boss instances and a 2 h limit stop it. Config is saved in `auto_grind_configs`.
- **Milestone 6:** migration upgrade test with pre-Phase-2 data plus a tested manual rollback (`migrations/rollback/phase-2.sql`). Docs: GAME_DESIGN, OVERVIEW, NETWORK_PROTOCOL (all additive to v3; `PROTOCOL_VERSION` stays 3), ADR-014–016. Two code reviews. Review 1 fixes: DB pre-check for learn requests, buff-expiry test, buffs end on death. Review 2 fixes: automation skips a drop whose pickup was refused instead of retrying it every tick (full bag); forge idempotency uses a new `forgeAttempts` counter (migration `0006`), since a failed attempt can keep the level; manual input pauses automation even when its input is dropped, and keeps extending the pause; re-enabling keeps the run's start time; one config save at a time; a failure refreshing after a committed item operation is no longer reported as `itemRejected`; automation walks toward bounds that miss its current platform.
- **Verification:** lint, format check, typecheck (9 packages) and the production build passed. All **156** workspace unit/integration tests passed with Turbo cache bypassed (86 server, 47 core, 10 content, 4 protocol, 4 API, 3 database, 2 client). Browser suite on this branch: 3/3 Playwright tests passed on alternate ports (3100/4100/2667), because another stack held the default ports. The first cold run failed joins with "Failed to fetch" while the client bundle compiled, and the identical rerun passed.
- **Integration with Codex's uncommitted client** (checked in a throwaway worktree, not committed): one trivial `map-room.ts` conflict in `onReconnect` (keep both sides). `game-client` must add `characterStats`, `skillRejected`, `itemRejected`, `enhanceResult` and `autoGrind` to `CombatMessages`. Its test asserting one skill per class needs updating. With those, the combined tree typechecks, all 85 combined server tests pass, and 8/9 of Codex's Playwright tests pass, including both Phase 1 combat scenarios. The failing `art-validation` test expects no approved assets, while Codex's in-progress art files list six; that's unrelated to this work. The reedgrip-gloves drop chance was lowered to 1% so Codex's rng-0.01 loot tests still see 4 twig drops.
- **Not done / limits:** no client UI for skills, stats, equipment, enhancement or auto-grind (`NETWORK_PROTOCOL.md` lists the client steps). Auto-grind only targets monsters on the player's current platform (no jump/ladder pathing). Buffs don't persist. There's no job-advancement flow (stages are data only). No boss-instance maps exist yet, so the boss refusal is unit-tested with a flagged map. The concurrency tests run on single-connection PGlite, which can't prove the row locks; real-Postgres concurrency, load and WAN behavior weren't tested. Accepted review items: a quick rejoin during an in-flight item operation can load equipment before it commits (stale stats until the next change; same as the existing pickup race), and a timed-out unreachable target can be picked again.
