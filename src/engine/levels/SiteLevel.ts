import * as THREE from "three";
import { Device } from "../house/Device";
import type { Examinable, ProceduralSection, Swing } from "../house/ProceduralSection";
import { Portal } from "./Portal";
import type { WalkRect } from "../Player";
import type { DebugBox, Level } from "./Level";
import { ROOMS } from "./rooms";

/** How far a site's light dips when the flicker cuts out: nearly to black, which is what the torch is for. */
const FLICKER_DEPTH = 0.85;
/** Sites are lit lower than they were built: the torch carries the rest. */
const DIM = 0.42;

/** How long the exit door takes to swing open on the portal before the room changes. */
export const EXIT_OPEN_MS = 750;

/**
 * One room of a site. Its shadows are drawn once on entry, and again only
 * while a door or a fridge is swinging; it is cheap to build, so it is
 * disposed on leaving rather than kept.
 */
export class SiteLevel implements Level {
  readonly persistent = false;
  readonly root = new THREE.Group();
  readonly confine: WalkRect;
  /** The device, while it is still on the wall here. */
  device: Device | null = null;
  private keyLight: THREE.PointLight | null = null;
  private keyIntensity = 0;
  /** The exit door on its hinge, and the fold behind it. */
  private exitSwing: Swing | null = null;
  private portal: Portal | null = null;
  private animating = false;
  /** Frames of shadow redraw left after the last movement, so the resting pose is what stays drawn. */
  private settle = 0;
  private time = 0;

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
    section.root.traverse((o) => {
      if (o instanceof THREE.Light) o.intensity *= DIM;
    });
    this.keyIntensity = this.keyLight?.intensity ?? 0;
    this.hingeExit();
  }

  /** Put the exit door on a hinge at its right-hand edge, and the portal in the doorway behind it. */
  private hingeExit(): void {
    const exit = this.section.exit;
    const port = this.section.ports[0];
    if (!exit || !port) return;
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(exit.object);
    const pivot = new THREE.Group();
    pivot.name = "Exit_Hinge";
    pivot.position.set(box.max.x, 0, (box.min.z + box.max.z) / 2);
    (exit.object.parent ?? this.section.root).add(pivot);
    pivot.updateMatrixWorld(true);
    pivot.attach(exit.object);
    // Into the room, short of the device on the wall beside the frame.
    this.exitSwing = { pivot, axis: "y", angle: -1.45, open: 0, target: 0, sound: "door" };

    this.portal = new Portal(port.width, port.height);
    this.portal.mesh.position.set(port.position.x, port.height / 2, port.position.z + 0.08);
    this.portal.mesh.rotation.y = Math.PI;
    this.section.root.add(this.portal.mesh);
  }

  /** Something moving casts moving shadows; otherwise they were drawn once. */
  get dynamicShadows(): boolean {
    return this.animating;
  }

  /** Swing open whatever belongs to examinable `id`. Returns its sound, if it moved. */
  open(id: string): Swing["sound"] | null {
    const swing = this.section.swings.get(id);
    if (!swing || swing.target === 1) return null;
    swing.target = 1;
    return swing.sound;
  }

  /** Open the exit door on the portal; resolves when it is open enough to step through. */
  openExit(): Promise<void> {
    if (this.exitSwing) this.exitSwing.target = 1;
    return new Promise((resolve) => setTimeout(resolve, EXIT_OPEN_MS));
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

  update(dt: number): void {
    this.time += dt;
    let moving = false;
    const swings = this.exitSwing ? [...this.section.swings.values(), this.exitSwing] : this.section.swings.values();
    for (const swing of swings) {
      if (Math.abs(swing.target - swing.open) < 0.001) continue;
      moving = true;
      swing.open += (swing.target - swing.open) * Math.min(1, dt * 4.5);
      const k = swing.open * swing.open * (3 - 2 * swing.open);
      swing.pivot.rotation[swing.axis] = swing.angle * k;
    }
    if (moving) this.settle = 3;
    this.animating = moving || this.settle-- > 0;
    this.portal?.update(this.time, this.exitSwing?.open ?? 0);
  }

  debugBoxes(): DebugBox[] {
    return [{ box: this.bounds, color: 0x4ad3a1 }, ...this.colliders.map((box) => ({ box, color: 0x8e1b17 }))];
  }

  dispose(): void {
    this.portal?.dispose();
    this.device?.dispose();
    this.section.dispose();
    this.root.removeFromParent();
  }
}
