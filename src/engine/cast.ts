/**
 * Who is in Room 01 and where, for the story: two accused tied to chairs
 * under the bulb. Positions are in CharacterSpawn space (the centre of the
 * rug; the player starts at +Z).
 */
export type SeatDef = {
  id: string;
  label: string;
  /** Offset from CharacterSpawn, metres. */
  x: number;
  z: number;
  /** Turn about Y, radians; positive turns the figure's front towards -X. */
  yaw: number;
  examine: string;
};

export const SEATS: readonly SeatDef[] = [
  {
    id: "boyfriend",
    label: "The boyfriend",
    x: -0.62,
    z: 0,
    yaw: 0.14,
    examine: "Tied to the chair. The sign where his face should be does not move when he breathes.",
  },
  {
    id: "coworker",
    label: "The coworker",
    x: 0.62,
    z: 0,
    yaw: -0.14,
    examine: "Tied to the chair. Her lab badge is still clipped to the collar.",
  },
];
