# Phase 1 integration verification

2026-10-21 · Codex · Branch `phase-1-integration`

The Phaser client uses the existing v3 combat protocol and the real authoritative Colyseus room. Commands contain intent; the server selects targets, validates range/state/cooldowns/ownership, calculates damage, and persists rewards. No protocol version or database schema change was needed.

## Fixes

- Reconnect now sends current owner EXP (`amount: 0`) and inventory snapshots. A reloaded client previously resumed movement without its progression/currency HUD data. This does not run reward-grant code.
- The client enables SDK reconnect immediately after join rather than inheriting its five-second minimum uptime. Movement transmission and fixed-step accumulation stop while disconnected, preventing stale inputs from entering the SDK's offline buffer.
- Dead-body prediction now follows the server's frozen body while continuing to sequence neutral inputs. Normal prediction resumes from authoritative respawn state.
- Read-only client diagnostics expose confirmed hit targets, local AI-hit counts, inventory, connection state and queued-message count for gameplay assertions.

The reconnect snapshot test, offline browser queue test, and dead-prediction test each failed before its corresponding fix and passed afterward.

## Requested checks

| Check                                   | Verification evidence                                                                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Attacks reach the server             | Chromium presses Ctrl through Phaser controls; tests wait for `attackResult` with the requested monster ID.                                                                                                                                                   |
| 2. Server validates/calculates damage   | Real-room test asserts exactly 17 damage for a deterministic attack; forged damage, hit lists and coordinates cannot hit a distant monster. Pure combat tests cover class, state, cooldown, MP and target limits.                                             |
| 3. Monster HP/reactions                 | Browser observes reduced synced HP after a confirmed hit and the rendered monster disappearing after defeat. Client reactions are driven by `attackResult`, never a predicted hit.                                                                            |
| 4. AI attacks players                   | Two-player browser test keeps a damaged Twig Creature alive and observes its confirmed retaliation. Real-room test also checks Crystal Beetle damage, death and respawn.                                                                                      |
| 5. Death sync                           | Both Phaser clients observe the same monster dead and hidden; real-room tests check the shared kill broadcast.                                                                                                                                                |
| 6. EXP/levels persist                   | Real-room tests verify both contributors' EXP and a level 10→11 grant directly in Postgres. Reconnect restores level 11/EXP 3 without another grant.                                                                                                          |
| 7. Secure loot                          | Real-room tests generate owned loot, reject a foreign and distant pickup, persist an item/currency grant, and allow only one racing duplicate pickup. Reward tests verify stacking, capacity rollback and transaction deduplication.                          |
| 8. Shared fighting                      | Both browser-controlled players land confirmed hits on the same monster ID and both receive EXP for its death.                                                                                                                                                |
| 9. Reconnect does not duplicate rewards | Real-room test compares the character row and reward ledger before/after reconnect and replays an old pickup/attack; neither pays again. Browser reload and an offline interval preserve owner snapshots and resume movement without queued offline commands. |
| 10. Invalid commands rejected           | Real-room tests cover unknown/prototype/foreign skills, spam, forged results/positions, distant/foreign/missing/duplicate pickups and malformed payload disconnection.                                                                                        |

Primary tests: [server combat integration](../../apps/game-server/src/combat-room.test.ts), [combat rules](../../apps/game-server/src/combat.test.ts), [reward transactions](../../apps/game-server/src/rewards.test.ts), [two-player browser gameplay](../../e2e/combat.spec.ts), [prediction](../../packages/game-client/src/predictor.test.ts). Paths below are relative to the repository root when running commands.

## Final gates

| Command                            | Result                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                        | Passed                                                                                                            |
| `pnpm format:check`                | Passed                                                                                                            |
| `pnpm typecheck`                   | Passed across all workspaces                                                                                      |
| `pnpm exec turbo run test --force` | 107 tests passed; no Turbo test cache used                                                                        |
| `pnpm build`                       | Production Next.js/Phaser browser build passed; server uses TypeScript source at runtime and passed its typecheck |
| `pnpm test:e2e`                    | All 5 Chromium tests passed, including the two-player fight, reload and offline recovery                          |

Phase 0 movement, low-FPS/unfocused movement, multiplayer visibility, page reload, ladder climbing and menu exit remain in the browser regression suite. Expected disconnect/malformed-command logs in negative tests are not failures; the combat browser tests assert no page errors.

## Remaining limitations

- Potion use still needs an authoritative use-item command. Only one class skill exists, leaving three skill slots empty. Monster windup/miss events are not yet supplied by v3; attack poses follow confirmed contact. Sprites remain temporary original placeholders.
- Browser gameplay covers Twig Creatures in Fernreach. Crystal Beetle AI/death/respawn is covered through real SDK/server tests, not a browser trip through Duskmire. Loot security and level-up persistence are verified in SDK/server/database tests rather than browser controls.
- No real-WAN latency, large-player-count, mobile, process-crash or database-outage recovery test was performed. There is no melee lag compensation. Position/vitals save on leave; reward ledger growth, failed-grant retries and multi-process session ownership remain production work.
