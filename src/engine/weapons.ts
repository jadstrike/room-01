/**
 * Weapon tuning, in the terms Counter-Strike players already know: a magazine
 * and reserve, a minimum time between shots, and inaccuracy (the radius of the
 * spread cone, in radians) that grows while moving, airborne or firing fast.
 */
export type WeaponDef = {
  id: string;
  name: string;
  magSize: number;
  reserve: number;
  /** Seconds between shots; semi-automatic, so one per click. */
  fireInterval: number;
  reloadTime: number;
  /** Reload from empty also releases the locked-back slide. */
  reloadEmptyTime: number;
  spreadStand: number;
  spreadMove: number;
  spreadAir: number;
  /** Added per recent shot, recovering over `recoverRate` shots per second. */
  spreadFire: number;
  recoverRate: number;
  /** View punch per shot (radians), recovering on its own like CS aim punch. */
  kickPitch: number;
  kickYaw: number;
  range: number;
};

export const PISTOL: WeaponDef = {
  id: "pistol",
  name: "9mm Pistol",
  magSize: 13,
  reserve: 52,
  fireInterval: 0.17,
  reloadTime: 2.1,
  reloadEmptyTime: 2.5,
  spreadStand: 0.0035,
  spreadMove: 0.035,
  spreadAir: 0.09,
  spreadFire: 0.012,
  recoverRate: 3.2,
  kickPitch: 0.024,
  kickYaw: 0.007,
  range: 60,
};
