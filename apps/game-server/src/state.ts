import { schema, t } from '@colyseus/schema';

// Field names mirror PlayerView in @cindervale/protocol.
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
  },
  'PlayerState',
);
export type PlayerState = InstanceType<typeof PlayerState>;

export const MapState = schema(
  {
    mapId: t.string(),
    players: t.map(PlayerState),
  },
  'MapState',
);
export type MapState = InstanceType<typeof MapState>;
