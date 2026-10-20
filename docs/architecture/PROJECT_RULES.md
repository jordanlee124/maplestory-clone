# Project Rules

Single source of truth for everyone working on Cindervale Online — humans, Codex, and Claude Code.
`AGENTS.md` and `CLAUDE.md` point here; don't duplicate these rules there.

## Architecture (non-negotiable)

1. **Phaser** (`packages/game-client`) renders gameplay, sprites, cameras and reads local input. No game rules there.
2. **Next.js** (`apps/web`) handles the website, auth UI, character select and React UI.
3. **Colyseus** (`apps/game-server`) runs the authoritative simulation. **Fastify** (`apps/api`) handles HTTP: accounts, characters.
4. **PostgreSQL** via **Drizzle** (`packages/database`) stores all persistent data.
5. Clients send **inputs/commands, never results**. The server validates movement, damage, skills, cooldowns, rewards and currency.
6. Shared rules live in `packages/game-core`: deterministic and pure, with no browser, Node, or network APIs.
7. Every network message is typed and validated with Zod in `packages/protocol`. Bump `PROTOCOL_VERSION` on breaking changes.
8. Important DB mutations are transactional, and idempotent where a retry is possible.
9. Gameplay modules stay independent of presentation code.
10. One modular backend. No microservices until a measured need exists.

## Stack

pnpm workspaces · Turborepo · TypeScript (strict) · Next.js (App Router) · React · Tailwind · Phaser 3 · Colyseus 0.18 · Fastify · PostgreSQL · Drizzle · Zod · Vitest · Playwright · GitHub Actions.
**Do not add a competing framework** (another ORM, state library, test runner, game engine, HTTP framework) without an entry in `DECISIONS.md` agreed by the maintainer. Redis only when a demonstrated need appears.

## Package boundaries

| Package                    | May depend on                                   | Must not                       |
| -------------------------- | ----------------------------------------------- | ------------------------------ |
| `game-core`                | nothing                                         | touch DOM, Node, network, time |
| `content`                  | `game-core` (types)                             | contain logic                  |
| `protocol`                 | `content`, `zod`                                | import server code             |
| `protocol/token` (subpath) | `jose`                                          | be imported by browser code    |
| `database`                 | `drizzle-orm`, `pg`                             | be imported by browser code    |
| `game-client`              | `game-core`, `content`, `protocol`, Phaser, SDK | decide outcomes                |
| `ui`                       | React                                           | know about the game server     |

Internal packages export TypeScript source (no build step); apps transpile them.

## Working agreement

- Read the relevant docs before changing code: `OVERVIEW.md`, then `NETWORK_PROTOCOL.md` for anything on the wire.
- Small, independently testable changes. Don't rewrite working systems without a stated reason.
- Contract changes (protocol schemas, Colyseus state, DB schema) update **code, tests and `NETWORK_PROTOCOL.md` together**.
- Schema changes: edit `packages/database/src/schema.ts`, run `pnpm db:generate`, and commit the generated migration. Never edit an applied migration.
- Record architecture decisions in `DECISIONS.md` (short ADRs).
- Mark deliberate shortcuts with `// shortcut: <limit>, <when to upgrade>`.

## Multi-agent coordination

- Concurrent tasks use **separate branches or git worktrees**. Never edit files another agent is changing.
- Never overwrite, stash, or reset another agent's uncommitted work.
- Default ownership (not hard limits): **Codex**: Phaser gameplay, movement/combat feel, client networking, performance, game tests. **Claude Code**: backend architecture, DB schema and migrations, auth, Colyseus infrastructure, technical docs.
- Finish every task with a short summary: files changed, tests run (with result), remaining issues. Add a line to `docs/milestones/PROGRESS.md`.

## Quality gates (CI runs all of them)

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

Run the gates relevant to your change before declaring it done. Never claim a milestone is complete without verification.

## Content and IP

Original IP inspired by MapleStory-style gameplay. Never copy MapleStory assets, code, dialogue, characters, maps or names.
Pixel art: chibi characters ~48–64 px tall, 16/32 px tiles, nearest-neighbour rendering, integer scaling only, transparent sprite sheets with consistent origins (bottom-centre = feet).

## Token efficiency

Read only the files you need. Prefer targeted edits. Don't regenerate unchanged code or create docs nobody asked for. Ask only when a decision materially changes the implementation.
