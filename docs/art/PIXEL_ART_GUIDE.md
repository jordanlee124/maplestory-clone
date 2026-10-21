# Cindervale pixel-art foundation

> Historical Phase 1.5 placeholder contract. New production direction is defined in [ART_DIRECTION.md](ART_DIRECTION.md). Its variable frame bounds, independent layers and per-texture filtering supersede the 64×64 grid, palette cap and universal nearest-filter requirements below for new art. Existing placeholder code/baselines retain this contract during the transition.

2026-10-21 · Phase 1.5 · Direction proposed for art review; no final art is approved.

## Direction

Warm woodland adventure with mineral ruins, ember lanterns, fern silhouettes and dew-lit crystals. Aim for expressive, readable chibi adventurers and tactile materials at native size. Side-on platform gameplay and layered equipment are genre references; character silhouettes, clothing, creatures, props, symbols and animation drawings must be original. Do not trace, recolor, extract, or train the production pipeline around MapleStory assets.

Use the following constraints for new submissions. These are production specifications, not approval of the current procedural drawings. Review at native size against light and dark backgrounds before adding detail.

| Property                          | Standard                                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Logical game viewport             | 1280×720; camera zoom 1; world units remain logical pixels                                                                 |
| Character/monster/equipment cells | Untrimmed 64×64 RGBA PNG; transparent background; no rotation, packing, spacing or extrusion                               |
| Character visible size            | About 32 px wide, 48 px tall; keep the existing feet position and collision silhouette                                     |
| Terrain                           | 32×32 tiles; 16 px increments for small props; walkable surface exactly on the tile's top edge                             |
| Actor origin                      | `(0.5,1)`, pixel anchor `(32,64)` in every pose and layer; face right; mirror the complete rig for left                    |
| Outline                           | One native pixel, dark colored ink, consistent clusters; reserve stronger contrast for interactive actors                  |
| Shading                           | Upper-left light; base + cool shadow + warm highlight, usually three tones per material; no pillow shading                 |
| Edges                             | No automatic anti-aliasing, blur, gradients, photographic texture, soft drop shadows or fractional transforms              |
| Palette budget                    | Shared 24-color starting palette below; typically ≤16 opaque colors per actor/layer; no dithering on faces or small actors |
| Readability                       | Closed, identifiable silhouette; distinct creature shapes; equipment must not obscure eyes, feet or attack poses           |
| FX/UI                             | Brief local accents; keep enemy locations and telegraph space clear. Bitmap font and pixel UI assets are still missing     |

### Starting palette

| Role             | Colors                                  |
| ---------------- | --------------------------------------- |
| Ink              | `#2b2438`                               |
| Stone            | `#4b4661` `#77708a` `#aba3b5`           |
| Cinders          | `#7b3e37` `#c56b48` `#f2ae65`           |
| Ferns            | `#254c43` `#46794f` `#78ad64` `#bfd58b` |
| Earth            | `#493d38` `#795b46` `#b18a62`           |
| Sky              | `#547b9a` `#8db3c4` `#d7e5d3`           |
| Skin             | `#9b6155` `#d49a7a` `#f1c8a0`           |
| Cloth            | `#4a5781` `#8192b2`                     |
| Rune / highlight | `#9c8ec9` `#fff1cd`                     |

Use cinder accents for Ember Knight, fern accents for Gale Ranger, cloth/rune accents for Runewaver, and ink/fern accents for Thornblade. Color must reinforce distinct equipment silhouettes rather than being the only class cue. Existing placeholder palettes have not been recolored or represented as compliant final assets.

## Audit and missing submissions

No production PNG, atlas, Aseprite source or approved art submission existed at the audit. All 16 loaded entries in `packages/game-client/src/art/manifest.ts` remain `placeholder`; five equipment slot specifications are `missing`. No final assets were substituted in Fernreach because none were supplied or approved.

| Area           | Existing asset / implementation                                                                  | Required submission                                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Players        | Four procedurally drawn class palettes; 18 poses each; starter clothing and hair baked into body | Original clean base rig plus class outfits/hair. Preserve native visible size. Final body must permit clothing replacement rather than merely covering baked clothing                                             |
| Twig Creature  | Seven procedural poses, native 28×32 ink area                                                    | Original twig/leaf silhouette, clear contact feet, seven required poses below                                                                                                                                     |
| Fern Frog      | Seven procedural poses, native 32×28 ink area                                                    | Original frog/fern silhouette, compact body and readable attack pose                                                                                                                                              |
| Crystal Beetle | Seven procedural poses, native 40×30 ink area                                                    | Original beetle/crystal silhouette; retain the authoritative hurt box                                                                                                                                             |
| Terrain        | `tile-grass` and `tile-dirt`, 32×32                                                              | Seamless Fernreach ground/soil; test adjoining edges and partial platform widths                                                                                                                                  |
| Ladder         | `ladder`, 16×16 repeated vertically                                                              | Rails/rung segment; visual center must stay on the content ladder's x coordinate                                                                                                                                  |
| Backdrop       | `bg-hills-far` 512×256; `bg-hills-near` 512×200; `cloud` 64×24                                   | Two seamless, tint-compatible woodland layers and a cloud; quiet contrast behind actors. Current renderer multiplies hill colors by map theme tints                                                               |
| Decor          | Two 7×11 flowers and one 8×8 grass tuft                                                          | Original low-contrast Fernreach ground decor, bottom-centre anchor; keep current dimensions for direct replacement                                                                                                |
| Equipment      | No shipping art; cape, rear weapon, outfit, headgear, front weapon specified                     | Matching 18-pose transparent sheets for each slot/item; both weapon parts when it crosses the body                                                                                                                |
| Loot           | Colored rectangles                                                                               | Currency 16×16 and item/potion icons 24×24, with clear ownership/availability treatment supplied separately by UI                                                                                                 |
| HUD/menu       | Phaser text, rectangles and bars; React buttons/settings                                         | Pixel panel borders (32×32 with documented 4 px corners), 48×48 slot frames, 24×24 skill/potion icons, bars and a licensed/original bitmap font. Current text is rasterized monospace, not final pixel typography |
| Combat FX      | Rotated rectangles, circles, alpha tweens and floating text                                      | Original 64×64 transparent FX frames for hit, crit, defeat, respawn and each class skill. Circles/rotated shapes are explicitly temporary; no new FX art was invented here                                        |

Fernreach needs Twig Creature and Fern Frog art; Crystal Beetle belongs to Duskmire but shares the same sheet contract. Boss art/telegraphs are not supplied. Art approval must include identity, source/provenance, usage license, reviewer and date. Generated screenshots and calibration markers are engineering fixtures and confer no art approval.

## Sheet metadata and animation contract

The typed manifest is the runtime source of truth. Each sheet declares `key`, `status`, `kind`, `cell`, `columns`, `frames`, `clips`, `origin`, and, where applicable, `hurtbox` or equipment `slot`. Rows are inferred from frame count and columns; all cells must be present, including transparent unused cells in the last row. The loader checks actual PNG dimensions and rejects missing frames, clips, invalid timing, duplicate keys and incompatible rigs. Approved art never silently falls back when loading fails.

Current placeholder character sheets use 18 columns (1152×64); a production export can use six columns and three rows (384×192) by changing `columns: 6`. Frame names and order stay as below. The existing art is padded at `(16,16)` inside each 64×64 cell; it is not enlarged.

| Clip         | Ordered frames            | Timing / playback                                                                  |
| ------------ | ------------------------- | ---------------------------------------------------------------------------------- |
| Idle         | `idle0 idle1`             | 500 ms each, loop; subtle breathing, feet planted                                  |
| Walk         | `walk0 walk1 walk2 walk3` | 100 ms each, loop; contact/passing/contact/passing, no foot skating                |
| Jump / fall  | `jump` / `fall`           | Hold the pose while the physics state applies                                      |
| Climb        | `climb0 climb1`           | 6 fps; pause when stationary; rear-facing pose                                     |
| Basic attack | `attack0 attack1 attack2` | 90 ms startup, 100 ms active, 160 ms recovery                                      |
| Skill attack | `skill0 skill1 skill2`    | Same presentation windows; distinct anticipation/contact/recovery silhouette       |
| Hit          | `hit`                     | 240 ms actor reaction; current tint flash is shorter                               |
| Death        | `death`                   | Hold until authoritative respawn; retain the feet anchor even for a collapsed pose |

Monster sheets currently use seven columns (448×64), in order `idle0 idle1 move0 move1 attack hit defeat`. Idle/move use 220 ms per frame; attack 240 ms, hit 180 ms, defeat 280 ms. Respawn is currently a procedural effect, not an extra monster pose. New art may improve drawings within this contract; increasing pose counts needs a deliberate manifest/renderer update and new visual baselines.

Attack windows are presentation only. The server still validates commands and resolves damage immediately. Monster v3 messages do not provide attack windups or misses; accurately synchronized telegraphs require a shared protocol/server extension, not guessed client timing.

### Collision and alignment

| Actor          | Authoritative hurt box      | Bounds within the 64×64 cell |
| -------------- | --------------------------- | ---------------------------- |
| Player         | 24×48 (`game-core/PHYSICS`) | x 20–44, y 16–64             |
| Twig Creature  | 28×32 (`content/MONSTERS`)  | x 18–46, y 32–64             |
| Fern Frog      | 32×28                       | x 16–48, y 36–64             |
| Crystal Beetle | 40×30                       | x 12–52, y 34–64             |

Metadata copies these bounds for review; it does not set physics or attack ranges. No collision, movement, combat, reward or network rule changed in this phase. Keep primary monster ink within the current visible bounds so name/HP indicators stay clear. If a later design needs larger bodies, first review art bounds/nameplate placement; change actual hurt boxes only in shared content/core with server tests.

### Equipment layers

Use `avatar.equipment.set(['<loaded-equipment-key>', ...])`. Allowed slots, rear to front: cape, rear weapon, body, outfit, headgear, front weapon. Only one sheet per slot; every layer must share all 18 frame aliases, 64×64 cells and the feet origin. Empty pixels carry the pose alignment; do not crop a hat or weapon into a different frame size. Use an external FX sprite for attacks larger than the rig.

The base sprite selects the frame; overlays copy it each update, including position, facing, scale, rotation, alpha, visibility and hit tint. Layers do not run independent animation clocks. Missing/incompatible/unloaded equipment is rejected before removing existing layers. Existing bodies still contain baked clothing, and there is no server equipment appearance state or equip UI yet; final clean bases and authoritative equipped-item data are required for a complete equipment feature. The pipeline supplies rendering, not ownership, stats or item grants.

## Files, naming and approval

```text
art/source/                              # original editable work + license/provenance
  characters/<rig>/<item>-v01.aseprite
  monsters/<monster>/<monster>-v01.aseprite
  maps/fernreach/<asset>-v01.aseprite
  ui/<asset>-v01.aseprite
apps/web/public/assets/                  # approved, exported PNG only
  characters/<rig>/<item>-v01.png
  equipment/<slot>/<item>-v01.png
  monsters/<monster>-v01.png
  maps/fernreach/<asset>-v01.png
  ui/<asset>-v01.png
packages/game-client/src/art/manifest.ts  # stable keys, file URLs, approvals and sheet metadata
e2e/snapshots/art.spec.ts/                # pixel-only regression PNGs; not production art
```

Use lowercase kebab-case keys and names; keep content IDs stable. Revision filenames can change while texture keys remain `adventurer-<class>`, `twig-creature`, etc. Export native RGBA PNG, without interpolation or atlas trimming. Authoring sources may contain additional sketch layers; exported gameplay layers must have identical canvas/grid geometry.

To install a reviewed replacement, put its export under `/assets/`, change that manifest entry to `status: 'approved'`, add `url` and `approval: { by, date, license, provenance }`, and retain its rig/clip/origin contract. `queueAssets` loads approved files in `preload`; `prepareAssets` generates only entries still marked placeholder, then validates dimensions and registers named frames and clips once. Entries marked missing stay absent. Replacement art with different world behavior requires separate review; an art import cannot grant itself a new hurt box.

## Rendering and verification

Phaser uses nearest texture filtering, antialiasing off, rounded pixels, fixed camera zoom 1, and `Scale.NONE` with integer CSS display zoom. The largest whole scale fitting the host width is chosen: 1280/1366/1920 → 1×, 2560 → 2×, 3840 → 3×. Unused horizontal space is letterboxed; the document can scroll vertically. Hosts below 1280 scroll horizontally. The logical canvas stays 1280×720, so gameplay and HUD coordinates do not change. `autoRound` alone is not an integer FIT policy.

Open `/art-preview` for all current poses, palettes, terrain samples and separately labeled QA equipment alignment markers. It uses the same asset registry and display setup as gameplay, without connecting to a room. Markers are generated only on that review board; they are not shipping equipment.

`e2e/art.spec.ts` compares character/monster pixels against reviewed engineering baselines, checks layer frame/facing/tint/depth synchronization, and checks canvas dimensions/filtering at supported desktop widths with DPR 1 and 2, at 100% browser zoom. Font labels, animation clocks and network state are excluded from pixel snapshots. Fractional OS/browser scaling is not covered by those checks. The existing movement/combat/multiplayer tests remain mandatory.

Browser scenarios run serially because they share an authoritative map and software-rendered canvases. The two clients within the multiplayer scenario still fight concurrently. Combat regression testing also found that command facing had depended on a sprite temporarily locked by hit/attack animation; local movement now retains command facing separately from that visual pose, with a unit regression test. Damage and attack validation remain server-owned.

Run `pnpm test:e2e` for regression checks. To intentionally change an art baseline, run `pnpm exec playwright test e2e/art.spec.ts --update-snapshots`, inspect both PNGs and the review board, and review the art approval independently. Never rebaseline just to hide a rendering regression. Run client unit tests, lint, format, typecheck and production build before shipping an asset/pipeline change.
