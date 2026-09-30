import * as THREE from "three";
import type { Interactable } from "../Interact";

/** Authored room contract. Future graph edges connect ports; they do not build furniture. */
export interface HouseSection {
  readonly root: THREE.Group;
  readonly bounds: THREE.Box3;
  readonly colliders: THREE.Box3[];
  readonly dustOrigin: THREE.Vector3;
  readonly spawn: THREE.Vector3;
  readonly lookAt: THREE.Vector3;
  readonly ports: readonly { id: string; position: THREE.Vector3; outward: THREE.Vector3; width: number; height: number }[];
  readonly interactions: Interactable[];
  dispose(): void;
}
