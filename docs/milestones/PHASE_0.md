# Phase 0: Technical Foundation

**Success condition:** two authenticated players enter the same browser game map, see each other move, and reconnect without losing their characters.
**Status: ✅ met.** Verified by `e2e/multiplayer.spec.ts` (real Chromium, full stack) on 2026-10-20.

| Milestone        | Scope                                                                                                                | Status | Verified by                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------ |
| 0.1 Monorepo     | pnpm workspaces, Turborepo, strict TS, ESLint, Prettier, packages, scripts                                           | ✅     | `pnpm typecheck lint format:check` green   |
| 0.2 Web client   | Next.js, client-only Phaser, Boot/Preload/World scenes, placeholder map, movement + jump, 1280×720, pixel-art config | ✅     | `pnpm build`; screenshots; e2e             |
| 0.3 Backend      | Fastify API, Colyseus server, Postgres + Drizzle, migrations, account/character schema, shared contracts             | ✅     | `api` + `database` integration tests       |
| 0.4 Multiplayer  | Authenticated joins, authoritative map room, join/leave, 2-player sync, movement validation, disconnect/reconnect    | ✅     | `game-server` integration tests (8), e2e   |
| 0.5 Testing/docs | Vitest, Playwright, integration tests, GitHub Actions, local-dev docs, clean install                                 | ✅*    | all gates green locally (CI mode included) |

\* GitHub Actions has not run yet (nothing pushed), and Docker Compose was not exercised on the authoring machine (no Docker installed). Both are configured but unverified.

Out of scope until Phase 0 is accepted: combat, equipment and enhancement, advanced classes, bosses.
