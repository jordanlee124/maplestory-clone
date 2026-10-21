# Cindervale Online

A browser-based, real-time 2D pixel-art MMORPG. Desktop browsers only. Original IP.

**Status:** Phase 0 (technical foundation) is complete. Two players can log in, share a map, see each other move, and reconnect. See [docs/milestones/PHASE_0.md](docs/milestones/PHASE_0.md).

## Quick start

Requires **Node ≥ 22.12** and **pnpm 10** (`npm i -g pnpm@10`).

```sh
pnpm install
cp .env.example .env

# Database: pick one
docker compose -f infrastructure/docker/docker-compose.yml up -d   # Postgres 17
pnpm db:pglite                                                      # no Docker: embedded Postgres (keep running)

pnpm db:migrate
pnpm dev            # web :3000 · api :4000 · game server :2567
```

Open http://localhost:3000 in two browsers (or a normal and a private window), register two accounts, create a character in each, and press **Play**.
Controls: ← → or A/D to move, Space or Alt to jump.

## Commands

| Command                                        | What it does                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                                     | Run web, API and game server in watch mode                         |
| `pnpm test`                                    | Unit + integration tests (in-memory Postgres, no Docker)           |
| `pnpm test:e2e`                                | Playwright: boots its own full stack (or reuses `pnpm dev`)        |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | Static checks                                                      |
| `pnpm build`                                   | Production build of the web app                                    |
| `pnpm db:generate`                             | Create a migration after editing `packages/database/src/schema.ts` |
| `pnpm db:migrate`                              | Apply migrations to `DATABASE_URL`                                 |

First e2e run: `pnpm exec playwright install chromium`.
If another app holds the default ports, run an isolated test stack in PowerShell:

```powershell
$env:E2E_WEB_PORT = '3900'
$env:E2E_API_PORT = '3901'
$env:E2E_GAME_PORT = '3902'
pnpm test:e2e
```

Setting `E2E_WEB_PORT` disables existing-server reuse. These variables affect the test stack only; normal `pnpm dev` uses the ports above.

## Docs

- [Architecture overview](docs/architecture/OVERVIEW.md) · [Project rules](docs/architecture/PROJECT_RULES.md) · [Decisions](docs/architecture/DECISIONS.md)
- [Network protocol](docs/protocols/NETWORK_PROTOCOL.md) · [Game design](docs/gameplay/GAME_DESIGN.md) · [Progress](docs/milestones/PROGRESS.md)
- Agents: [AGENTS.md](AGENTS.md) (Codex) · [CLAUDE.md](CLAUDE.md) (Claude Code)
