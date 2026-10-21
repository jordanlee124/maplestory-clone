# Visual comparison and replacement plan

2026-10-21 · **Populated first-scene candidate — awaiting visual approval**

Open `/art-validation` to review one original adventurer, one Fern Frog, an organic platform, a detailed background plate, a separately moving transparent foreground, and a cinder-petal skill sequence. The six AI-assisted textures are visual studies, not final production assets. Normal loaders still reject candidates; only this isolated scene opts in. The live game remains on its labeled temporary artwork.

## Actual browser captures

![Earlier temporary gameplay](review/legacy-gameplay-1280x720.png)

![First-scene candidate at 1280×720](review/candidate-1280x720.png)

![Paused skill study at 1280×720](review/candidate-skill-1280x720.png)

![Candidate at 1920×1080 desktop resolution](review/candidate-1920x1080.png)

The earlier `validation-slots-*.png` files document the initial empty measurement board. Current captures show actual imported PNG artwork in Phaser, not that board or a single composited mockup. Background, foreground, platform, player, monster and effect are separate runtime objects. No protected reference-game image or extracted asset is included.

## Comparison and critique

| Criterion             | Legacy gameplay                                                    | First-scene candidate / remaining review                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Character-to-screen   | 48 px drawing envelope, at most 6.7% of viewport height            | About 96 px upright visible height, 13.3% at camera 1; large eyes and hair read at actual 1280×720. This trial size is not a universal asset resolution rule                                                                                    |
| Character-to-platform | Narrow body against repetitive straight turf strips                | About 12% of the 800 px platform span; head and feet remain separated from roots/soil. Collision guide stays 24×48 rather than growing with artwork                                                                                             |
| Head/body             | Nominal half-height head but fixed face and rectangular silhouette | Dominant cream/apricot hair mass, large amber eyes, short teal body, rounded boots and small hands. Approximately 55–60% head/hair mass; not a measured proprietary-game ratio                                                                  |
| Monster               | Rectangle frog with offset poses                                   | Original rounded frog, enormous eyes, curled fern/dewdrop crown; about 62 px tall including fronds (8.6% of screen height). One isolated idle pose is used; attack/hit drawings still need separation                                           |
| Composition           | Triangle hills, empty sky, evenly repeated flowers                 | Atmospheric botanical ruins and stream, curving tree arches, seed lanterns, original terrain/roots. Independent foreground framing moves at 1.15 while the background moves at 0.12. Future far/mid planes still need separate authored exports |
| Platform              | Straight grass/soil tile band                                      | Uneven grass edge, flowers, mushrooms, embedded stone, roots and tapered ends; top aligned to review surface y=520. Modular caps/fills are not yet produced                                                                                     |
| Outline/shading       | Block rectangles and limited ramps                                 | Fine colored contours, material shading, cooler shadows and warm hair/seed accents. Candidate is painterly: whether it is too soft/detailed for the intended sprite aesthetic needs explicit review. Some alpha edges remain noisy              |
| Animation             | Few procedural poses                                               | Limited blink/attack/cast pose playback with explicit timing and pivots. This is not a polished walk/jump/hurt/defeat set. Some generated poses overlap atlas cells and are intentionally excluded                                              |
| Skill                 | A short rectangle/ring                                             | Six-stage soft-alpha teal/honey arc, independently sized/timed; moved 50 logical px forward to keep the face clearer. Review enemy visibility and cropped edges before approving the sequence                                                   |
| UI                    | Functional bars, monospace and uniform slots                       | Review labels/controls only; no new final HUD/icon/font art. UI replacement remains a separately scoped follow-up                                                                                                                               |

All values refer to this composition at the default camera zoom, not a permanent production sprite-size mandate. Player height uses an inspected 426-source-pixel upright drawing rendered at 96 logical pixels; Fern Frog uses an approximately 512-pixel source silhouette rendered at 62. The new drawings are independent designs, not rescaled versions of the old procedural sprites.

## How to review

The live game's temporary-art caption links directly to `/art-validation`. On that page, expand **Before / candidate comparison** to see the captured live placeholder game alongside the proposed scene. Each capture opens at its native 1280×720 size. These are review evidence, separate from the runtime art registry; neither the screenshots nor a repeated task request grant visual approval.

Use Idle, Attack and Skill, facing, camera zoom and parallax controls. Pause **before** choosing Attack or Skill to hold a deterministic contact/cast sample; unpausing replays the selected pose. Measurement guides expose the existing collision sizes. The scene does not connect to a game room or calculate combat outcomes.

Approve or revise the silhouette, face appeal, proportions, palette, scenery composition and overall rendering treatment first. Do not infer approval from passing tests. The first-scene scope is complete enough for direction review; production cleanup and animation coverage are outstanding.

## Replacement sequence after this review

1. Obtain visual approval or specific revisions for this single scene. No additional class, monster, equipment family or map asset production before that decision.
2. Clean selected alpha edges, overlapping/clipped pose exports and pivots. Separate the approved character design into body, rear/front hair, face, outfit, weapon and accessory layers; the renderer already supports independent layer clips and attachments.
3. Produce the missing walk/jump/fall/hit/defeat and monster action drawings for this same scene; replace draft timing/crops with reviewed motion. Finalize the skill's arc/contact/fade and effect obstruction budget.
4. Separate the environment's far/mid planes and modular terrain caps/fills without changing collision geometry; author the missing UI panel/icon/font assets when that design scope is approved.
5. Record explicit reviewer/date/source/usage approval in `VALIDATION_ASSETS`, then integrate the approved renderer and scenery into Fernreach gameplay. Adapt authoritative event-to-clip mapping and rerun movement/combat/multiplayer tests.
6. Expand to other classes, equipment, monsters and maps only within the approved design language.

Source history and selected-raster hashes: `art/source/review/PROVENANCE.md` and `assets.json`. No layered authoring source or human art approval is implied by generated raster masters. See `ART_DIRECTION.md` for the full production contract and `docs/milestones/PROGRESS.md` for actual verification results.

## Verified results

All 122 unit/integration tests passed with Turbo cache bypassed (25 client tests). Lint, formatting, workspace typechecks and the production browser build passed. All 9 Chromium Playwright tests passed in one full run (2.0 minutes), including imported review assets, a paused skill capture, approval status, existing art baselines, DPR sizing, movement, multiplayer combat/rewards/reconnect and ladder/menu exit. Both desktop captures and the skill frame were visually inspected. Final source validation was tightened to require review provenance/date as well as production approval fields, then the client tests and typecheck were rerun.

Not verified: final animation quality, separate production character layers, approved final PNG imports into live gameplay, other browsers, fractional OS scaling or load/performance with a complete art set. The scene contains six review textures totalling approximately 11.8 MB; optimize after visual direction approval rather than claiming a production streaming budget from this prototype.
