import { expect, it } from 'vitest';
import { CombatEvents, type CombatEvent, type CombatMessages } from './events';

it('retains join snapshots, dispatches typed combat events, and detaches listeners', () => {
  const handlers = new Map<string, (data: unknown) => void>();
  const events = new CombatEvents({
    onMessage<T>(type: string, callback: (data: T) => void) {
      handlers.set(String(type), (data) => callback(data as T));
      return () => {
        handlers.delete(String(type));
      };
    },
  });
  const exp: CombatMessages['expGained'] = { amount: 0, level: 2, exp: 5, expToNext: 30 };
  handlers.get('expGained')!(exp);
  expect(events.exp).toEqual(exp);
  const received: CombatEvent[] = [];
  const off = events.subscribe((e) => received.push(e));
  handlers.get('playerHit')!({ sessionId: 'me', monsterId: 'm0', damage: 4, hp: 36 });
  expect(received).toEqual([
    { type: 'playerHit', data: { sessionId: 'me', monsterId: 'm0', damage: 4, hp: 36 } },
  ]);
  off();
  handlers.get('playerDied')!({ sessionId: 'me' });
  expect(received).toHaveLength(1);
  events.destroy();
  expect(handlers.size).toBe(0);
});
