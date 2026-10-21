# Cindervale Online — art direction

2026-10-21 · Revised direction · **First-scene candidate available; awaiting visual approval**

The representative scene is now populated at `/art-validation` with six original AI-assisted review textures: an adventurer pose study, Fern Frog, organic platform, background plate, transparent foreground and skill sequence. These are candidates, not final or approved art. See `VISUAL_COMPARISON.md` for actual captures and critique, and `art/source/review/PROVENANCE.md` for source history. Live gameplay has not adopted this unapproved set.

This document supersedes the visual constraints in `PIXEL_ART_GUIDE.md` for new production artwork. The older manifest remains the contract for existing temporary drawings. The target is the richness of a modern illustrated 2D online RPG: expressive chibi actors, layered costumes, authored animation, organic scenery and luminous combat effects. It is not a generic retro aesthetic. Increasing the resolution of the current drawings will not meet this target.

MapleStory is a presentation reference only. Do not copy, extract, trace, recolor or redistribute its protected assets, maps, characters, UI, logos, animations or effects. The numbers below are Cindervale review proposals, not measurements of that game's proprietary sprites. No fidelity match is claimed.

## Audit: what prevents the target today

| Area / source                                  | Current behavior                                                                                                                                                                   | Consequence / correction                                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `art/adventurer.ts`                            | Rectangle-based 32×48 drawing padded into 64×64 cells. Head occupies roughly the upper half; fixed face, hair and clothing baked together. Class identity largely a tunic recolor. | Already nominally chibi, but facial expression, hair masses, clothing volume and silhouette lack authored detail. Redesign these shapes instead of enlarging pixels. |
| `art/monsters.ts`                              | Seven poses assembled from rectangles at hurtbox size; movement mostly a two-pixel lift; defeat a flattened strip.                                                                 | Species identity and acting are weak. Fern Frog needs a rounded squat body, oversized eyes, fern crown and articulated squash/anticipation/recovery.                 |
| `art/textures.ts`, `world/MapRenderer.ts`      | Repeated straight 32 px turf strips; tiled brown soil; geometric hills; repeated flowers; two tinted parallax planes.                                                              | Little variation in silhouette, material, atmosphere or local storytelling. Build authored platform caps/fills/roots and an original botanical woodland composition. |
| `ui/CombatHud.ts`, web UI                      | Monospace text, solid rectangles and uniform bars. No illustrated icons, borders, font or state art.                                                                               | Functional density without a coherent visual identity. Separate readable information structure from ornamental framing.                                              |
| `combat/effects.ts`                            | Rotated bars, circles, alpha tweens and floating text.                                                                                                                             | Lacks authored arc shapes, secondary motion, controlled glow and multi-frame contact accents. These remain temporary.                                                |
| `art/manifest.ts`, `player/EquipmentLayers.ts` | Canonical 64×64 cells, one pose clock, five overlay slots; all overlays copy the body frame.                                                                                       | Good alignment baseline, unsuitable as a universal production rig. Face, hair, accessories and FX need independent dimensions/timing and attachment anchors.         |
| `pixelGame.ts`, `art/pipeline.ts`              | 1280×720 logical canvas, camera 1, integer CSS display zoom, all legacy textures nearest, antialiasing disabled.                                                                   | Stable existing pixel geometry, but painted scenery/soft FX need explicit per-texture filtering. Camera framing must be reviewed with real silhouettes.              |

There are **zero approved production PNGs**, 16 loaded legacy placeholder assets, and five missing legacy equipment specifications. The approved validation registry stays empty; the isolated scene explicitly opts in to six separate review candidates. No generated shape, calibration marker, screenshot or concept becomes approved by passing tests.

## Character proportions and screen tests

Start from a head-plus-body silhouette around **1.8–2.1 heads tall** including hair, short torso, short separated legs, broad readable boots and small rounded hands. The hair/head mass should dominate, while the lower body remains identifiable during attacks. Use three large readable hair masses before small strands. Do not hide both eyes behind bangs. Use asymmetry in the original hair/outfit design rather than relying on class colors.

Place the eye line approximately 55–65% down the visible face (excluding hair). Large paired eyes, a small mouth below, subtle cheek accents and a clear brow line should read at gameplay scale. Supply neutral, blink, focused attack, hurt and defeated expressions. Eyes must align to a head anchor through turns and body squash; do not animate face position independently of the head.

The test board offers **64 / 80 / 96 logical-pixel silhouette-height guides**, not mandatory sheet sizes. At camera 1 these occupy 8.9 / 11.1 / 13.3% of a 720 px viewport; at camera 1.25 they occupy 11.1 / 13.9 / 16.7%. These are geometric estimates, not approvals. Import the same original silhouette at its authored native size, compare camera 0.75 / 1 / 1.25 / 1.5 at 1280×720 and 1920×1080, then choose a size based on expression readability, nearby enemy visibility and available jump space. Do not resample old artwork to simulate the test. The logical viewport stays 1280×720 during this comparison; desktop letterboxing is intentional.

Select the artboard and export resolution **after** silhouette approval. Use whatever native bounds enclose the authored poses, weapons and hair without clipping. Frame packing and variable trimmed rectangles are allowed when pivots/anchors are preserved. Backgrounds and effects are not constrained to the actor pixel grid.

## Layered actor contract

`visuals/model.ts` describes each approved PNG, atlas dimensions, named frame rectangles, per-frame pixel pivots, optional attachment anchors, clips with explicit durations, filter choice and provenance. `visuals/renderer.ts` loads/registers these independently of the legacy 64×64 manifest. No new dependency or server schema is needed.

| Layer                          | Attachment / behavior                                         | Typical relative depth |
| ------------------------------ | ------------------------------------------------------------- | ---------------------- |
| Rear hair / cape / rear weapon | Head or feet anchor; pose-matched drawing                     | -3 to -1               |
| Clean body                     | Feet pivot; supplies `head` and `hand` anchors per body frame | 0                      |
| Outfit / boots / gloves        | Feet pivot; pose-matched cut and folds                        | 1                      |
| Face                           | Head anchor; independent expression/blink clip                | 2                      |
| Front hair / headwear          | Head anchor; pose-matched silhouette                          | 3                      |
| Front weapon                   | Hand anchor; action-specific rear/front depth allowed         | 4                      |
| Accessories                    | Head/hand anchor or feet; independent sway loop allowed       | 5                      |

The validation adventurer uses body, rear/front hair, outfit, face, weapon and accessory slots. Additional equipment uses the same `ActorLayer` contract rather than inventing another rig. Every pose-following layer must supply every body action used by the scene. Independent clips such as `blink` and `sway` use their own clock and frame count. Body-driven expression switching is a future content mapping, not inferred automatically.

Frame pivots may lie outside trimmed bounds. Anchors are pixel positions in the corresponding body frame; the runtime subtracts the body pivot, mirrors around the root when facing left, and applies visual scale. A frame's mirrored origin must also mirror its pivot. Feet never drift because an image was cropped differently. Weapon parts that cross the torso require separately authored rear/front layers or per-action depth changes. Do not derive ownership, stats or equipment permissions from rendered layers.

## Outlines, color and shading

Use a dark colored contour, usually about one logical pixel on small actors, with selective thickness at overlaps. Avoid a heavy uniform black sticker outline. Keep eyes, fingers and weapon grips crisp. Hair has large highlight groups and cool shadow masses; cloth has folds that explain volume; metal and crystal use material-specific highlights. Use warm light against cooler shadows and a restrained saturation hierarchy: actors/contact effects strongest, walkable surface next, distant scenery softest.

There is no universal 16-color or 24-color cap. Develop linked material ramps for skin, hair, cloth, fern, bark, stone and ember accents; remove noise rather than banning needed colors. Do not add dithering to faces. Soft atmospheric gradients, translucent glows and painted edge transitions are permitted on scenery and effects. Pixel-clean actor exports use `nearest`; painted backdrops, glows and soft particles generally use `linear`. A texture has one filter policy, so assets requiring different filtering must be separate textures. Review alpha fringes against both light and dark backgrounds.

## Fern Frog

Original squat pear-shaped body, broad rounded foot contact, large eye masses and a distinct fern crown. Use a mint/olive body, warm pale underside and darker shaded limbs; crown should read as fern fronds rather than a generic green square. Character expression comes from eye shape and a mouth that survives native-scale review. Test visible-height proposals of 40 / 48 / 56 px against the chosen adventurer. Existing authoritative bounds remain **32×28**; visual foliage can extend beyond them, but the discrepancy must be inspected with collision guides enabled. Do not claim a larger visual body increases melee reach.

## Environment composition and platforms

Fernreach is a seed-lantern woodland around weathered botanical ruins: sweeping trunks, umbrella-like fern silhouettes, hanging seed bells, mossy stone and an atmospheric stream valley. Choose one dominant canopy/ruin silhouette per vista; use curved negative space to keep the combat lane open. Avoid geometric triangle hills, evenly spaced identical flowers, noisy wallpaper texture and saturated foreground walls that conceal enemies.

| Plane                      | Scroll factor proposal | Role / composition                                               |
| -------------------------- | ---------------------- | ---------------------------------------------------------------- |
| Sky and broad light        | 0                      | Quiet warm cream/mint light; no high-frequency texture           |
| Far botanical ruins / mist | 0.12                   | Low-contrast blue-green silhouettes; readable large forms        |
| Woodland midground         | 0.4                    | Curving trunks and canopy masses; varied gaps around actors      |
| Platform / interactables   | 1                      | Strongest surface readability, organic grassy edges, roots below |
| Foreground ferns           | 1.15                   | Edge framing; never continuously cover contact points            |

The validation platform surface is y=520 across x=240–1040. This is a composition guide, not a world collision change. Author rounded end caps, uneven turf tufts, exposed soil/stone masses and hanging roots. Separate caps, repeatable interior and occasional accents for the eventual full map. Grass may overlap the straight authoritative support surface, but the apparent landing line must remain clear. Ladders and ledges must retain their existing content positions. Build several distinct silhouettes before producing many decorative variants.

## Animation standards

Frame counts below are initial production bids, subject to motion review. The renderer supports unequal durations and independent layers; it does not require every layer to share a sprite cell or FPS. Avoid duplicated frames merely to increase counts.

| Action       | Initial bid / acting requirement                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idle         | 6–8 drawings over 1–1.6 s; subtle weight shift, small hair/accessory follow-through; feet planted; independent blink over 2.5–4 s                                    |
| Walk         | 8 drawings over 0.6–0.8 s; clear contact/down/passing/up, short lively stride, counter-swing and hair lag; test at actual movement speed                             |
| Jump / fall  | 3 rise and 3 fall drawings; anticipation/launch/apex and readable descent; switch from authoritative/predicted motion, never from guessed airtime                    |
| Basic attack | 6–8 drawings; anticipation/contact/follow-through. Fit existing 90 ms startup / 100 ms active / 160 ms recovery presentation windows without changing server cadence |
| Skill        | 8–12 body drawings plus separate FX sequence; distinct anticipation and recoverable silhouette                                                                       |
| Hurt         | 3–4 drawings over the existing 240 ms reaction; recoil expression and limited silhouette displacement                                                                |
| Defeat       | 6–8 drawings, then hold; readable collapse and hair/costume follow-through; never slide the feet pivot                                                               |
| Fern Frog    | Idle 6, movement 6–8, attack 6, hit 3, defeat 6; crown lags body squash; separate respawn FX                                                                         |

Current gameplay still uses its legacy pose controller and frame set. The richer renderer is exercised separately pending approved art; mapping these clips into live `Avatar`/`Monsters` is a later integration step after approval. Do not present the new counts as existing authored animation. Monster v3 messages provide landed attacks, not windups/misses, so accurately timed monster telegraphs require a future typed protocol/server extension.

## Combat effects and UI

Draw basic arcs, contact bursts and cinder-petal skill ribbons as original multi-frame sequences. FX use independent atlas dimensions, pivots, durations and filtering. Keep the initial skill mostly within about 1.5–2.5 chosen actor heights; inspect the actual footprint before locking dimensions. Separate rear aura (below actors), main directional arc (above actors), contact burst and sparse particles. Preserve the enemy silhouette and telegraph lane. Avoid full-screen white flashes and permanent bloom. Limit ambient emitters to 12 particles in the review scene; tune combat budgets using a later multiplayer performance capture.

The sample panel slot is 288×120 logical px at the upper right. Commission an original softly beveled bark/metal frame with restrained fern ornament, readable HP/MP/EXP regions and illustrated action icons. Text stays legible and information density stays compact; do not clone the reference game's panel geometry or iconography. Author source borders and icons separately for later nine-slice/layout work. The current validation slot renders a single approved composite panel when supplied; this does not replace the live HUD. Use an original or properly licensed readable font, and separate rendered text from decoration in production UI.

## Camera, collision and rendering

Logical game coordinates remain 1280×720. Camera zoom is configurable from 0.5–2 through `WorldHooks.cameraZoom`; default 1 preserves gameplay. The review board exposes 0.75/1/1.25/1.5 plus a parallax pan slider, fixed-camera review text and a separate world camera. Noninteger camera zoom intentionally trades exact actor pixel geometry for framing exploration; approve crispness at the selected zoom before shipping. CSS display scaling remains integer with letterboxing/scrolling, not arbitrary FIT.

The mixed-art factory option enables renderer antialiasing and lets each approved texture choose its filter. Legacy gameplay and `/art-preview` retain their current settings and baselines. `roundPixels` remains enabled; soft FX interpolate texture samples rather than being snapped to an actor's frame grid. Layered actors, finite animated effects and approved-texture ambient particles are independent presentation objects.

No physics, damage, rewards, HP, AI, collision bounds or network protocol changed. Player collision stays 24×48; monster bounds stay content-owned. Visual bounds and root pivots do not alter them. Live equipment appearance still needs authoritative equipped-item data and a UI. Relevant Phaser APIs: [texture filtering](https://docs.phaser.io/api-documentation/3.88.2/class/textures-texture), [camera zoom](https://docs.phaser.io/phaser/concepts/cameras); behavior also checked against installed Phaser 3.90 types/source.

## Exact first-scene asset slots and handoff

Use original editable production source in `art/source/validation/` and approved exports under `apps/web/public/assets/validation/`. The six first-scene studies instead live under `/assets/review/`, with `candidate` metadata in `visuals/reviewAssets.ts` and provenance/hashes under `art/source/review/`. Only the isolated scene may opt in to these candidates; the default loaders reject them. Record production approval in `visuals/validationAssets.ts` only after review: `key`, local PNG `url`, actual atlas `size`, filter, frame rectangles/pivots/anchors, clips with durations, and `approval {by,date,provenance,license}`. Approval identifies the reviewer, original source/generation history, permitted usage and date. Missing exports stay missing; loading failures never generate replacement art.

| Keys                                             | First submission requirements                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adventurer-body`                                | One original woodland adventurer; silhouette/face proportion studies first, then clean body; all eight review actions; feet pivot and per-frame head/hand anchors         |
| `adventurer-hair-back`, `adventurer-hair-front`  | Same original hairstyle; pose-matched actions; attach to head; no cropping-induced motion                                                                                 |
| `adventurer-outfit`, `adventurer-weapon`         | Original short layered outfit and seed-lantern blade; all actions; outfit at feet, weapon at hand                                                                         |
| `adventurer-face`, `adventurer-accessory`        | Head-pivoted independent `blink` / `sway` loops; expression variants specified for later action mapping                                                                   |
| `fern-frog`                                      | Original creature; all review actions; body/feet pivot; native-scale proportion review before full animation                                                              |
| `fern-sky`, `fern-far`, `fern-mid`, `fern-front` | Separate RGBA plates covering the 1280×720 viewport and 320 px pan allowance as appropriate; `idle` clip, top-left pivots; front plane transparent around the combat lane |
| `fern-platform`                                  | Organic 800 px wide review span; surface pivot at top-left; roots/soil below it; a single static `idle` frame before modular production                                   |
| `attack-effect`, `skill-effect`                  | Finite `play` clips; root-based pivots, separate filter policy; 6–10 arc/contact and 12–20 skill drawings as initial bids; review timing before further variants          |
| `ambient-mote`                                   | One small original pollen texture; static `idle`; soft alpha, no opaque halo                                                                                              |
| `ui-panel`                                       | One original 288×120 review panel composite; top-left pivot, static `idle`; readable at native view                                                                       |

For static plates, represent one frame and a looping `idle` clip. No universal atlas size is mandated: frame rectangles use actual exported bounds. Only after one scene passes silhouette, native-scale, motion and composition review should production expand to other classes, equipment, maps or monsters.

## Acceptance and replacement order

1. Review one adventurer silhouette/face, one Fern Frog silhouette and a Fernreach composition at the real viewport. Choose visual height and camera framing together.
2. Review the isolated first-scene candidates, then clean/separate the approved designs into production layers. Import **only approved** artwork into gameplay. Verify alpha edges, pivots, mirroring, attachment motion and front/rear ordering.
3. Review idle/walk/attack/hit/defeat and the skill effect at normal speed and frame-by-frame. Check enemy visibility under effects, not just attractive stills.
4. Capture 1280×720 and 1920×1080, record measured visible bounds, and obtain visual approval for this single scene. Current captures now show the populated candidate and its skill study; they do not imply visual acceptance or production-ready animation.
5. Integrate the approved rig and scenery into Fernreach while retaining collision data; adapt legacy pose/event mapping and add regression baselines. Re-run movement, combat and multiplayer gates.
6. Expand the approved design family to further equipment, Twig Creature, Crystal Beetle, other classes, UI and maps. Production remains stopped at the first-scene review boundary until approval.

See `VISUAL_COMPARISON.md` for screenshot evidence and the honest status of each visual criterion.
