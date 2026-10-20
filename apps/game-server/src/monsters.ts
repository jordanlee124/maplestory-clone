import { randomUUID } from 'node:crypto';
import { MONSTERS, type MapDef, type MonsterDef } from '@cindervale/content';
import { spawnMonsterAi, type MonsterAi, type Rng } from '@cindervale/game-core';

export interface Monster {
  id: string;
  def: MonsterDef;
  spawnX: number;
  y: number;
  /** Walkable x range on its platform (keeps the whole body on it). */
  bounds: { min: number; max: number };
  ai: MonsterAi;
  hp: number;
  /** New per life; keys reward grants so one death pays out exactly once. */
  lifeId: string;
  /** characterId → damage dealt this life, for EXP share and loot ownership. */
  damageBy: Map<string, number>;
}

export function spawnMonsters(map: MapDef, now: number, rng: Rng): Monster[] {
  return map.monsterSpawns.map((spawn, i) => {
    const def = MONSTERS[spawn.monsterId]!;
    const platform = map.geometry.platforms.find(
      (p) => p.y === spawn.y && spawn.x >= p.x && spawn.x <= p.x + p.width,
    )!;
    const half = def.size.width / 2;
    return {
      id: `m${i}`,
      def,
      spawnX: spawn.x,
      y: spawn.y,
      bounds: { min: platform.x + half, max: platform.x + platform.width - half },
      ai: spawnMonsterAi(spawn.x, now, def.behavior, rng),
      hp: def.hp,
      lifeId: randomUUID(),
      damageBy: new Map(),
    };
  });
}

/** Resets a monster for a new life at its spawn point. */
export function resetMonsterLife(m: Monster) {
  m.hp = m.def.hp;
  m.lifeId = randomUUID();
  m.damageBy = new Map();
}

/** Character id that dealt the most damage this life (loot owner), if any. */
export function topDamager(m: Monster): string | undefined {
  let best: [string, number] | undefined;
  for (const entry of m.damageBy) if (!best || entry[1] > best[1]) best = entry;
  return best?.[0];
}
