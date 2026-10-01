import * as THREE from "three";
import { ProceduralSection } from "./ProceduralSection";

/** Mounted beside the hall door, outside the authored furniture footprints. */
export class HouseDevice extends ProceduralSection {
  readonly bounds = new THREE.Box3();
  readonly dustOrigin = new THREE.Vector3();
  readonly spawn = new THREE.Vector3();
  readonly lookAt = new THREE.Vector3();
  readonly ports = [];
  constructor(z: number, use: () => void) {
    super(); this.root.name = "House_Configuration_Device";
    const brass = this.material(0xa38b5b, undefined, 0.6), screen = this.material(0x74b8a2);
    this.box("Device_Housing", 0.92, 1.25, z - 0.19, 0.35, 0.44, 0.13, brass);
    this.box("Device_Display", 0.92, 1.31, z - 0.265, 0.25, 0.19, 0.025, screen);
    const knob = this.cylinder("Device_Dial", 0.92, 1.12, z - 0.28, 0.04, 0.025, brass); knob.rotation.x = Math.PI / 2;
    this.interactions.push({ id: "house:device", object: this.root, verb: "Use", label: "the brass device", range: 2.4, onInteract: use });
  }
}
