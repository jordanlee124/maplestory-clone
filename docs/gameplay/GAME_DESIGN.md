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

## Classes ✅ (server)

| Class        | Role           | Primary / secondary | Power  | Starter skills (innate attack · passive Lv 2 · buff Lv 3 · attack Lv 5) |
| ------------ | -------------- | ------------------- | ------ | ----------------------------------------------------------------------- |
| Ember Knight | Melee warrior  | STR / DEX           | Attack | Flame Cleave · Ashen Hide · Kindled Will · Ember Crash                  |
| Gale Ranger  | Ranged archer  | DEX / STR           | Attack | Gust Arrow · Fletcher's Focus · Keen Eye · Tailwind Volley              |
| Runewaver    | Spellcaster    | INT / LUK           | Magic  | Rune Burst · Runic Insight · Mana Weave · Glyph Lance                   |
| Thornblade   | Agile assassin | LUK / DEX           | Attack | Twin Thorn · Venom Edge · Nightshade Focus · Bramble Flurry             |

Skills have levels (max 10), a required character level, optional prerequisites (the Lv 5 attack needs the innate attack at 3), MP costs and cooldowns. Skill points: 3 per level gained, spent one level at a time. Passives add stats permanently; buffs add stats for 2 minutes and end on death or leaving. Advancement stages open at levels 1/30/60/100 (data only; no advancement flow yet).

## Monsters 📄 and boss 📄

Twig Creature (Lv 2), Fern Frog (Lv 5), Crystal Beetle (Lv 18).
**Ashroot Guardian (Normal)**: Lv 30, 2 phases, 10-minute limit, 5-death limit.

## Systems

| System                                                                                                                   | Status                             |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Walk, jump, one-way platforms, ladders                                                                                   | ✅ server-authoritative, predicted |
| Double jump, ropes, portals                                                                                              | ⏳                                 |
| Combat (server-owned hits, damage, HP/MP, cooldowns, knockback, death/respawn, loot, EXP)                                | ✅ server                          |
| Stats, classes, skills, skill points, passives, buffs, potions                                                           | ✅ server; client UI pending       |
| Auto-grinding (targets, rotations, potion thresholds, loot, zones; server-validated; off in bosses; no offline grinding) | ✅ server; client UI pending       |
| Boss instances (phases, telegraphs, timers, death limits, difficulty, lockouts)                                          | ⏳                                 |
| Equipment, enhancement, modifiers, sets                                                                                  | ✅ server; client UI pending       |
| Quests, dailies, weeklies                                                                                                | ⏳                                 |
| Parties, guilds, trading, auction house                                                                                  | ⏳                                 |
| Worlds and channels                                                                                                      | ⏳ (one room per map today)        |

## Movement constants (`game-core` `PHYSICS`)

Walk 180 px/s · jump 560 px/s · gravity 1500 px/s² · max fall 900 px/s · climb 120 px/s · body 24×48 px · 60 Hz fixed step.

**Ladders:** ↑ grabs a ladder within 10 px (also mid-air), ↓ at a ladder top climbs down. Leaving either end steps onto the platform there. Jump + direction leaps off at 60% jump height; jump alone does nothing.

**Controls:** ← → move · Space jump · ↑ ↓ climb · Esc menu · F3 debug overlay (WASD/Alt also work).

## Combat (server-authoritative; values in `content/src/balance.ts`)

**Damage** = Power × SkillMultiplier × (1 + CritDamage on a crit) × (1 + BossDamage vs bosses) × Defense (100 / (100 + DEF × (1 − IgnoreDefense))) × Variance (0.9–1.1), floored, minimum 1. Power is Attack, or Magic for Runewavers. Monsters use the same formula (multiplier 1, no crits).

**Stats** are derived, never stored: class base + per-level growth (STR/DEX/INT/LUK, HP, MP, DEF) + equipment + passives + buffs, then primary stat × 0.5 + secondary stat × 0.25 is added to Attack or Magic (`CLASS_SCALING`, `STAT_FORMULA`). Crit damage starts at +50%. Crit rate and ignore defense are capped at 100%. Level-up refills HP/MP. Regen: 1% HP and 2% MP per second.

The skill table below lists level-1 values. Each skill level adds `multiplierPerLevel`. Every skill is in `SKILLS`.

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

## Equipment (server; values in `content/src/equipment.ts`)

Eleven slots: weapon, hat, top, bottom, gloves, shoes, cape, ring, pendant, belt, shoulder. Each item has a rarity (common → legendary), a required level, optional class restrictions, base stats and an optional set. Every dropped copy is its own instance with **bonus stats** rolled once by rarity (0–4 lines). Equipping swaps out whatever was in the slot. Unequipping needs a free bag slot. Potions (Ember Tonic +50 HP, Dew Tonic +30 MP) are used server-side with a 0.5 s cooldown.

**Forge Ascension:** levels 0→10. Each attempt costs Cinders whether it succeeds or not; success falls from 95% to 25%. Failing from level 5 or above drops one level. Each level adds +2 ATK/MAG (weapons) or +2 DEF/+8 HP (armor).
**Arcane Imprints:** a reroll costs Cinders by tier (Faint 300 · Bright 600 · Radiant 1200 · Mythic 2400). The first roll awakens tier 1. Each reroll may raise the tier (10% / 4% / 1%) and replaces all lines with weighted rolls from the tier's pool.
**Relic Resonance:** set pieces worn together add bonuses at 2, 3 and 4 pieces (Fernreach Wanderer: hat, top, bottom, shoes).

Odds and costs are versioned (`FORGE.version`, `IMPRINTS.version`, recorded per attempt). There are no paid or premium rerolls.

## Auto-grinding (server; `apps/game-server/src/autogrind.ts`)

Players toggle it and configure allowed skills in priority order, target rule (nearest / lowest HP / highest level), HP and MP potion thresholds, loot preference (all / currency / items / none) and horizontal bounds. The server runs a state machine (DISABLED, SEARCHING, MOVING, ATTACKING, LOOTING, RECOVERING, PAUSED) that only produces ordinary movement inputs and commands. They go through the same step credits, collision, combat, pickup and potion paths as manual play.

It targets monsters on the player's current platform inside the bounds. It respects cooldowns, MP, the attack lock and loot ownership, and drinks potions below the thresholds (or stands and regenerates without them). Any manual input pauses it for 3 s. It stops on disconnect, death, boss instances and after 2 hours (`AUTO_GRIND`). There is no offline grinding.
