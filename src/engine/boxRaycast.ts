import * as THREE from "three";

const hit = new THREE.Vector3();

/**
 * Make a heavy object answer raycasts with a box instead of its triangles.
 *
 * A ray that reaches a mesh's bounding sphere is tested against every
 * triangle: the two chair figures are 70k each, which made the 30 Hz
 * interaction ray cost 23 ms whenever the player looked at them, and a
 * skinned mesh also re-skins every vertex it tests. The box is what the
 * player collides with anyway, and is plenty for "what is under the
 * crosshair" and "what did the bullet hit".
 *
 * One visible mesh reports the hit, so the weapon still sees something
 * solid; the rest stop answering. The box is read live, so a collider the
 * owner moves in place every frame works.
 */
export function raycastAsBox(root: THREE.Object3D, box: THREE.Box3): void {
  let reporter: THREE.Mesh | null = null;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!reporter && mesh.visible) reporter = mesh;
    else mesh.raycast = () => {};
  });
  const self = reporter as THREE.Mesh | null;
  if (!self) return;
  self.raycast = (raycaster, intersects) => {
    if (box.isEmpty() || !raycaster.ray.intersectBox(box, hit)) return;
    const distance = raycaster.ray.origin.distanceTo(hit);
    if (distance < raycaster.near || distance > raycaster.far) return;
    intersects.push({ distance, point: hit.clone(), object: self });
  };
}
