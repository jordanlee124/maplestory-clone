import {
  ServerMessage,
  type AttackResult,
  type AttackRejected,
  type PlayerHit,
  type PlayerDied,
  type PlayerRespawned,
  type MonsterKilled,
  type ExpGained,
  type Inventory,
  type LevelUp,
  type LootSpawned,
  type ItemPickedUp,
  type PickupRejected,
  type CharacterStats,
  type SkillRejected,
  type ItemRejected,
  type EnhanceResult,
  type AutoGrindStatus,
} from '@cindervale/protocol';
import type { Room } from '@colyseus/sdk';

export interface CombatMessages {
  attackResult: AttackResult;
  attackRejected: AttackRejected;
  playerHit: PlayerHit;
  playerDied: PlayerDied;
  playerRespawned: PlayerRespawned;
  monsterKilled: MonsterKilled;
  expGained: ExpGained;
  inventory: Inventory;
  levelUp: LevelUp;
  lootSpawned: LootSpawned;
  itemPickedUp: ItemPickedUp;
  pickupRejected: PickupRejected;
  characterStats: CharacterStats;
  skillRejected: SkillRejected;
  itemRejected: ItemRejected;
  enhanceResult: EnhanceResult;
  autoGrind: AutoGrindStatus;
}
export type CombatEvent = {
  [K in keyof CombatMessages]: { type: K; data: CombatMessages[K] };
}[keyof CombatMessages];

/** Capture owner snapshots before Phaser loads, so join-time messages aren't lost. */
export class CombatEvents {
  exp?: ExpGained;
  inventory?: Inventory;
  stats?: CharacterStats;
  private listeners = new Set<(event: CombatEvent) => void>();
  private dispose: (() => void)[];

  constructor(room: { onMessage<T>(type: string, callback: (data: T) => void): () => void }) {
    this.dispose = Object.values(ServerMessage).map((type) =>
      room.onMessage(type, (data: CombatMessages[typeof type]) => {
        if (type === 'expGained') this.exp = data as ExpGained;
        if (type === 'inventory') this.inventory = data as Inventory;
        if (type === 'characterStats') this.stats = data as CharacterStats;
        const event = { type, data } as CombatEvent;
        for (const listener of this.listeners) listener(event);
      }),
    );
  }

  subscribe(listener: (event: CombatEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy() {
    this.dispose.forEach((off) => off());
    this.listeners.clear();
  }
}

export const combatEvents = new WeakMap<Room, CombatEvents>();
