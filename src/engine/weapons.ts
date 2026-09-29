/** Start and end, in seconds, of one action inside a model's single baked animation. */
export type ClipRange = [number, number];

/**
 * An animated first-person model: arms and gun rigged together, with every
 * action baked into one timeline (as Sketchfab FPS packs usually are), cut
 * into clips here. The rig is placed in viewmodel-camera space by `scale`,
 * a half-turn about Y (the packs face +Z), `rotation` and `offset`.
 */
export type ViewmodelDef = {
  url: string;
  scale: number;
  offset: [number, number, number];
  /** Extra pitch, yaw and roll (radians) after the half-turn. */
  rotation: [number, number, number];
  clips: {
    draw: ClipRange;
    idle: ClipRange;
    fire: ClipRange;
    reload: ClipRange;
    reloadEmpty: ClipRange;
    inspect: ClipRange;
    holster: ClipRange;
  };
  /** Bone the muzzle flash and ejected brass follow. */
  gunBone: string;
  credit: string;
};

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
  viewmodel?: ViewmodelDef;
};

export const PISTOL: WeaponDef = {
  id: "pistol",
  name: "Beretta 92",
  magSize: 15,
  reserve: 60,
  fireInterval: 0.17,
  // Match the model's reload clips (2.6 s, and 4.05 s played 1.25x faster).
  reloadTime: 2.6,
  reloadEmptyTime: 3.24,
  spreadStand: 0.0035,
  spreadMove: 0.035,
  spreadAir: 0.09,
  spreadFire: 0.012,
  recoverRate: 3.2,
  kickPitch: 0.024,
  kickYaw: 0.007,
  range: 60,
  viewmodel: {
    url: "models/beretta_viewmodel.glb",
    // A Beretta 92 is 217 mm long; the pack's gun measures 0.634 units.
    scale: 0.342,
    // Eye just above the gun and pitched over it, as the pack was animated to be seen.
    offset: [0.02, -0.09, -0.03],
    rotation: [0.1, 0.1, 0.05],
    clips: {
      draw: [0, 1.2],
      idle: [6.5, 7.5],
      fire: [7.5, 8.05],
      reload: [8.3, 10.9],
      reloadEmpty: [12.0, 16.05],
      inspect: [1.6, 6.6],
      holster: [16.33, 16.83],
    },
    gunBone: "ARMA_043",
    credit: '"Beretta Pistol FPS ANIMATION" by BURNER (sketchfab.com/Alexander_Ovelar), CC BY 4.0',
  },
};
