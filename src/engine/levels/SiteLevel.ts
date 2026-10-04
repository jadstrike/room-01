import * as THREE from "three";
import { Device } from "../house/Device";
import type { Examinable, ProceduralSection } from "../house/ProceduralSection";
import type { WalkRect } from "../Player";
import type { DebugBox, Level } from "./Level";
import { ROOMS } from "./rooms";

/** How far the practical light dips when the flicker cuts out: it is not Room 01's bulb. */
const FLICKER_DEPTH = 0.55;

/**
 * One room of a site. Nothing in it moves, so its shadows are drawn once on
 * entry; it is cheap to build, so it is disposed on leaving rather than kept.
 */
export class SiteLevel implements Level {
  readonly persistent = false;
  readonly dynamicShadows = false;
  readonly root = new THREE.Group();
  readonly confine: WalkRect;
  /** The device, while it is still on the wall here. */
  device: Device | null = null;
  private keyLight: THREE.PointLight | null = null;
  private keyIntensity = 0;

  private constructor(
    readonly id: string,
    readonly section: ProceduralSection,
  ) {
    section.finalize();
    this.root.name = `Site_${id}`;
    this.root.add(section.root);
    const b = section.bounds;
    this.confine = { xMin: b.min.x, xMax: b.max.x, zMin: b.min.z, zMax: b.max.z };
    section.root.traverse((o) => {
      if (!this.keyLight && o instanceof THREE.PointLight && o.castShadow) this.keyLight = o;
    });
    this.keyIntensity = this.keyLight?.intensity ?? 0;
  }

  /** Build room `id`, with the device on the wall if it is still waiting there. */
  static create(id: string, device: { label: string; style: "brass" | "tablet" } | null): SiteLevel {
    const build = ROOMS[id];
    if (!build) throw new Error(`No room is built for "${id}"`);
    const level = new SiteLevel(id, build());
    if (device) {
      const d = new Device(level.section.ports[0], device.label, device.style);
      d.finalize();
      level.device = d;
      level.root.add(d.root);
    }
    return level;
  }

  get bounds(): THREE.Box3 {
    return this.section.bounds;
  }

  get colliders(): THREE.Box3[] {
    return this.section.colliders;
  }

  get spawn(): THREE.Vector3 {
    return this.section.spawn;
  }

  get lookAt(): THREE.Vector3 {
    return this.section.lookAt;
  }

  get lightPosition(): THREE.Vector3 {
    return this.section.dustOrigin;
  }

  get examinables(): readonly Examinable[] {
    return this.section.examinables;
  }

  get exit(): Examinable | null {
    return this.section.exit;
  }

  /** Taken off the wall. */
  removeDevice(): void {
    this.device?.dispose();
    this.device = null;
  }

  setLightLevel(level: number): void {
    if (this.keyLight) this.keyLight.intensity = this.keyIntensity * (1 - FLICKER_DEPTH + FLICKER_DEPTH * level);
  }

  raycastRoots(): THREE.Object3D[] {
    return [this.root];
  }

  update(): void {}

  debugBoxes(): DebugBox[] {
    return [{ box: this.bounds, color: 0x4ad3a1 }, ...this.colliders.map((box) => ({ box, color: 0x8e1b17 }))];
  }

  dispose(): void {
    this.device?.dispose();
    this.section.dispose();
    this.root.removeFromParent();
  }
}
