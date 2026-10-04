import * as THREE from "three";
import { Procedural, type Port } from "./ProceduralSection";

/**
 * The thing that folds a site into a new arrangement, mounted on the wall
 * beside a room's exit door, outside the furniture footprints.
 */
export class Device extends Procedural {
  readonly object: THREE.Object3D;

  constructor(port: Port, label: string, style: "brass" | "tablet") {
    super("device");
    this.root.name = "Site_Device";
    const z = port.position.z;
    const body = style === "brass" ? this.material(0xa38b5b, undefined, 0.6) : this.material(0x2b3033, undefined, 0.3);
    const screen = this.own(new THREE.MeshStandardMaterial({ color: 0x1f3a33, emissive: 0x74b8a2, emissiveIntensity: 0.6 }));
    this.box("Device_Housing", 0.92, 1.25, z - 0.19, 0.35, 0.44, 0.13, body);
    this.box("Device_Display", 0.92, 1.31, z - 0.265, 0.25, 0.19, 0.025, screen);
    const knob = this.cylinder("Device_Dial", 0.92, 1.12, z - 0.28, 0.04, 0.025, body);
    knob.rotation.x = Math.PI / 2;
    this.object = this.root;
    this.examinables.push({ id: "device", object: this.root, label, text: "" });
  }
}
