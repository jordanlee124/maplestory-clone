import { FORGE, IMPRINTS, SETS } from '@cindervale/content';
import { seededRng } from '@cindervale/game-core';
import { describe, expect, it } from 'vitest';
import {
  checkEquip,
  equipmentBonuses,
  forgeStep,
  imprintCost,
  rollBonusLines,
  rollForge,
  rollImprint,
} from './equipment';
import { computeStats } from './progression';

const fixed = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};
const item = (itemId: string, extra = {}) => ({
  itemId,
  bonus: [],
  forgeLevel: 0,
  imprints: [],
  ...extra,
});

describe('equipment rules', () => {
  it('enforces item kind, class and level, including prototype keys', () => {
    expect(checkEquip('ember-brand', 'ember-knight', 1)).toBeNull();
    expect(checkEquip('ember-brand', 'runewaver', 99)).toBe('wrong_class');
    expect(checkEquip('cinder-ring', 'runewaver', 4)).toBe('level_too_low');
    expect(checkEquip('ember-tonic', 'runewaver', 99)).toBe('not_equipment');
    expect(checkEquip('__proto__', 'runewaver', 99)).toBe('not_equipment');
  });

  it('rolls bonus lines by rarity within their ranges', () => {
    expect(rollBonusLines('sprout-cap', seededRng(1))).toEqual([]); // common: 0 lines
    const rng = seededRng(3);
    for (let i = 0; i < 200; i++) {
      const lines = rollBonusLines('crystal-band', rng); // rare: 2 lines
      expect(lines).toHaveLength(2);
      for (const l of lines) expect(l.value).toBeGreaterThan(0);
    }
  });

  it('adds base, bonus, forge, imprint and set bonuses into stats', () => {
    const base = computeStats('ember-knight', 5, new Map(), new Map());
    const worn = [
      item('ember-brand', {
        forgeLevel: 2,
        bonus: [{ stat: 'str', value: 2 }],
        imprints: [{ stat: 'attack', value: 3 }],
      }),
    ];
    const s = computeStats('ember-knight', 5, new Map(), new Map(), equipmentBonuses(worn));
    // +10 base, +4 forge (2 × 2), +3 imprint, +1 from 2 STR (× 0.5)
    expect(s.attack - base.attack).toBe(18);
  });

  it('applies every set threshold reached (Relic Resonance)', () => {
    const set = SETS['fernreach-wanderer']!;
    const two = equipmentBonuses([item('sprout-cap'), item('fernweave-tunic')]);
    expect(two).toContainEqual(set.bonuses[0]!.bonus);
    expect(two).not.toContainEqual(set.bonuses[1]!.bonus);
    const three = equipmentBonuses([
      item('sprout-cap'),
      item('fernweave-tunic'),
      item('fernweave-boots'),
    ]);
    expect(three).toContainEqual(set.bonuses[0]!.bonus);
    expect(three).toContainEqual(set.bonuses[1]!.bonus);
  });
});

describe('Forge Ascension', () => {
  it('succeeds below the success rate and applies the failure outcome otherwise', () => {
    expect(rollForge(0, fixed(0.94))).toEqual({ success: true, level: 1 });
    expect(rollForge(0, fixed(0.96))).toEqual({ success: false, level: 0 }); // keep
    expect(rollForge(6, fixed(0.99))).toEqual({ success: false, level: 5 }); // downgrade
    expect(forgeStep(FORGE.levels.length)).toBeUndefined();
  });

  it('matches the configured probability over many attempts', () => {
    const rng = seededRng(11);
    const n = 20_000;
    let wins = 0;
    for (let i = 0; i < n; i++) if (rollForge(5, rng).success) wins++;
    expect(wins / n).toBeCloseTo(FORGE.levels[5]!.successRate, 1);
  });
});

describe('Arcane Imprints', () => {
  it('awakens to tier 1 and rolls that tier’s line count from its pool', () => {
    const r = rollImprint(0, seededRng(5));
    expect(r.tier).toBe(1);
    expect(r.lines).toHaveLength(IMPRINTS.tiers[0]!.lines);
    for (const l of r.lines)
      expect(IMPRINTS.tiers[0]!.pool).toContainEqual(expect.objectContaining(l));
  });

  it('tiers up only below the chance, and never past the top tier', () => {
    expect(rollImprint(1, fixed(0.05, 0.5)).tier).toBe(2);
    expect(rollImprint(1, fixed(0.5)).tier).toBe(1);
    expect(rollImprint(IMPRINTS.tiers.length, fixed(0)).tier).toBe(IMPRINTS.tiers.length);
  });

  it('charges by current tier', () => {
    expect(imprintCost(0)).toBe(IMPRINTS.tiers[0]!.cost);
    expect(imprintCost(2)).toBe(IMPRINTS.tiers[1]!.cost);
  });
});
