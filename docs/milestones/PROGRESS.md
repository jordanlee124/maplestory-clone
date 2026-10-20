# Progress Log

Newest last. One short entry per task: date · agent · what changed · tests · open issues.

## 2026-10-20 · Claude Code · Phase 0 foundation

- **Built:** monorepo (7 packages, 3 apps); deterministic movement core; Fastify auth and characters; Drizzle schema with first migration; Colyseus 0.18 authoritative map room with prediction/reconciliation, reconnection and persistence; Next.js and Phaser client with placeholder pixel art; CI workflow; docs.
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
