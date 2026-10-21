# Character visual integration — Phase 1.6

The character system uses the existing `VisualAsset` pipeline and `LayeredActor`.
`player/appearance.ts` defines frontend appearance IDs and a layer catalog, separate
from stats. Both local and remote characters use `Avatar`. No database, gameplay
rules or wire contracts changed.

## Current status

The approved original adventurer is a **flattened direction study**, not a finished
layered character. Its idle/blink, anticipation, contact and cast drawings remain
the only approved player poses. Walk, jump, fall, climb, hit, death and respawn are
supported presentation states with explicitly disclosed idle holds. The existing
hit flash/recoil and death transparency remain cosmetic substitutes. No new
artwork was generated, traced, extracted or approved during this integration.

The development-only customization fieldset at `/art-validation` lets you change
body, skin, face, eyes, hairstyle/color, outfit, weapon, hat and cape IDs. Missing
selections stay visible in its status message; the flattened study stays on screen.
Its baked-in weapon, cape, hair and clothing cannot be removed independently.
The `none` value requests no **additional** layer; it cannot erase baked pixels.
Appearance changes currently demonstrate metadata and fallback behavior, not
finished visual customization. The fieldset is omitted in production builds even
when `ART_VALIDATION_ENABLED=true` enables the review scene.

Use Pose, Face left, Playback speed (including zero), Background, Sprite scale,
Camera zoom, Pause preview and Measurement guides to review. Golden crosses mark
feet/head/hand/back pivots. Head/hand/back positions are provisional measurements
of the study; recalibrate with actual separated exports. Collision guides remain
24×48, independent of visual scale. The existing 96 px trial is a review baseline,
not a final height specification. Final proportion, scale, camera and movement
readability approval remains outstanding.

## Required original assets

All slots below remain missing. Do not expand to other classes before reviewing
one complete adventurer at gameplay scale in both facings.

- [ ] Clean body with skin-tone variants and a second body variant.
- [ ] Separate face expressions and eyes/blink assets.
- [ ] Rear/front tousled hair, braided variant, and hair-color variants.
- [ ] Woodland outfit and traveler outfit exports.
- [ ] Seed-lantern blade attached to the hand; no baked weapon in the body.
- [ ] Fern cap with explicit covered-hair rules.
- [ ] Leaf mantle attached to the back.
- [ ] Seed-bell/accessory export with an optional independent sway loop.
- [ ] Authored idle, walk, jump, fall, climb, basic attack, cast, hit, death and respawn.
- [ ] Alpha/edge cleanup, planted feet, usable silhouettes, attachment calibration,
      scale/camera review, left/right overlap review, and optimized production PNGs.

Export versioned RGBA PNGs into the existing asset tree, with original sources and
provenance in `art/source/`; follow [ASSET_PIPELINE.md](ASSET_PIPELINE.md). No fixed
cell size or mandatory equal frame count applies. Every frame needs its rectangle
and feet/attachment pivot; body frames need named `head`, `hand`, `back` anchors.
Use positive per-frame millisecond durations. Different layers may have different
frame counts and clip lengths: pose-following layers sample the same normalized
body timeline; `independent` layers retain a clock across action transitions.
Playback speed/pause applies to both clocks.

Register approved `AppearanceLayer` entries in `CHARACTER_LAYERS`, using slot/id,
asset, `depth`, optional `attachTo`, per-body-frame `offsets`, `actionDepth`,
`hiddenDuring`, and `hides` slot rules. A body variant replaces the root while
retaining the root sprite reference. Missing action clips fall back to the layer's
required idle clip. `hides` applies to appearance slots; `hiddenDuring` applies
to action names. Layer swaps validate anchors before removing existing layers.
Character destruction owns sprites only; shared textures live until game teardown.

The empty catalog is deliberate. Do not add unapproved raster art to live loading.
New approved catalog textures must also be added to the map-scoped load list;
preview candidates belong in the review load list until approved. The validation
slot inventory now explicitly includes eyes, hat and cape.

## Future shared contract proposal — not implemented

`PlayerView` currently supplies no public appearance or worn-item visual IDs.
Owner-only `Inventory.equipped` cannot describe other players. Until the backend
owner agrees on a contract, keep the frontend model local and use the default
appearance for replicated actors. Do not infer ownership or equipment stats from
cosmetic IDs.

A future additive public `appearance` snapshot can carry validated, bounded catalog
IDs for body, skinTone, face, eyes, hairStyle, hairColor, outfit, hat, weapon, cape
and accessories. Resolve worn-item IDs to approved visual IDs on the server;
exclude instance IDs, forge bonuses and other private inventory data. Facing
continues to follow existing movement and confirmed attack events. Backend
validation, persistence, replication and protocol compatibility need coordinated
implementation and tests before enabling multiplayer customization.
