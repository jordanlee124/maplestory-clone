# CLAUDE.md — Claude Code

Rules for all agents: **[docs/architecture/PROJECT_RULES.md](docs/architecture/PROJECT_RULES.md)**. Read it first.

Claude Code defaults: backend architecture, DB schema and migrations, auth, Colyseus server (`apps/game-server`), API (`apps/api`), technical docs.

- Map: [docs/architecture/OVERVIEW.md](docs/architecture/OVERVIEW.md). Wire format: [docs/protocols/NETWORK_PROTOCOL.md](docs/protocols/NETWORK_PROTOCOL.md). Decisions: [docs/architecture/DECISIONS.md](docs/architecture/DECISIONS.md).
- Colyseus is 0.18 and its API differs from older examples (`onDrop`/`onReconnect`, `schema({ x: t.float64() })`, Zod validators in `onMessage`). Check `node_modules/@colyseus/core/build/Room.d.ts` rather than relying on memory.
- DB tests run on in-process PGlite (`@cindervale/database/testing`), so no Docker is needed.
- Work on a branch or worktree. Don't touch files Codex is changing.
- Before finishing: run the relevant gates from PROJECT_RULES, then append to `docs/milestones/PROGRESS.md`.
