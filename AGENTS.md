# AGENTS.md — Codex

Rules for all agents: **[docs/architecture/PROJECT_RULES.md](docs/architecture/PROJECT_RULES.md)**. Read it first.

Codex defaults: Phaser gameplay (`packages/game-client`), movement and combat feel, client networking, performance, game tests.

- Map: [docs/architecture/OVERVIEW.md](docs/architecture/OVERVIEW.md). Wire format: [docs/protocols/NETWORK_PROTOCOL.md](docs/protocols/NETWORK_PROTOCOL.md).
- Movement/physics rule changes go in `packages/game-core` (shared with the server), never only in the client.
- Work on a branch or worktree. Don't touch files Claude Code is changing.
- Before finishing: run the relevant gates from PROJECT_RULES, then append to `docs/milestones/PROGRESS.md`.
