import { describe, expect, it } from 'vitest';
import { CLASS_IDS, CLASSES, MAPS, REGIONS, START_MAP_ID } from './index';

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
});
