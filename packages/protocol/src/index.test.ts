import { describe, expect, it } from 'vitest';
import { CreateCharacter, Credentials, InputMessage, JoinOptions, PROTOCOL_VERSION } from './index';

describe('protocol', () => {
  it('validates input messages', () => {
    expect(InputMessage.safeParse({ seq: 1, left: true, right: false, jump: false }).success).toBe(
      true,
    );
    expect(
      InputMessage.safeParse({ seq: 2 ** 31, left: true, right: false, jump: false }).success,
    ).toBe(false);
    expect(InputMessage.safeParse({ seq: -1, left: true, right: false, jump: false }).success).toBe(
      false,
    );
    expect(InputMessage.safeParse({ seq: 1, left: 'yes', right: false, jump: false }).success).toBe(
      false,
    );
  });

  it('rejects mismatched protocol versions', () => {
    const characterId = '7f0c8f2e-3a8e-4c39-9a5b-0e8c6a1f2b3d';
    expect(JoinOptions.safeParse({ characterId, protocolVersion: PROTOCOL_VERSION }).success).toBe(
      true,
    );
    expect(
      JoinOptions.safeParse({ characterId, protocolVersion: PROTOCOL_VERSION + 1 }).success,
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
});
