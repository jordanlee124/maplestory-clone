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

## 2026-10-21 · Codex · Phase 1A combat client

- **Built** on branch `phase-1a-combat-client`:
  - Reusable, tested animation state machine for idle/walk/jump/fall/climb, basic and skill attacks, hit reaction and death. Presentation windows are 90/100/160 ms; feet origins and shared collision rules stay unchanged.
  - Ctrl attacks, Space jumps, Q/W/E/R skill slots, 1/2 potion shortcuts, a 180 ms attack buffer, and cooldown estimates reconciled with typed v3 acceptance/rejection events. The web host provides keyboard-accessible remapping for the current play session.
  - Original temporary pixel placeholders for Twig Creature, Fern Frog and Crystal Beetle. Synced positions, facing, HP, death and respawn drive rendering; confirmed events drive attack/hit reactions.
  - Damage/critical numbers, brief hit flashes and cosmetic recoil, skill/defeat/respawn effects, monster HP bars, drops and nearest-drop pickup on Z.
  - HP/MP/EXP/level, skill/potion slots, currency and SDK-measured RTT HUD; Enter requests respawn while dead. No local damage, healing, MP spending or reward calculation.
  - Early capture of join-time EXP/inventory messages and scene listener cleanup, fixing the Phase 0 exit-time callback error found during baseline verification.
- **Verified before editing:** existing unit suite passed from Turbo cache; all 3 Phase 0 Playwright tests passed. Browser baseline exposed the callback error and unhandled initial owner snapshots noted above.
- **Final verification:** 104 unit/integration tests passed with Turbo cache bypassed (9 client tests, 7 new); all 4 Chromium Playwright tests passed, including live monster damage/kill/EXP, class skill, remote actions, remapping and exit without page errors. Lint, format check, typecheck and production browser build passed. Combat screenshot inspected. Next dev generated `apps/web/AGENTS.md` with its installed-version documentation guidance.
- **Remaining integration:** v3 has no use-item command, so 1/2 show an unavailable message and never heal locally. Only one class skill exists, leaving W/E/R empty. Monster attack poses follow landed hits because no authoritative windup/miss event exists. See `docs/protocols/NETWORK_PROTOCOL.md` for these requirements. Backend logic and protocol version are unchanged.
- **Not checked:** live Crystal Beetle combat in Duskmire (no portal flow), real latency/load testing, and mobile controls. Final sprites, persistent key preferences and the existing fractional FIT scaling are outside this slice.

## 2026-10-21 · Codex · Phase 1 integration

- **Inspected:** project rules, shared architecture, v3 protocol, Phaser command/event/prediction paths, server validation/AI/rewards and existing Phase 1 tests. Baseline: 104 fresh unit/integration tests passed. Continued the prior client changes on `phase-1-integration` without resetting other work.
- **Fixed:** reconnect resends owner EXP/inventory snapshots without granting rewards; automatic recovery is enabled immediately after joining; disconnected clients stop fixed-step input transmission instead of filling the SDK's offline queue; dead-body prediction follows the authoritative frozen body until respawn. No wire-format, database schema or combat balance changes.
- **Added verification:** real-server reconnect after a persisted level-up/currency pickup with unchanged reward ledger on replay; forged attack results/coordinates and distant pickup rejection; dead-prediction regression; two actual Phaser players landing hits on one monster, taking AI retaliation, synchronizing defeat, sharing EXP, restoring snapshots on reload and recovering movement after an offline interval without queued commands. New client diagnostics remain read-only.
- **Results:** all 107 unit/integration tests passed with Turbo test cache bypassed (39 server, 10 client); all 5 Chromium Playwright tests passed, including all Phase 0 movement/multiplayer/ladder/menu regressions. Lint, format check, workspace typechecks and production browser build passed. Two-player combat screenshot inspected; combat tests assert no page errors.
- **Evidence and limitations:** see `docs/milestones/PHASE_1_INTEGRATION.md` for the ten requested checks, test sources, commands and the split between browser and SDK/database verification. Potions, additional class skills, authoritative monster windups, final art, WAN/load/mobile testing and crash/outage recovery remain outside this integration slice. Loot security, level-up persistence and Crystal Beetle behavior were verified through real server/database tests rather than browser controls.

## 2026-10-21 · Codex · Phase 1.5 pixel-art foundation

- **Audited and specified:** character, monster, map, UI, loot and FX art. `docs/art/PIXEL_ART_GUIDE.md` records the proposed original direction, palette, outline/shading rules, required poses/timings, collision bounds, naming, folders and approval/import process. All 16 existing loaded assets remain explicitly temporary; five equipment slots are specified as missing. No approved production assets were available, so no placeholder was promoted to final Fernreach art.
- **Implemented** on `phase-1-5-pixel-art-foundation`: typed asset metadata, approved-PNG loading, dimension/frame/clip/provenance validation and reusable animation registration; untrimmed 64×64 actor cells with bottom-centre origins; synchronized equipment overlays; shared nearest-filtered 1280×720 rendering with integer display scaling and rounded camera pixels. Existing native drawings were padded, not enlarged. No physics, hurtbox, damage or reward rules changed.
- **Review tools:** `/art-preview` displays every current actor pose, terrain samples and separately labeled equipment calibration markers. Pixel-only character/monster regression baselines were visually inspected. Source/export folders and ADR-012 document the pipeline. Equipment markers are confined to the review board.
- **Regression fix:** combat browser verification found command facing could follow a sprite locked in a hit/attack pose. Movement now retains command facing independently; a unit regression covers it. Browser scenarios run serially to isolate the shared map/software canvases; two-player scenarios still run concurrent clients. The remapping scenario leaves hostile monsters before opening settings.
- **Actual final results:** lint, format check, all workspace typechecks, production browser build and `git diff --check` passed. All **114** unit/integration tests passed with Turbo cache bypassed (17 client, 39 server, 43 core, 5 content, 4 protocol, 4 API, 2 database). All **8 Chromium Playwright tests passed** in one full run (1.9 minutes): pose snapshots, equipment synchronization, desktop integer sizing at DPR 1/2, two-player confirmed combat/rewards/reconnect, hotkeys/remapping, movement/reload/unfocused timing, ladder and menu exit. Tested viewports: 1280×720, 1366×768, 1365×768, 1920×1080, 2560×1440, 3840×2160 and a 900×720 scrolling host; inspected the live 1280×720 combat capture.
- **Remaining:** approved character/monster/environment sheets, clean equipment bases and layers, pixel UI/font/icons, loot and combat FX. Production PNG loading is unit-tested with fixtures; no final approved PNG exists for an end-to-end import. Equipped-item appearance still needs authoritative state/UI; monster windups need a protocol/server extension. Fractional OS/browser zoom, other browser engines, physical display calibration, mobile and WAN/load behavior were not verified. Narrow hosts scroll; intermediate desktop widths letterbox. Existing potion/additional-skill limitations remain.

## 2026-10-21 · Codex · Art-direction correction and fidelity pipeline

- **Direction corrected:** audited actors, monsters, terrain, parallax, UI, effects and rendering. `docs/art/ART_DIRECTION.md` supersedes the generic retro constraints for new art with expressive proportions, independently layered sprites, organic scenery, richer animation and mixed texture filtering. Project rules and ADR-013 reflect the maintainer's explicit new direction; the historical placeholder contract is identified as such.
- **Pipeline:** new approved-asset atlas metadata permits variable frame dimensions, per-frame pivots/head/hand anchors and unequal clip durations. Layered rendering supports independent face/accessory loops, pose layers/equipment, mirrored anchors and action-specific depth. Added explicit nearest/linear filtering, parallax helpers, finite animated effects with cleanup and bounded approved-texture particles. No new dependencies. Camera zoom is configurable (default 1), with invalid values rejected before joining a room. Shared physics, collision, networking and server combat logic are unchanged in this correction.
- **Representative-scene fallback:** `/art-validation` hosts `ArtValidationScene`, separate world/UI cameras, zoom/pose/facing/pan controls and 17 exact first-scene asset slots. There are zero approved exports, so it displays clearly labeled measurement guides, not primitive shapes presented as artwork. Existing live gameplay remains on its identified temporary art; rich authored animation and scenery have not been fabricated or promoted. No asset production expansion occurred.
- **Review evidence:** `docs/art/VISUAL_COMPARISON.md` contains the audit comparison, replacement sequence, outstanding visual criteria and captured screenshots under `docs/art/review/`. Inspected the native 1280×720 board, 1920×1080 desktop framing and current gameplay capture. These are pipeline/layout evidence, not an approved art scene or a claim of fidelity to a protected game.
- **Actual verification:** lint, formatting, workspace typechecks and production browser build passed. Fresh full workspace tests passed 120 tests, followed by 24 passing client tests including one added effect-lifetime test: **121 distinct passing unit/integration tests**. All **9 Chromium Playwright tests passed** in one full run (1.9 minutes), preserving existing pose snapshots, DPR sizing, movement, multiplayer, combat, reconnect, ladder/menu behavior and exercising the new slot/calibration route. Final client typecheck passed; `git diff --check` passed.
- **Remaining / approval boundary:** original adventurer layers, Fern Frog, organic platform, four background planes, basic/skill effects, particle and UI panel exports with editable sources/provenance; populate and visually approve this single scene before expansion or Fernreach art replacement. Native asset size/framing, expression quality, authored animation, alpha treatment, painted parallax and combat effect readability cannot be signed off without those assets. Live rig/event mapping, authoritative equipment appearance and monster windup protocol remain follow-up integration work. Other engines, fractional display scaling and performance under richer assets were not verified.

## 2026-10-21 · Codex · Populated original-art direction candidate

- **Delivered the actual first scene** at `/art-validation`: one original lantern-keeper chibi adventurer, one Fern Frog, an organic grass/stone/root platform, botanical woodland/ruin background, separate transparent foreground and cinder-petal skill sequence. Generated only this six-texture review set through `image_gen`; no protected external art was supplied or extracted. Generation/edit history and raster SHA-256 hashes are recorded in `art/source/review/`. No expansion to other classes, creatures or maps occurred.
- **Preserved approval semantics:** added an explicit `candidate` source branch that default loaders reject. Only the isolated review scene opts in; `VALIDATION_ASSETS` remains empty. All art and UI labels identify the set as AI-assisted and awaiting visual approval. Live Fernreach, shared collision, authoritative combat and networking remain unchanged.
- **Composition and controls:** inspected approximately 96 px upright player height against the 800 px platform; Fern Frog is approximately 62 px including crown. Rendering uses independent background/foreground scroll factors, original PNG transparency and linear sampling for these illustrated high-resolution sources. Default guides are hidden; camera/facing/pan controls and collision guides remain available. Pause before selecting Attack/Skill holds a contact/cast sample; resume replays the selected action. The skill arc was shifted forward to reduce face obstruction.
- **Evidence:** `docs/art/review/candidate-1280x720.png`, `candidate-skill-1280x720.png`, `candidate-1920x1080.png`; all inspected. Updated `ART_DIRECTION.md` and rewrote `VISUAL_COMPARISON.md` around the actual populated scene, measured proportions, candid stylistic critique and concrete production sequence.
- **Actual gates:** all **122** unit/integration tests passed with cache bypassed (25 client, 39 server, 43 core, 5 content, 4 protocol, 4 API, 2 database). All **9 Chromium Playwright tests passed** in a full run (2.0 minutes), including the populated scene/paused skill, existing pixel baselines, desktop DPR checks, two-player combat/rewards/reconnect, movement and ladder/menu exit. Lint, format check, workspace typechecks and production browser build passed. Final metadata validation and documentation changes were checked separately; `git diff --check` passed.
- **Not final / next approval:** this is a silhouette/composition and limited pose-playback candidate, not production animation. Hair/face/clothing/weapon are currently flattened in the character sheet; some generated poses overlap cells and are excluded, frog uses an isolated idle drawing, and alpha/crop/motion cleanup remains. Full walk/jump/fall/hit/defeat sets, separated far/mid planes, modular terrain, editable layers, UI/fonts/icons and live event-to-clip integration are pending. Six texture files total approximately 11.8 MB; final asset budgets/load performance were not verified. Stop further asset production here until the user visually approves or revises this scene.

## 2026-10-21 · Codex · Make the art review accessible

- Rechecked the repeated correction request against the existing audit, specification and populated candidate. No approval was inferred and no additional assets were generated. Asked which view the feedback concerned, because `/` still uses temporary gameplay art while `/art-validation` contains the review candidate.
- Added a review link to the live-game caption and an expandable before/candidate comparison on `/art-validation`. Both captures are available at native 1280×720 resolution with descriptive image text and explicit temporary/candidate labels. Updated the comparison report's review instructions. No Phaser simulation, protocol or server code changed in this follow-up.
- Verified lint, formatting, workspace typechecks, production browser build and `git diff --check`. The updated Chromium review-page test passed (15.5 seconds), exercising the scene controls and checking that both comparison captures load at 1280 px. The unchanged gameplay/unit suites were not rerun for this presentation-only follow-up; their previous verified totals remain 122 unit/integration and 9 browser tests.
- The current candidate still needs visual approval or specific revisions before further art production. Final layer separation, animation coverage and edge cleanup remain outstanding.
