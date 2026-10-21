// Character progression: skill levels, skill points and the stats they produce.
// Pure rules first, then persistence. Learning runs in a transaction that locks the character.
import {
  CLASS_SCALING,
  PROGRESSION,
  SKILLS,
  STAT_FORMULA,
  type AttackSkillDef,
  type SkillDef,
} from '@cindervale/content';
import { and, characterSkills, characters, eq, type Db } from '@cindervale/database';
import { deriveStats, type StatBonus, type Stats } from '@cindervale/game-core';
import type { SkillRejectReason } from '@cindervale/protocol';

/** Learned skill levels by skill id (innate skills appear once raised past 1). */
export type SkillLevels = ReadonlyMap<string, number>;
/** Active buffs by skill id. */
export type Buffs = ReadonlyMap<string, { level: number; until: number }>;

export const skillDef = (id: string): SkillDef | undefined =>
  Object.hasOwn(SKILLS, id) ? SKILLS[id] : undefined;

export const classScaling = (classId: string) =>
  CLASS_SCALING[classId] ?? CLASS_SCALING['ember-knight']!;

/** The learned level, or 1 for an innate skill that was never raised. */
export const skillLevel = (learned: SkillLevels, skill: SkillDef) =>
  learned.get(skill.id) ?? (skill.innate ? 1 : 0);

export const multiplierAt = (skill: AttackSkillDef, level: number) =>
  skill.multiplier + skill.multiplierPerLevel * (level - 1);

/** Points earned by `level` minus points spent (an innate skill's first level is free). */
export function skillPoints(level: number, learned: SkillLevels) {
  let spent = 0;
  for (const [id, lvl] of learned) spent += lvl - (skillDef(id)?.innate ? 1 : 0);
  return (level - 1) * PROGRESSION.skillPointsPerLevel - spent;
}

/** Why `skillId` can't be raised to `toLevel` right now, or null if it can. */
export function checkLearn(
  classId: string,
  level: number,
  learned: SkillLevels,
  skillId: string,
  toLevel: number,
): SkillRejectReason | null {
  const skill = skillDef(skillId);
  if (!skill) return 'unknown_skill';
  if (skill.classId !== null && skill.classId !== classId) return 'wrong_class';
  if (toLevel !== skillLevel(learned, skill) + 1) return 'stale';
  if (toLevel > skill.maxLevel) return 'max_level';
  if (level < skill.requiredLevel) return 'level_too_low';
  if (skill.requires) {
    const pre = skillDef(skill.requires.skillId);
    if (!pre || skillLevel(learned, pre) < skill.requires.level) return 'prerequisite';
  }
  if (skillPoints(level, learned) < 1) return 'no_skill_points';
  return null;
}

const bonusAt = (
  skill: { bonus: StatBonus; bonusPerLevel: StatBonus },
  level: number,
): StatBonus => {
  const out: StatBonus = { ...skill.bonus };
  for (const [k, v] of Object.entries(skill.bonusPerLevel) as [keyof Stats, number][]) {
    out[k] = (out[k] ?? 0) + v * (level - 1);
  }
  return out;
};

/** Class + level stats with learned passives and active buffs applied. */
export function computeStats(
  classId: string,
  level: number,
  learned: SkillLevels,
  buffs: Buffs,
): Stats {
  const bonuses: StatBonus[] = [];
  for (const [id, lvl] of learned) {
    const skill = skillDef(id);
    if (skill?.kind === 'passive' && lvl > 0) bonuses.push(bonusAt(skill, lvl));
  }
  for (const [id, b] of buffs) {
    const skill = skillDef(id);
    if (skill?.kind === 'buff') bonuses.push(bonusAt(skill, b.level));
  }
  return deriveStats(classScaling(classId), STAT_FORMULA, level, bonuses);
}

/** Every skill this class can see, with its effective level (0 = not learned). */
export const classSkills = (classId: string, learned: SkillLevels) =>
  Object.values(SKILLS)
    .filter((s) => s.classId === null || s.classId === classId)
    .map((s) => ({ skillId: s.id, level: skillLevel(learned, s) }));

// ---- Persistence ----

export async function loadSkills(db: Db, characterId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ skillId: characterSkills.skillId, level: characterSkills.level })
    .from(characterSkills)
    .where(eq(characterSkills.characterId, characterId));
  return new Map(rows.map((r) => [r.skillId, r.level]));
}

export type LearnResult =
  { ok: true; learned: Map<string, number> } | { ok: false; reason: SkillRejectReason };

/**
 * Raises one skill to `toLevel`, validated against the stored level and class. The character
 * row is locked, so concurrent requests can't spend the same skill point twice; resending the
 * same request is rejected as 'stale'.
 */
export function learnSkill(
  db: Db,
  characterId: string,
  skillId: string,
  toLevel: number,
): Promise<LearnResult> {
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select({ classId: characters.classId, level: characters.level })
      .from(characters)
      .where(eq(characters.id, characterId))
      .for('update');
    if (!c) throw new Error(`Character ${characterId} not found`);
    const rows = await tx
      .select({ skillId: characterSkills.skillId, level: characterSkills.level })
      .from(characterSkills)
      .where(eq(characterSkills.characterId, characterId));
    const learned = new Map(rows.map((r) => [r.skillId, r.level]));
    const reason = checkLearn(c.classId, c.level, learned, skillId, toLevel);
    if (reason) return { ok: false, reason };
    if (learned.has(skillId)) {
      await tx
        .update(characterSkills)
        .set({ level: toLevel })
        .where(
          and(eq(characterSkills.characterId, characterId), eq(characterSkills.skillId, skillId)),
        );
    } else {
      await tx.insert(characterSkills).values({ characterId, skillId, level: toLevel });
    }
    learned.set(skillId, toLevel);
    return { ok: true, learned };
  });
}
