# Game Design

Cindervale Online is an original 2D side-scrolling pixel-art MMORPG for desktop browsers, inspired by the progression and bossing depth of modern MapleStory. All IP is original.

Data definitions live in `packages/content`. Status: ✅ implemented · 📄 defined as data only · ⏳ planned.

## Pillars

1. **Satisfying movement**: tight platforming, readable at 1280×720.
2. **Relaxed grinding**: auto-grinding is an official feature on normal maps.
3. **Skill-based bossing**: manual-only, telegraphed, party mechanics.
4. **Long-term progression**: gear, enhancement, random modifiers, set bonuses.

## World

| Region           | Role                | Levels | Status                                     |
| ---------------- | ------------------- | ------ | ------------------------------------------ |
| Cindervale Town  | Main hub            | —      | ✅ placeholder map `cindervale-town`       |
| Fernreach Fields | Beginner area       | 1–15   | ✅ test map `fernreach-fields` (start map) |
| Duskmire Caverns | Early advanced area | 15–30  | 📄                                         |

## Classes 📄

| Class        | Role           | Primary stat |
| ------------ | -------------- | ------------ |
| Ember Knight | Melee warrior  | STR          |
| Gale Ranger  | Ranged archer  | DEX          |
| Runewaver    | Spellcaster    | INT          |
| Thornblade   | Agile assassin | LUK          |

Classes are chosen at creation and stored. They have no mechanical effect yet.

## Monsters 📄 and boss 📄

Twig Creature (Lv 2), Fern Frog (Lv 5), Crystal Beetle (Lv 18).
**Ashroot Guardian (Normal)**: Lv 30, 2 phases, 10-minute limit, 5-death limit.

## Systems

| System                                                                                                                   | Status                             |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Walk, jump, one-way platforms, ladders                                                                                   | ✅ server-authoritative, predicted |
| Double jump, ropes, portals                                                                                              | ⏳                                 |
| Combat (server-owned hits, damage, HP, cooldowns, buffs, death, loot, EXP)                                               | ⏳                                 |
| Auto-grinding (targets, rotations, potion thresholds, loot, zones; server-validated; off in bosses; no offline grinding) | ⏳                                 |
| Boss instances (phases, telegraphs, timers, death limits, difficulty, lockouts)                                          | ⏳                                 |
| Equipment, enhancement, modifiers, sets                                                                                  | ⏳                                 |
| Quests, dailies, weeklies                                                                                                | ⏳                                 |
| Parties, guilds, trading, auction house                                                                                  | ⏳                                 |
| Worlds and channels                                                                                                      | ⏳ (one room per map today)        |

## Movement constants (`game-core` `PHYSICS`)

Walk 180 px/s · jump 560 px/s · gravity 1500 px/s² · max fall 900 px/s · climb 120 px/s · body 24×48 px · 60 Hz fixed step.

**Ladders:** ↑ grabs a ladder within 10 px (also mid-air), ↓ at a ladder top climbs down. Leaving either end steps onto the platform there. Jump + direction leaps off at 60% jump height; jump alone does nothing.

**Controls:** ← → move · Space jump · ↑ ↓ climb · Esc menu · F3 debug overlay (WASD/Alt also work).
