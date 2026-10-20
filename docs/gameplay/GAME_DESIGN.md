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
| Duskmire Caverns | Early advanced area | 15–30  | ✅ test map `duskmire-caverns`             |

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
| Combat (server-owned hits, damage, HP/MP, cooldowns, knockback, death/respawn, loot, EXP; client rendering pending)      | ⏳                                 |
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

## Combat (server-authoritative; values in `content/src/balance.ts`)

**Damage** = AttackPower × SkillMultiplier × Crit (×1.5) × Defense (100 / (100 + DEF)) × Variance (0.9–1.1), floored, minimum 1. Monsters use the same formula (multiplier 1, no crits).

**Stats** = class base + per-level growth (HP, MP, ATK, DEF; crit rate fixed per class). Level-up refills HP/MP. Regen: 1% HP and 2% MP per second.

| Skill                   | Class        | ×ATK | MP  | Cooldown | Range (w×h) | Targets |
| ----------------------- | ------------ | ---- | --- | -------- | ----------- | ------- |
| Strike (`basic-attack`) | all          | 1.0  | 0   | 0.5 s    | 80×60       | 1       |
| Flame Cleave            | Ember Knight | 1.8  | 6   | 1.5 s    | 110×70      | 3       |
| Gust Arrow              | Gale Ranger  | 1.5  | 5   | 1.0 s    | 360×50      | 1       |
| Rune Burst              | Runewaver    | 2.2  | 10  | 2.0 s    | 200×120     | 4       |
| Twin Thorn              | Thornblade   | 1.4  | 5   | 0.8 s    | 90×60       | 2       |

Any two attacks are at least 350 ms apart. You can't attack while climbing or dead. Hits knock monsters back; monster hits knock players back, followed by 1 s of invulnerability. A dead player respawns at the map spawn point after at least 2 s.

**Monsters** stay on their spawn platform. They idle, patrol, chase, attack, and return home (healing) when leashed or when the target is lost. Twig Creature and Fern Frog are passive (they aggro when hit); Crystal Beetle detects players within 220 px. Respawn takes 8–12 s.

**EXP** is split by damage share and granted once per monster life. EXP to the next level = ⌊15 × L^1.6⌋. Max level 200 (configurable).

**Loot:** each drop-table entry rolls independently, and currency is _Cinders_. The top damage dealer owns the drops for 10 s, then anyone may take them. Drops expire after 60 s. The inventory has 24 slots, stacks fill first, and a pickup that doesn't fully fit is refused.
