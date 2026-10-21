# Asset pipeline

The production direction is [ART_DIRECTION.md](ART_DIRECTION.md). Keep the existing directories; do not create a second asset tree.

| Location                                           | Purpose                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `art/source/review/`                               | Generation history, selected-raster hashes and review status. Native layered authoring files should live under `art/source/` when supplied. |
| `apps/web/public/assets/review/`                   | Versioned original PNG studies; public URLs do not imply approval.                                                                          |
| `packages/game-client/src/visuals/reviewAssets.ts` | Original six-study source descriptors.                                                                                                      |
| `visuals/validationCandidates.ts`                  | Twig/HUD source review history; explicit promotion lives in approvedAssets.                                                                 |
| `visuals/approvedAssets.ts`                        | Explicit eight-key approval whitelist and namespaced live descriptors.                                                                      |
| `visuals/model.ts`, `renderer.ts`                  | Typed atlas metadata, validation, loading, frame sampling, layers and finite effects.                                                       |
| `art/manifest.ts`, `pipeline.ts`                   | Legacy placeholder contract; preserved for unfinished content and regression baselines.                                                     |

## Export and import

1. Author original designs against the approved proportion/composition guide. Preserve the previous raster; export a new `subject-variant-vNN.png`, using lowercase kebab-case and a two-digit version. Do not silently replace an approved file's bytes. Separate layer exports use names such as `adventurer-hair-front-walk-v02.png`.
2. Export RGBA PNGs, retaining transparent margins needed for moving weapons/hair. Verify actual alpha, source dimensions and every frame boundary. A packed sheet is described directly by frame rectangles in the existing TypeScript manifest; no new atlas parser or universal cell size is needed. External JSON exports must be translated and reviewed against this contract before import.
3. Record the source/generation ID, brief, usage provenance and SHA-256 in `art/source/review/`. Generated raster studies are not layered authoring sources or finished animation.
4. Supply `VisualAsset`: stable key, versioned URL, actual sheet size, per-texture filter, named rectangles, per-frame pixel pivots/anchors, named clips with unequal millisecond durations, and either candidate or explicit approval metadata. Validation rejects missing provenance, invalid rectangles, path traversal and invalid clips.
5. Add new candidates only to the review registry. Inspect `/art-validation` with guides, facing, paused poses, zoom and parallax. Approval of the existing eight textures does not approve subsequent assets. Promote selected designs explicitly after review; retain candidate history.
6. Integrate approved descriptors through map-scoped `PreloadScene` loading. Live keys use `approved-` to avoid collisions with legacy atlas keys. Preserve shared collision geometry and command/event authority.

## Loading, fallbacks and texture lifetime

`queueVisuals` takes the selected asset list, validates approval, rejects duplicate keys and skips textures already present in the same Phaser game. Fernreach loads its eight approved PNGs on entry; other maps do not fetch them. The web dynamically imports Phaser when the relevant view opens. Do not prefetch every map/equipment family at login.

`registerVisuals` checks real PNG dimensions, registers trimmed rectangles and selects each texture's sampling mode. Mandatory live imports fail visibly through `world-load-error`, clean up the game/room and never silently substitute primitive artwork. The isolated review scene explicitly allows failed PNGs to become labeled missing slots; its unavailable pose control is disabled. Existing legacy art remains a clearly disclosed fallback for unfinished species/maps, not a replacement for a broken approved file.

Each view owns one Phaser game. Teardown destroys actors, listeners, effects and that game's texture manager; textures are not retained in a global cache. When persistent in-game map switching or many equipped variants arrive, add measured per-map reference counting/eviction rather than retaining every atlas indefinitely. Current PNGs are unoptimized studies; no streaming/memory budget is certified yet.

## Layer contract

The root body supplies feet pivots and head/hand anchors. Pose-following body/face/eyes/hair/outfit/equipment/weapon/accessory exports share normalized action time, allowing different frame counts and clip durations; independent blink/sway clips retain their own clocks across action changes. `ActorLayer.depth` and each `actionDepth` value accept a number or `{ left, right }`. Origins, anchors and scale mirror around the same feet root. Skill effects use their own finite timeline and texture filtering. Both local and remote players use `Avatar` and the same renderer. See [CHARACTER_ASSETS.md](CHARACTER_ASSETS.md) for appearance slots, offsets, overlap rules, preview controls and missing artwork.

The approved adventurer PNG is still flattened. Do not claim its equipment is independently animated until clean matching layer exports and authoritative appearance IDs are supplied.

## Review access and captures

`/art-validation` is enabled during `pnpm dev`. Production returns 404 unless the server explicitly sets `ART_VALIDATION_ENABLED=true`; it uses a client-only loader so Phaser never executes in server rendering. Preview HP/MP/EXP values are labeled samples and never enter gameplay state. Public PNG URLs are still public; the route gate is not an access-control mechanism.

Run `pnpm test:e2e` for browser checks. Optional `E2E_WEB_PORT`, `E2E_API_PORT`, `E2E_GAME_PORT` isolate the test stack from your app. Dev tests use `.next-e2e/` and `CINDERVALE_E2E_DEV=true` internally so they do not share your dev server's lock/cache; production tests use the normal production build. When testing a production build on alternate ports, compile with matching `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_GAME_URL` because Next.js embeds these endpoints at build time. See [ASSET_CHECKLIST.md](ASSET_CHECKLIST.md) for remaining production work.
