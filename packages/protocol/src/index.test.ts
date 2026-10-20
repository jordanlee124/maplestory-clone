import { describe, expect, it } from 'vitest';
import {
  AttackRequest,
  CreateCharacter,
  Credentials,
  InputMessage,
  JoinOptions,
  PickupRequest,
  PROTOCOL_VERSION,
  RespawnRequest,
} from './index';

describe('protocol', () => {
  it('validates input messages', () => {
    expect(
      InputMessage.safeParse({
        seq: 1,
        left: true,
        right: false,
        up: false,
        down: false,
        jump: false,
      }).success,
    ).toBe(true);
    expect(
      InputMessage.safeParse({
        seq: 2 ** 31,
        left: true,
        right: false,
        up: false,
        down: false,
        jump: false,
      }).success,
    ).toBe(false);
    expect(
      InputMessage.safeParse({
        seq: -1,
        left: true,
        right: false,
        up: false,
        down: false,
        jump: false,
      }).success,
    ).toBe(false);
    expect(
      InputMessage.safeParse({
        seq: 1,
        left: 'yes',
        right: false,
        up: false,
        down: false,
        jump: false,
      }).success,
    ).toBe(false);
  });

  it('rejects mismatched protocol versions', () => {
    const characterId = '7f0c8f2e-3a8e-4c39-9a5b-0e8c6a1f2b3d';
    expect(
      JoinOptions.safeParse({ characterId, mapId: 'm', protocolVersion: PROTOCOL_VERSION }).success,
    ).toBe(true);
    expect(
      JoinOptions.safeParse({ characterId, mapId: 'm', protocolVersion: PROTOCOL_VERSION + 1 })
        .success,
    ).toBe(false);
  });

  it('validates credentials and character names', () => {
    expect(Credentials.safeParse({ username: 'ab', password: 'longenough' }).success).toBe(false);
    expect(Credentials.safeParse({ username: 'hero_1', password: 'longenough' }).success).toBe(
      true,
    );
    expect(CreateCharacter.safeParse({ name: 'Ash', classId: 'runewaver' }).success).toBe(true);
    expect(CreateCharacter.safeParse({ name: 'Ash', classId: 'pirate' }).success).toBe(false);
  });

  it('validates combat and loot requests', () => {
    expect(
      AttackRequest.safeParse({ requestId: 1, skillId: 'basic-attack', facing: 'left' }).success,
    ).toBe(true);
    for (const bad of [
      { requestId: 1, skillId: 'basic-attack', facing: 'up' },
      { requestId: -1, skillId: 'basic-attack', facing: 'left' },
      { requestId: 1, skillId: '', facing: 'left' },
      { requestId: 1, skillId: 'x'.repeat(65), facing: 'left' },
      { requestId: 1, skillId: 'basic-attack', facing: 'left', damage: 9999 },
    ]) {
      // Unknown keys (like a client-claimed damage) are stripped, never trusted.
      const r = AttackRequest.safeParse(bad);
      if (r.success) expect(r.data).not.toHaveProperty('damage');
      else expect(r.success).toBe(false);
    }
    expect(
      AttackRequest.safeParse({ requestId: 1, skillId: 'basic-attack', facing: 'up' }).success,
    ).toBe(false);
    expect(PickupRequest.safeParse({ dropId: 'd1' }).success).toBe(true);
    expect(PickupRequest.safeParse({ dropId: 42 }).success).toBe(false);
    expect(RespawnRequest.safeParse({ hp: 999 }).success).toBe(false);
  });
});
