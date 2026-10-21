# Architecture Decisions

Short ADRs. Add new entries at the bottom: context, decision, consequences.

## ADR-001: Just-in-time internal packages (2026-10-20)

Internal packages export `src/*.ts` directly. Next transpiles them (`transpilePackages`), servers run under `tsx`, and Vitest handles TS natively.
**Why:** no build ordering, instant cross-package edits. **Cost:** servers need `tsx` at runtime.
`// shortcut:` bundle servers with esbuild before production deployment.

## ADR-002: Server-authoritative movement via input replay (2026-10-20)

Clients send one input per fixed 1/60 s step and the server runs the same deterministic `game-core` `stepBody`. We chose this over clients sending positions plus server bounds checks, because it makes speed hacks and teleports impossible by construction and gives exact client reconciliation.
Throughput is capped by **wall-clock step credits** (max 10 banked). We measured Node timers firing at ~48 Hz on Windows, so tick-count credits made the server fall behind.
We didn't use Colyseus 0.18's built-in `defineInput`/`setFixedTimestep` pipeline. It's new and requires Schema-class inputs, while the explicit queue is ~20 lines and easy to reason about. Revisit if we need lag compensation or rewind.

## ADR-003: Separate API (Fastify) and game server (Colyseus) processes (2026-10-20)

HTTP account and character flows don't belong on the realtime server. Both share Postgres and a JWT (HS256, `JWT_SECRET`) defined once in `@cindervale/protocol/token`.

## ADR-004: PGlite for tests and Docker-less development (2026-10-20)

`@electric-sql/pglite-socket` serves embedded Postgres over the wire protocol, so the apps always use plain `pg`, with one driver path. Tests need no Docker or CI service container. Production and Docker dev use real Postgres 17.

## ADR-005: Colyseus 0.18 split packages (2026-10-20)

We use `@colyseus/core` + `@colyseus/ws-transport` + `@colyseus/schema` rather than the `colyseus` meta-package, which pulls in Redis drivers and a monitor we don't need yet. Client: `@colyseus/sdk`.

## ADR-006: Phaser 3, not 4 (2026-10-20)

Phaser 4 is npm `latest`, but the project spec requires Phaser 3. Pinned `phaser@~3.90`. Revisit as a deliberate migration.

## ADR-007: TypeScript 6.0, not 7 (2026-10-20)

`typescript-eslint` supports TS `<6.1`. Upgrade when it supports TS 7.

## ADR-008: One room per map, Fernreach Fields as start map (2026-10-20)

Rooms are matched with `filterBy(['mapId'])`. The client sends its character's `mapId`, and the server validates it against the saved character. New characters start in Fernreach Fields (the beginner region); existing Cindervale Town characters stay in town until portals exist.
Channels (several rooms per map) come later as another `filterBy` key.

## ADR-009: Procedural placeholder art (2026-10-20)

Placeholder sprites and tiles are drawn in code at load time (`game-client/src/art/`), at native resolution, behind stable texture keys and frame names (`adventurer-<class>`, `idle0…climb1`). Real sprite sheets in `/assets` replace them without touching scene code.

## ADR-010: Idempotent rewards via a ledger table (2026-10-20)

Each EXP/loot grant inserts a unique key into `granted_rewards` (`exp:<monsterLifeId>:<characterId>`, `drop:<dropId>`) **in the same transaction** as the reward, with `ON CONFLICT DO NOTHING`. A replayed, raced, or duplicated grant is a no-op, even across processes. The character row is locked (`FOR UPDATE`) so concurrent grants to one character apply in sequence. A pickup also claims the drop in memory before awaiting the database, so two pickups in flight can't both pass validation. Loot is all-or-nothing: if it doesn't fit, the transaction rolls back (including the ledger key) and the drop is restored.
`// shortcut:` the ledger grows without bound; prune keys older than a day once volume matters.

## ADR-011: Combat rules split pure / server (2026-10-20)

Formulas, leveling, hitboxes, drop rolls and the monster AI state machine are pure functions in `game-core`, with injected `now` and `rng`, so they're unit-tested deterministically. Validation and resolution that mutate session state are in `game-server/src/combat.ts`, with no IO. `map-room.ts` only wires messages, ticks and persistence. Balance numbers live only in `content`.

## ADR-012: Pixel-art sheet contracts and integer display scaling (2026-10-21)

Actor and equipment sheets use untrimmed 64×64 cells with bottom-centre anchors. Existing native drawings are padded, not resized; authoritative hurt boxes and all physics/combat rules stay in shared core/content. A typed art manifest records frame aliases, clip timing, origins, review bounds, status and explicit PNG approval/provenance. Approved files are loaded through one registry; procedural fallbacks are generated only for entries marked placeholder. Missing equipment stays absent, and bad approved imports fail validation rather than silently replacing art with placeholders.

Phaser keeps a logical 1280×720 canvas and camera zoom 1, nearest texture filtering, and integer CSS display zoom through `Scale.NONE`. Widths between scale steps are letterboxed; small hosts scroll rather than fractionally shrinking. This preserves pixel geometry at the cost of unused horizontal space and possible vertical scrolling. The separate `/art-preview` client-only route and entrypoint provide pose/rig calibration and pixel-only visual baselines; QA markers never enter live gameplay. See `docs/art/PIXEL_ART_GUIDE.md` for the audit, proposed visual direction, missing approved assets and import contract.

## ADR-013: Mixed visual layers and an approval-gated reference scene (2026-10-21)

The maintainer changed the target from a restricted retro pixel-art contract to the visual richness of modern illustrated 2D RPGs, with original IP. ADR-012 remains the legacy placeholder contract; its universal cell size/filter and fixed camera limitations do not constrain new production art. `ART_DIRECTION.md` defines proportion/composition trials before asset dimensions are chosen.

New approved assets use variable atlas rectangles, pixel pivots and body attachment anchors, unequal animation timing, independent face/accessory clocks and action-specific depth. Filtering is selected per texture. An opt-in mixed-filter renderer configuration preserves existing gameplay defaults; camera zoom is configurable with unchanged logical physics coordinates. The isolated `ArtValidationScene` loads only recorded approved art and includes separate world/UI cameras, parallax, bounded particles and finite effect playback. No network or collision authority moves into this layer.

There are no approved production exports. `/art-validation` therefore shows labeled measurement guides and exact missing slots, never fabricated final art. Populate and visually approve this one scene before expanding production or replacing Fernreach gameplay art. The legacy renderer remains active until approved clips and scenery can be integrated and tested. See `docs/art/VISUAL_COMPARISON.md` for evidence and delivery gates.

The subsequent explicit request to complete a populated visual test authorizes original candidate generation for this scene. Six AI-assisted review textures now populate it under a separate `candidate` source status. Default loaders continue rejecting candidates; only `ArtValidationScene` opts in. No production approval is fabricated, no protected reference assets are imported, and live Fernreach remains on its legacy artwork until visual sign-off and production cleanup. Pose playback is a limited study, with flattened character layers and incomplete action sets disclosed in the comparison report.
