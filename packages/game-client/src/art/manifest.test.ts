import { describe, expect, it } from 'vitest';
import { PHYSICS } from '@cindervale/game-core';
import { MONSTERS } from '@cindervale/content';
import { ATTACK_WINDOWS } from '../combat/animation';
import {
  ASSETS,
  CHARACTER_FRAMES,
  frameRect,
  validateAsset,
  validateEquipment,
  type SheetAsset,
} from './manifest';
import { integerDisplayScale } from '../viewport';

const body = () => ASSETS.find((a) => a.key === 'adventurer-ember-knight') as SheetAsset;

describe('art contracts', () => {
  it('retains authoritative bounds inside uniform, feet-aligned, untrimmed cells', () => {
    ASSETS.forEach(validateAsset);
    const player = body();
    expect(player.cell).toEqual({ width: 64, height: 64 });
    expect(player.origin).toEqual({ x: 0.5, y: 1 });
    expect(player.hurtbox).toEqual({ width: PHYSICS.bodyWidth, height: PHYSICS.bodyHeight });
    expect(player.frames).toEqual(CHARACTER_FRAMES);
    expect(player.clips.find((c) => c.name === 'attack')!.durationsMs).toEqual([
      ATTACK_WINDOWS.startup,
      ATTACK_WINDOWS.active,
      ATTACK_WINDOWS.recovery,
    ]);
    for (const m of Object.values(MONSTERS)) {
      expect((ASSETS.find((a) => a.key === m.id) as SheetAsset).hurtbox).toEqual(m.size);
    }
  });

  it('addresses multi-row sheets and rejects duplicate/missing frames and unapproved file metadata', () => {
    const sheet = { ...body(), columns: 6 };
    expect(frameRect(sheet, 'walk0')).toEqual({ x: 128, y: 0, width: 64, height: 64 });
    expect(frameRect(sheet, 'attack0')).toEqual({ x: 256, y: 64, width: 64, height: 64 });
    expect(() => validateAsset({ ...sheet, frames: ['idle0', 'idle0'] })).toThrow();
    expect(() => validateAsset({ ...sheet, cell: { width: 32, height: 48 } })).toThrow();
    expect(() =>
      validateAsset({ ...sheet, status: 'approved', url: '/assets/body.png' } as SheetAsset),
    ).toThrow();
    expect(() => frameRect(sheet, 'absent')).toThrow();
    expect(() =>
      validateAsset({
        ...sheet,
        status: 'approved',
        url: '/assets/body.png',
        approval: {},
      } as SheetAsset),
    ).toThrow();
    expect(() => validateAsset({ ...sheet, clips: [] })).toThrow();
  });

  it('requires equipment to share the base rig, poses and origin', () => {
    const outfit: SheetAsset = {
      ...body(),
      key: 'equipment-calibration',
      kind: 'equipment',
      slot: 'outfit',
    };
    expect(() => validateEquipment(body(), [outfit])).not.toThrow();
    expect(() => validateEquipment(body(), [{ ...outfit, frames: ['idle0'] }])).toThrow();
    expect(() => validateEquipment(body(), [{ ...outfit, origin: { x: 0, y: 0 } }])).toThrow();
    expect(() =>
      validateEquipment(body(), [outfit, { ...outfit, key: 'duplicate-slot' }]),
    ).toThrow();
  });
});

it('uses integer display scale and letterboxing instead of fractional FIT scaling', () => {
  expect([1280, 1366, 1920, 2560, 3840].map(integerDisplayScale)).toEqual([1, 1, 1, 2, 3]);
  expect(integerDisplayScale(900)).toBe(1);
});
