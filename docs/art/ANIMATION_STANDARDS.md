# Animation standards

Use the authored-motion requirements and initial frame bids in [ART_DIRECTION.md](ART_DIRECTION.md); those bids are not claims of existing drawings. Metadata and import instructions are in [ASSET_PIPELINE.md](ASSET_PIPELINE.md).

## Alignment and clocks

- Record each trimmed frame's feet pivot in source pixels, even if outside the frame. Keep the support line planted across idle/attacks; intentional airborne poses still reference the same root. Define head/hand anchors per body frame before exporting overlays.
- Pose-following layers use the body's action and elapsed time, not an independent Phaser FPS animation. Face/eyes/accessory loops can have explicit independent clocks. Test both facings, the same scale, and weapon order behind/in front of the torso per action and facing.
- Clips have named frames, positive unequal durations and an explicit loop flag. Idle/walk/climb may loop; attacks, hurt, defeat and effects are finite. Long elapsed times hold a finite clip's last frame. Time sampling is independent of render FPS.
- Prefer meaningful anticipation, contact, follow-through, weight transfer and secondary motion. Repeated identical images do not count as new drawings. Sparse generated poses must stay labeled studies.

## Gameplay mapping

Player actions: idle, walk, jump, fall, basic attack, skill, hit, death and climb. The existing `AnimationStateMachine` remains authoritative for presentation priority; movement follows shared physics, attacks follow the existing command/event path. Current basic/skill windows are 90 ms startup, 100 ms active and 160 ms recovery. These are presentation windows; the server validates hits immediately. Never delay or invent damage/rewards to fit artwork.

`MonsterAnimation` maps authoritative idle/patrol/chase/return/dead modes plus confirmed attack/hit/respawn timers into idle/walk/attack/hit/defeat/respawn clips. Death takes priority; hit interrupts attack. Clip time starts on transition and continues through repeated state patches. The animation component neither reads nor calculates damage/HP. Missing drawings explicitly hold idle while the existing hit flash/recoil, defeat fade and respawn burst remain disclosed substitutes. Accurate enemy attack windup/miss telegraphs require additional server events; no speculative boss telegraph is attached to live combat.

## Current coverage

| Set                 | Actual drawings/playback                                                  | Required next                                                                                                               |
| ------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Approved adventurer | Idle/blink, windup, contact, cast; one flattened outfit                   | Clean body, face/eyes, hair, outfit, weapon and accessory exports; walk/jump/fall/climb/hurt/death and polished in-betweens |
| Approved Fern Frog  | One clean idle crop; confirmed cosmetic recoil/flash/fade                 | Idle cycle, hop, windup/strike, hurt, defeat and respawn drawings                                                           |
| Twig candidate      | Six isolated poses; two-pose walk and short attack/hit study; defeat hold | Silhouette/scale/motion approval, alpha cleanup and complete in-betweens; authored respawn                                  |
| Crystal Beetle      | Legacy procedural placeholders                                            | Original rounded mineral-shell design and complete action set                                                               |
| Cinder-petal effect | Six soft-alpha stages, finite playback                                    | Edge cleanup, separate arc/contact/secondary layers, new class-specific effects                                             |

## Review checks

Inspect idle/walk/airborne/attack/hit/defeat/climb at native gameplay scale, normal speed, slowed/paused contact, left and right. Overlay the unchanged 24x48 player and content-owned monster hurtboxes. Check planted feet, face alignment, attachment stability, clipping, effect obstruction and old/new layer overlap. Capture 1920x1080, 2560x1440 and 3440x1440 without changing logical physics dimensions or stretching aspect ratio. Integer display scaling can require scrolling in a browser page with controls above the canvas.

Skill effects may use smooth alpha and linear filtering independently of pixel sprites. Keep effects bounded, preserve enemy silhouettes and future telegraph lanes, and remove emitters/listeners at shutdown. Screen shake, if introduced after readability/performance review, must be optional with a zero-intensity setting. It is not enabled in this slice.
