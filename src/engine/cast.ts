/**
 * Who is in Room 01 and where, for the story: two accused tied to chairs
 * under the bulb, and the entity that roams around them. Positions are in
 * CharacterSpawn space (the centre of the rug; the player starts at +Z).
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
    examine: "Tied to the chair. His lab badge is still clipped to his collar: the same lab she worked in.",
  },
];

export const ENTITY = {
  url: "models/entity.glb",
  /** Standing height; the model is authored at 2.88 m and the ceiling is at 3 m. */
  height: 2.4,
  /** Metres per second while gliding. */
  speed: 0.42,
  /** Footprint half-size for its collider and for keeping clear of furniture. */
  radius: 0.36,
  /** It never paths closer than this to the player. */
  personalSpace: 1.3,
  credit: '"Scary Creature" by shedmon (sketchfab.com/shedmon), CC BY 4.0',
} as const;
