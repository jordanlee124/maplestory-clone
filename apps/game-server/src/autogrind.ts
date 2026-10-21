// Auto-grinding: a deterministic state machine that chooses movement inputs and commands for a
// player. It never moves bodies, deals damage or grants rewards itself: the room feeds its
// input through the same step-credit movement as client input and its commands through the
// same attack / pickup / use-item handlers, with all their validation.
import {
  AUTO_GRIND,
  BASIC_ATTACK_ID,
  ITEMS,
  LOOT,
  type AttackSkillDef,
  type MapDef,
} from '@cindervale/content';
import { autoGrindConfigs, eq, type Db } from '@cindervale/database';
import {
  attackBox,
  hurtBox,
  rectsOverlap,
  type MoveInput,
  type Platform,
} from '@cindervale/game-core';
import { AutoGrindConfig, type AutoGrindState, type AutoGrindStatus } from '@cindervale/protocol';
import type { Drop } from './combat';
import type { Monster } from './monsters';
import { skillDef, skillLevel } from './progression';
import type { Session } from './session';

export interface AutoGrind {
  state: AutoGrindState;
  config: AutoGrindConfig;
  startedAt: number;
  pausedUntil: number;
  targetId: string | null;
  /** When the current target was chosen or last attacked. */
  targetSince: number;
  reason?: AutoGrindStatus['reason'];
}

export type AutoAction =
  | { type: 'attack'; skillId: string; facing: 'left' | 'right' }
  | { type: 'pickup'; dropId: string }
  | { type: 'useItem'; itemId: string };

export interface AutoWorld {
  map: MapDef;
  monsters: readonly Monster[];
  drops: Iterable<Drop>;
  now: number;
}

export const DEFAULT_AUTO_CONFIG: AutoGrindConfig = {
  skills: [],
  target: 'nearest',
  hpPotionPct: 30,
  mpPotionPct: 20,
  loot: 'all',
  bounds: null,
};

const IDLE: MoveInput = { left: false, right: false, up: false, down: false, jump: false };
export const isIdle = (i: MoveInput) => !(i.left || i.right || i.up || i.down || i.jump);

export const disabledAuto = (
  config: AutoGrindConfig,
  reason?: AutoGrindStatus['reason'],
): AutoGrind => ({
  state: 'DISABLED',
  config,
  startedAt: 0,
  pausedUntil: 0,
  targetId: null,
  targetSince: 0,
  reason,
});

export const isRunning = (a: AutoGrind) => a.state !== 'DISABLED' && a.state !== 'PAUSED';

/**
 * Validates a config for this class and map: every skill must exist, belong to the class and
 * be an attack or buff skill; bounds are clamped to the map. Null if it can't be used.
 */
export function normalizeConfig(
  config: AutoGrindConfig,
  classId: string,
  mapWidth: number,
): AutoGrindConfig | null {
  if (new Set(config.skills).size !== config.skills.length) return null;
  if (config.skills.length > AUTO_GRIND.maxSkills) return null;
  for (const id of config.skills) {
    const skill = skillDef(id);
    if (!skill || skill.kind === 'passive') return null;
    if (skill.classId !== null && skill.classId !== classId) return null;
  }
  if (!config.bounds) return config;
  const minX = Math.max(0, config.bounds.minX);
  const maxX = Math.min(mapWidth, config.bounds.maxX);
  return minX < maxX ? { ...config, bounds: { minX, maxX } } : null;
}

/** Starts automation, unless the map is a boss instance or the player is dead. */
export function startAuto(a: AutoGrind, s: Session, map: MapDef, now: number): AutoGrind {
  if (map.bossInstance) return disabledAuto(a.config, 'boss_instance');
  if (s.dead) return disabledAuto(a.config, 'died');
  return { ...disabledAuto(a.config), state: 'SEARCHING', startedAt: now };
}

/** Manual input takes over at once; automation resumes after a quiet period. */
export function pauseAuto(a: AutoGrind, now: number): AutoGrind {
  if (a.state === 'DISABLED') return a;
  return {
    ...a,
    state: 'PAUSED',
    pausedUntil: now + AUTO_GRIND.manualOverrideMs,
    targetId: null,
    reason: 'manual_input',
  };
}

const platformUnder = (map: MapDef, s: Session): Platform | undefined =>
  s.body.grounded
    ? map.geometry.platforms.find(
        (p) => p.y === s.body.y && s.body.x >= p.x && s.body.x <= p.x + p.width,
      )
    : undefined;

const toward = (from: number, to: number): MoveInput => ({
  ...IDLE,
  left: to < from,
  right: to > from,
});

/** A potion that restores `what`, held in the bag (lowest item id first, for determinism). */
function potionFor(s: Session, what: 'hp' | 'mp') {
  return [...s.potions.keys()]
    .sort()
    .find((id) => (s.potions.get(id) ?? 0) > 0 && (ITEMS[id]?.use?.[what] ?? 0) > 0);
}

function wantsLoot(a: AutoGrind, d: Drop) {
  switch (a.config.loot) {
    case 'all':
      return true;
    case 'currency':
      return d.itemId === null;
    case 'items':
      return d.itemId !== null;
    case 'none':
      return false;
  }
}

function usable(s: Session, id: string, now: number) {
  const skill = skillDef(id);
  if (!skill || skill.kind === 'passive') return undefined;
  if (skill.classId !== null && skill.classId !== s.classId) return undefined;
  if (skillLevel(s.skills, skill) < 1 || s.level < skill.requiredLevel) return undefined;
  if (s.mp < skill.mpCost || now < (s.cooldowns.get(id) ?? 0)) return undefined;
  return skill;
}

/**
 * One decision for one server tick: the movement input to use for this tick's steps and at
 * most one command. Pure: reads the session and world, returns the next automation state.
 */
export function stepAuto(
  a: AutoGrind,
  s: Session,
  w: AutoWorld,
): { auto: AutoGrind; input: MoveInput; action?: AutoAction } {
  const idle = (auto: AutoGrind, action?: AutoAction) => ({ auto, input: IDLE, action });
  if (a.state === 'DISABLED') return idle(a);
  if (w.map.bossInstance) return idle(disabledAuto(a.config, 'boss_instance'));
  if (s.dead) return idle(disabledAuto(a.config, 'died'));
  if (w.now - a.startedAt >= AUTO_GRIND.maxRunMs) return idle(disabledAuto(a.config, 'time_limit'));
  if (a.state === 'PAUSED') {
    if (w.now < a.pausedUntil) return idle(a);
    a = { ...a, state: 'SEARCHING', reason: undefined };
  }

  // Recover first: drink a potion if one is held, otherwise stand and regenerate.
  const { hpPotionPct, mpPotionPct } = a.config;
  const lowHp = s.hp * 100 < s.stats.maxHp * hpPotionPct;
  const lowMp = s.mp * 100 < s.stats.maxMp * mpPotionPct;
  if (lowHp || lowMp) {
    const potion = (lowHp && potionFor(s, 'hp')) || (lowMp && potionFor(s, 'mp')) || undefined;
    const canDrink = potion && w.now >= s.nextItemUseAt && !s.itemPending;
    return idle(
      { ...a, state: 'RECOVERING', targetId: null },
      canDrink ? { type: 'useItem', itemId: potion } : undefined,
    );
  }

  // Off a platform (mid-jump, falling, climbing): climb down or wait to land.
  const here = platformUnder(w.map, s);
  if (!here) return { auto: a, input: s.body.climbing ? { ...IDLE, down: true } : IDLE };

  // The walkable area: this platform, inside the configured bounds.
  const lo = Math.max(here.x, a.config.bounds?.minX ?? -Infinity);
  const hi = Math.min(here.x + here.width, a.config.bounds?.maxX ?? Infinity);
  if (lo >= hi) return idle({ ...a, state: 'SEARCHING', targetId: null });
  if (s.body.x < lo || s.body.x > hi) {
    // Started outside the bounds: walk back in before doing anything else.
    return {
      auto: { ...a, state: 'MOVING', targetId: null },
      input: toward(s.body.x, (lo + hi) / 2),
    };
  }
  const reachable = (x: number) => x >= lo && x <= hi;
  const onPlatform = (m: Monster) => m.ai.mode !== 'dead' && m.y === here.y && reachable(m.ai.x);

  let target = a.targetId ? w.monsters.find((m) => m.id === a.targetId) : undefined;
  if (target && (!onPlatform(target) || w.now - a.targetSince >= AUTO_GRIND.targetTimeoutMs)) {
    target = undefined;
  }

  // Between fights, collect permitted loot.
  if (!target) {
    const drop = [...w.drops]
      .filter(
        (d) =>
          wantsLoot(a, d) &&
          reachable(d.x) &&
          Math.abs(d.y - s.body.y) <= LOOT.pickupRange.y &&
          (!d.ownerId || d.ownerId === s.characterId || w.now >= d.ownerUntil),
      )
      .sort(
        (d, e) => Math.abs(d.x - s.body.x) - Math.abs(e.x - s.body.x) || d.id.localeCompare(e.id),
      )[0];
    if (drop) {
      const looting = { ...a, state: 'LOOTING' as const, targetId: null };
      if (Math.abs(drop.x - s.body.x) <= LOOT.pickupRange.x - 5) {
        return idle(looting, s.pickupPending ? undefined : { type: 'pickup', dropId: drop.id });
      }
      return { auto: looting, input: toward(s.body.x, drop.x) };
    }

    const dist = (m: Monster) => Math.abs(m.ai.x - s.body.x);
    const score = {
      nearest: (m: Monster) => dist(m),
      lowest_hp: (m: Monster) => m.hp * 1e6 + dist(m),
      highest_level: (m: Monster) => -m.def.level * 1e6 + dist(m),
    }[a.config.target];
    target = w.monsters
      .filter(onPlatform)
      .sort((m, n) => score(m) - score(n) || m.id.localeCompare(n.id))[0];
    if (!target) return idle({ ...a, state: 'SEARCHING', targetId: null });
    a = { ...a, targetId: target.id, targetSince: w.now };
  }

  const facing = target.ai.x >= s.body.x ? 'right' : 'left';
  const dir = facing === 'right' ? 1 : -1;
  const allowed = a.config.skills.length > 0 ? a.config.skills : [BASIC_ATTACK_ID];
  const box = hurtBox(target.ai.x, target.y, target.def.size);
  const inRange = (skill: AttackSkillDef) => rectsOverlap(attackBox(s.body, dir, skill.range), box);
  const attacking = { ...a, state: 'ATTACKING' as const };

  if (w.now >= s.nextAttackAt && !s.body.climbing) {
    for (const id of allowed) {
      const skill = usable(s, id, w.now);
      if (!skill) continue;
      if (skill.kind === 'buff' && !s.buffs.has(id)) {
        return idle(attacking, { type: 'attack', skillId: id, facing });
      }
      if (skill.kind === 'attack' && inRange(skill)) {
        return idle({ ...attacking, targetSince: w.now }, { type: 'attack', skillId: id, facing });
      }
    }
  }
  // Close enough for any allowed attack: hold position while cooldowns and MP recover.
  const anyInRange = allowed.some((id) => {
    const skill = skillDef(id);
    return skill?.kind === 'attack' && inRange(skill);
  });
  if (anyInRange) return idle(attacking);
  return { auto: { ...a, state: 'MOVING' }, input: toward(s.body.x, target.ai.x) };
}

// ---- Persistence ----

/** The saved config, re-validated; the default if none is saved or it no longer applies. */
export async function loadAutoConfig(
  db: Db,
  characterId: string,
  classId: string,
  mapWidth: number,
): Promise<AutoGrindConfig> {
  const [row] = await db
    .select({ config: autoGrindConfigs.config })
    .from(autoGrindConfigs)
    .where(eq(autoGrindConfigs.characterId, characterId));
  const parsed = AutoGrindConfig.safeParse(row?.config);
  const config = parsed.success ? normalizeConfig(parsed.data, classId, mapWidth) : null;
  return config ?? DEFAULT_AUTO_CONFIG;
}

export async function saveAutoConfig(db: Db, characterId: string, config: AutoGrindConfig) {
  await db
    .insert(autoGrindConfigs)
    .values({ characterId, config })
    .onConflictDoUpdate({
      target: autoGrindConfigs.characterId,
      set: { config, updatedAt: new Date() },
    });
}
