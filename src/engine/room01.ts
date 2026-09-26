import * as THREE from "three";

/**
 * Room 01 measurements, transcribed from docs/ROOM01_SPEC.md (sections 2, 3, 9
 * and 10). These are the authoritative numbers: they were cross-checked against
 * both the Blender build script and the scene as three.js r186 loads it.
 *
 * Collider boxes are used instead of deriving them from geometry at runtime
 * because the spec includes things the mesh bounds cannot give us - walls are
 * 0.2 m thick shells sitting OUTSIDE the visible surfaces, and the doorway and
 * hallway are cut out of them. Room.verifyAgainstSpec() re-derives the floor
 * bounds from the GLB and warns if a re-export ever drifts from this file.
 */

export type SpecCollider = {
  name: string;
  kind: "structure" | "prop";
  min: readonly [number, number, number];
  max: readonly [number, number, number];
};

export const ROOM01 = {
  /** Room shell. Floor y = 0, ceiling y = 3, x and z both run -3..3. */
  shell: { xMin: -3, xMax: 3, zMin: -3, zMax: 3, floorY: 0, ceilingY: 3 },

  markers: {
    characterSpawn: new THREE.Vector3(0, 0, 0),
    cameraStart: new THREE.Vector3(0.55, 1.55, 2.35),
    cameraTarget: new THREE.Vector3(0, 1.05, 0),
  },

  /** Spec section 10: "capsule radius 0.3 m, height 1.75 m, eye height 1.6 m". */
  player: { radius: 0.3, height: 1.75, eyeHeight: 1.6, crouchEyeHeight: 1.0 },

  door: {
    /** Door_Hinge is the animated node; Door is its child. */
    hingeNode: "Door_Hinge",
    slabNode: "Door",
    pivot: new THREE.Vector3(3.1, 0.005, -1.445),
    /** Degrees about +Y. Negative swings the door into the room. */
    angles: { closed: 0, rest: -14, open: -68 },
    clip: "Door_Creak",
    clipDuration: 4.583,
  },

  /** Walkable floor regions (spec section 10), as XZ rectangles. */
  walkable: {
    room: { xMin: -3, xMax: 3, zMin: -3, zMax: 3 },
    doorway: { xMin: 3, xMax: 3.18, zMin: -1.45, zMax: -0.55 },
    hallway: { xMin: 3.18, xMax: 7, zMin: -1.9, zMax: -0.1 },
  },

  /** Section 10, verbatim. Walk freely on the rug, papers and debris. */
  colliders: [
    { name: "wall_back", kind: "structure", min: [-3.2, 0, -3.2], max: [3.2, 3, -3] },
    { name: "wall_front", kind: "structure", min: [-3.2, 0, 3], max: [3.2, 3, 3.2] },
    { name: "wall_left", kind: "structure", min: [-3.2, 0, -3.2], max: [-3, 3, 3.2] },
    { name: "wall_right_back", kind: "structure", min: [3, 0, -3.2], max: [3.2, 3, -1.45] },
    { name: "wall_right_front", kind: "structure", min: [3, 0, -0.55], max: [3.2, 3, 3.2] },
    { name: "door_lintel", kind: "structure", min: [3, 2.1, -1.45], max: [3.2, 3, -0.55] },
    { name: "hall_wall_back", kind: "structure", min: [3.18, 0, -2.1], max: [7.2, 2.7, -1.9] },
    { name: "hall_wall_front", kind: "structure", min: [3.18, 0, -0.1], max: [7.2, 2.7, 0.1] },
    { name: "hall_end", kind: "structure", min: [7, 0, -1.9], max: [7.2, 2.7, -0.1] },
    { name: "door_reveal_back", kind: "structure", min: [3, 0, -1.9], max: [3.18, 2.7, -1.45] },
    { name: "door_reveal_front", kind: "structure", min: [3, 0, -0.55], max: [3.18, 2.7, -0.1] },
    { name: "Bed", kind: "prop", min: [-2.975, 0, -2.955], max: [-1.89, 1.205, -0.865] },
    { name: "Wardrobe", kind: "prop", min: [2.292, -0.017, 1.21], max: [2.978, 2.127, 2.49] },
    { name: "Desk", kind: "prop", min: [1.425, 0, -2.97], max: [2.775, 0.78, -2.37] },
    { name: "Chair", kind: "prop", min: [0.646, 0, -2.182], max: [1.473, 0.481, -1.282] },
    { name: "Radiator", kind: "prop", min: [-0.55, 0, 2.83], max: [0.618, 0.78, 2.93] },
    { name: "Frame_Fallen", kind: "prop", min: [-2.991, 0, 1.24], max: [-2.769, 0.762, 1.96] },
  ] as const satisfies readonly SpecCollider[],

  /** Section 11 match checklist - surfaced in the HUD stats. */
  expected: { meshes: 60, triangles: 15488, characterHeight: 1.764 },
} as const;

export function specColliderBoxes(): THREE.Box3[] {
  return ROOM01.colliders.map(
    (c) => new THREE.Box3(new THREE.Vector3(...c.min), new THREE.Vector3(...c.max)),
  );
}

/** The room only, as a Box3 spanning floor to ceiling - the confinement volume. */
export function roomBounds(): THREE.Box3 {
  const s = ROOM01.shell;
  return new THREE.Box3(
    new THREE.Vector3(s.xMin, s.floorY, s.zMin),
    new THREE.Vector3(s.xMax, s.ceilingY, s.zMax),
  );
}
