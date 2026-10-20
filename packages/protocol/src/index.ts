// Typed, validated, versioned contracts between web client, API, and game server.
// See docs/protocols/NETWORK_PROTOCOL.md. Bump PROTOCOL_VERSION on any breaking change.
import { CLASS_IDS } from '@cindervale/content';
import { z } from 'zod';

export const PROTOCOL_VERSION = 1;

// ---- HTTP API ----

export const Credentials = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{3,16}$/, '3-16 letters, digits or _'),
  password: z.string().min(8).max(128),
});
export type Credentials = z.infer<typeof Credentials>;

export const AuthResponse = z.object({ token: z.string() });
export type AuthResponse = z.infer<typeof AuthResponse>;

export const CreateCharacter = z.object({
  name: z.string().regex(/^[a-zA-Z0-9]{3,12}$/, '3-12 letters or digits'),
  classId: z.enum(CLASS_IDS),
});
export type CreateCharacter = z.infer<typeof CreateCharacter>;

export const CharacterSummary = z.object({
  id: z.uuid(),
  name: z.string(),
  classId: z.enum(CLASS_IDS),
  level: z.number().int(),
  mapId: z.string(),
});
export type CharacterSummary = z.infer<typeof CharacterSummary>;

// ---- Game server (Colyseus) ----

export const ROOM_MAP = 'map';

export const JoinOptions = z.object({
  characterId: z.uuid(),
  protocolVersion: z.literal(PROTOCOL_VERSION),
});
export type JoinOptions = z.infer<typeof JoinOptions>;

export const ClientMessage = { Input: 'input' } as const;

/** One fixed simulation step of input. `seq` increases by 1 per step. */
export const InputMessage = z.object({
  seq: z
    .number()
    .int()
    .nonnegative()
    .max(2 ** 31 - 1), // synced back as int32 lastSeq
  left: z.boolean(),
  right: z.boolean(),
  jump: z.boolean(),
});
export type InputMessage = z.infer<typeof InputMessage>;

/** Synced per-player state (mirrors the server's Colyseus schema). */
export interface PlayerView {
  characterId: string;
  name: string;
  classId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  /** Last input seq the server applied; used for client reconciliation. */
  lastSeq: number;
}
