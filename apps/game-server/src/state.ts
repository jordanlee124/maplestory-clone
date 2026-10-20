import { schema, t } from '@colyseus/schema';

// Field names mirror PlayerView / MonsterView / DropView in @cindervale/protocol.
// float64 keeps positions bit-identical to the server sim, so client reconciliation is exact.
export const PlayerState = schema(
  {
    characterId: t.string(),
    name: t.string(),
    classId: t.string(),
    x: t.float64(),
    y: t.float64(),
    vx: t.float64(),
    vy: t.float64(),
    grounded: t.boolean(),
    climbing: t.boolean(),
    lastSeq: t.int32(),
    level: t.uint16(),
    hp: t.int32(),
    maxHp: t.int32(),
    mp: t.int32(),
    maxMp: t.int32(),
    dead: t.boolean(),
  },
  'PlayerState',
);
export type PlayerState = InstanceType<typeof PlayerState>;

export const MonsterState = schema(
  {
    monsterId: t.string(),
    x: t.float64(),
    y: t.float64(),
    hp: t.int32(),
    maxHp: t.int32(),
    mode: t.string(),
    facing: t.int8(),
  },
  'MonsterState',
);
export type MonsterState = InstanceType<typeof MonsterState>;

export const DropState = schema(
  {
    dropId: t.string(),
    /** '' = currency. */
    itemId: t.string(),
    quantity: t.int32(),
    x: t.float64(),
    y: t.float64(),
    /** Character id with exclusive pickup rights; '' = anyone. */
    ownerId: t.string(),
  },
  'DropState',
);
export type DropState = InstanceType<typeof DropState>;

export const MapState = schema(
  {
    mapId: t.string(),
    players: t.map(PlayerState),
    monsters: t.map(MonsterState),
    drops: t.map(DropState),
  },
  'MapState',
);
export type MapState = InstanceType<typeof MapState>;
