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
