import { describe, expect, it } from 'vitest';
import {
  BASIC_ATTACK_ID,
  CLASS_IDS,
  ADVANCEMENT_LEVELS,
  CLASS_SCALING,
  CLASSES,
  DROP_TABLES,
  EQUIP_SLOTS,
  EQUIPMENT,
  FORGE,
  IMPRINTS,
  SETS,
  ITEMS,
  MAPS,
  MONSTERS,
  REGIONS,
  SKILLS,
  START_MAP_ID,
} from './index';

describe('content', () => {
  it('keys match ids', () => {
    for (const table of [CLASSES, MAPS, REGIONS]) {
      for (const [key, def] of Object.entries(table)) expect(def.id).toBe(key);
    }
    expect(Object.keys(CLASSES)).toEqual([...CLASS_IDS]);
  });

  it('every map belongs to a region and spawns on a platform', () => {
    expect(MAPS[START_MAP_ID]).toBeDefined();
    for (const map of Object.values(MAPS)) {
      expect(REGIONS[map.regionId]?.maps).toContain(map.id);
      const { spawn, platforms } = map.geometry;
      expect(
        platforms.some((p) => p.y === spawn.y && spawn.x >= p.x && spawn.x <= p.x + p.width),
      ).toBe(true);
    }
  });

  it('every ladder ends on platforms so climbers can step off', () => {
    for (const { geometry: g } of Object.values(MAPS)) {
      const onPlatform = (x: number, y: number) =>
        g.platforms.some((p) => p.y === y && x >= p.x && x <= p.x + p.width);
      for (const l of g.ladders) {
        expect(l.top).toBeLessThan(l.bottom);
        expect(onPlatform(l.x, l.top)).toBe(true);
        expect(onPlatform(l.x, l.bottom)).toBe(true);
      }
    }
  });

  it('monster spawns sit on platforms and reference real monsters', () => {
    for (const { geometry: g, monsterSpawns } of Object.values(MAPS)) {
      for (const s of monsterSpawns) {
        expect(MONSTERS[s.monsterId]).toBeDefined();
        expect(g.platforms.some((p) => p.y === s.y && s.x >= p.x && s.x <= p.x + p.width)).toBe(
          true,
        );
      }
    }
  });

  it('drop tables, skills and class stats reference real ids', () => {
    for (const m of Object.values(MONSTERS)) {
      const table = DROP_TABLES[m.dropTableId];
      expect(table).toBeDefined();
      for (const d of table!.items) {
        expect(ITEMS[d.itemId]).toBeDefined();
        expect(d.chance).toBeGreaterThan(0);
        expect(d.min).toBeLessThanOrEqual(d.max);
      }
    }
    for (const skill of Object.values(SKILLS)) {
      expect(skill.classId === null || skill.classId in CLASSES).toBe(true);
    }
    for (const id of CLASS_IDS) expect(CLASS_SCALING[id]).toBeDefined();
    expect(SKILLS[BASIC_ATTACK_ID]?.classId).toBeNull();
  });
});

describe('skills', () => {
  const skills = Object.values(SKILLS);

  it('give every class an innate attack, a passive, a buff and a learnable attack', () => {
    for (const id of CLASS_IDS) {
      const own = skills.filter((s) => s.classId === id);
      expect(own.some((s) => s.kind === 'attack' && s.innate)).toBe(true);
      expect(own.some((s) => s.kind === 'attack' && !s.innate)).toBe(true);
      expect(own.some((s) => s.kind === 'passive')).toBe(true);
      expect(own.some((s) => s.kind === 'buff')).toBe(true);
    }
  });

  it('have consistent unlock requirements', () => {
    for (const s of skills) {
      expect(s.id in SKILLS && SKILLS[s.id] === s).toBe(true);
      expect(s.maxLevel).toBeGreaterThanOrEqual(1);
      if (s.stage > 0)
        expect(s.requiredLevel).toBeGreaterThanOrEqual(ADVANCEMENT_LEVELS[s.stage - 1]!);
      if (s.requires) {
        const pre = SKILLS[s.requires.skillId];
        expect(pre?.classId).toBe(s.classId);
        expect(s.requires.level).toBeLessThanOrEqual(pre!.maxLevel);
      }
    }
  });
});

describe('equipment', () => {
  it('every equip item has equipment data and vice versa', () => {
    for (const item of Object.values(ITEMS)) {
      expect(item.kind === 'equip').toBe(item.id in EQUIPMENT);
    }
    for (const [id, e] of Object.entries(EQUIPMENT)) {
      expect(e.itemId).toBe(id);
      expect(EQUIP_SLOTS).toContain(e.slot);
      if (e.setId) expect(SETS[e.setId]).toBeDefined();
      for (const c of e.classes ?? []) expect(CLASS_IDS).toContain(c);
    }
  });

  it('every slot has at least one item', () => {
    const slots = new Set(Object.values(EQUIPMENT).map((e) => e.slot));
    for (const slot of EQUIP_SLOTS) expect(slots.has(slot)).toBe(true);
  });

  it('has sane enhancement tables', () => {
    for (const l of FORGE.levels) expect(l.successRate).toBeGreaterThan(0);
    for (const t of IMPRINTS.tiers) {
      expect(t.lines).toBeGreaterThan(0);
      expect(t.pool.length).toBeGreaterThanOrEqual(t.lines);
    }
  });
});
