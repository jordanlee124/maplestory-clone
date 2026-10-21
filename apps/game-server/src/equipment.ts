// Equipment rules: requirements, rolled stats, Forge Ascension, Arcane Imprints and Relic
// Resonance set bonuses. Pure; the server injects rng.
import {
  BONUS_STATS,
  EQUIPMENT,
  FORGE,
  FORGE_MAX_LEVEL,
  IMPRINTS,
  SETS,
  type EquipDef,
  type StatLine,
} from '@cindervale/content';
import type { Rng, StatBonus, Stats } from '@cindervale/game-core';
import type { ItemRejectReason } from '@cindervale/protocol';

/** The per-copy state of one equipment item. */
export interface EquipInstance {
  itemId: string;
  bonus: readonly StatLine[];
  forgeLevel: number;
  imprints: readonly StatLine[];
}

export const equipDef = (itemId: string): EquipDef | undefined =>
  Object.hasOwn(EQUIPMENT, itemId) ? EQUIPMENT[itemId] : undefined;

export function checkEquip(
  itemId: string,
  classId: string,
  level: number,
): ItemRejectReason | null {
  const def = equipDef(itemId);
  if (!def) return 'not_equipment';
  if (def.classes && !def.classes.includes(classId)) return 'wrong_class';
  if (level < def.requiredLevel) return 'level_too_low';
  return null;
}

const linesToBonus = (lines: readonly StatLine[]): StatBonus => {
  const out: StatBonus = {};
  for (const l of lines) out[l.stat] = (out[l.stat] ?? 0) + l.value;
  return out;
};

const scale = (bonus: StatBonus, n: number): StatBonus => {
  const out: StatBonus = {};
  for (const [k, v] of Object.entries(bonus) as [keyof Stats, number][]) out[k] = v * n;
  return out;
};

export const forgeBonus = (def: EquipDef, level: number) =>
  scale(def.slot === 'weapon' ? FORGE.perLevel.weapon : FORGE.perLevel.armor, level);

/** Every stat bonus worn equipment gives: base, bonus lines, forge, imprints, set bonuses. */
export function equipmentBonuses(items: readonly EquipInstance[]): StatBonus[] {
  const out: StatBonus[] = [];
  const setPieces = new Map<string, number>();
  for (const item of items) {
    const def = equipDef(item.itemId);
    if (!def) continue;
    out.push(def.stats, linesToBonus(item.bonus), linesToBonus(item.imprints));
    if (item.forgeLevel > 0) out.push(forgeBonus(def, item.forgeLevel));
    if (def.setId) setPieces.set(def.setId, (setPieces.get(def.setId) ?? 0) + 1);
  }
  for (const [setId, pieces] of setPieces) {
    for (const b of SETS[setId]?.bonuses ?? []) if (pieces >= b.pieces) out.push(b.bonus);
  }
  return out;
}

/** Bonus stat lines for a newly created item, by rarity. */
export function rollBonusLines(itemId: string, rng: Rng): StatLine[] {
  const def = equipDef(itemId);
  if (!def) return [];
  const pool = BONUS_STATS.pool;
  return Array.from({ length: BONUS_STATS.linesByRarity[def.rarity] }, () => {
    const e = pool[Math.floor(rng() * pool.length)]!;
    return { stat: e.stat, value: e.min + Math.floor(rng() * (e.max - e.min + 1)) };
  });
}

/** Cost and odds of forging an item currently at `level`; undefined at the cap. */
export const forgeStep = (level: number) =>
  level < FORGE_MAX_LEVEL ? FORGE.levels[level] : undefined;

/** One forge attempt from `level`. Consumes one rng value. */
export function rollForge(level: number, rng: Rng): { success: boolean; level: number } {
  const step = forgeStep(level)!;
  if (rng() < step.successRate) return { success: true, level: level + 1 };
  return { success: false, level: step.onFail === 'downgrade' ? Math.max(0, level - 1) : level };
}

export const imprintCost = (tier: number) => IMPRINTS.tiers[Math.max(0, tier - 1)]!.cost;

/** One imprint reroll from `tier` (0 = none: awakens to tier 1). */
export function rollImprint(tier: number, rng: Rng): { tier: number; lines: StatLine[] } {
  const max = IMPRINTS.tiers.length;
  let next = tier === 0 ? 1 : tier;
  if (tier > 0 && next < max && rng() < IMPRINTS.tiers[tier - 1]!.tierUpChance) next++;
  const t = IMPRINTS.tiers[next - 1]!;
  const total = t.pool.reduce((sum, e) => sum + e.weight, 0);
  const lines = Array.from({ length: t.lines }, () => {
    let r = rng() * total;
    const e = t.pool.find((p) => (r -= p.weight) < 0) ?? t.pool[t.pool.length - 1]!;
    return { stat: e.stat, value: e.value };
  });
  return { tier: next, lines };
}
