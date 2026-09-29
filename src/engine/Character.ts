import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { loadGLB, loadFromFileMap, disposeObject } from "./loaders";

/**
 * The figure in the middle of the room. Parented to the room's CharacterSpawn
 * node, so the room's own transform decides where it stands.
 */
export class Character {
  readonly root: THREE.Object3D;
  readonly clips: THREE.AnimationClip[];
  /** Height as authored, before auto-scaling. */
  authoredHeight = 0;
  /** World-space blocker so the player cannot walk through it. */
  readonly collider = new THREE.Box3();

  private mixer: THREE.AnimationMixer | null;
  private current: THREE.AnimationAction | null = null;
  private scale = 1;

  private constructor(gltf: GLTF) {
    this.root = gltf.scene;
    this.clips = gltf.animations;
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh & { isSkinnedMesh?: boolean };
      if (!mesh.isMesh && !mesh.isSkinnedMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (mesh.isSkinnedMesh) mesh.frustumCulled = false; // skinned bounds are often wrong
    });
    this.mixer = this.clips.length ? new THREE.AnimationMixer(this.root) : null;
  }

  static async fromURL(url: string): Promise<Character> {
    return new Character(await loadGLB(url));
  }

  /** Dropped or picked files: a .glb, or a .gltf with its .bin and textures. */
  static async fromFiles(files: File[]): Promise<Character> {
    const main = files.find((f) => /\.(glb|gltf)$/i.test(f.name));
    if (!main) throw new Error("Pick a .glb, or a .gltf together with its .bin and texture files.");
    const map = new Map(files.map((f) => [f.name, URL.createObjectURL(f)]));
    const gltf = await loadFromFileMap(map.get(main.name)!, map);
    for (const url of map.values()) URL.revokeObjectURL(url);
    return new Character(gltf);
  }

  /**
   * Feet on the floor, centred on the spawn point. Auto-scale only kicks in
   * when the authored height is implausible, which catches centimetre-scale
   * exports without touching correctly sized models.
   */
  fit(autoScale: boolean, targetHeight = 1.75): void {
    this.root.scale.setScalar(1);
    this.root.position.set(0, 0, 0);
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.root, true);
    // Centre it in its parent's space, so a parent placed off the spawn point (a second chair) keeps its offset.
    if (this.root.parent) box.applyMatrix4(this.root.parent.matrixWorld.clone().invert());
    const size = box.getSize(new THREE.Vector3());
    this.authoredHeight = size.y;

    this.scale = autoScale && (size.y < 1.2 || size.y > 2.6) ? targetHeight / size.y : 1;
    this.root.scale.setScalar(this.scale);
    const centre = box.getCenter(new THREE.Vector3());
    this.root.position.set(-centre.x * this.scale, -box.min.y * this.scale, -centre.z * this.scale);
    this.root.updateMatrixWorld(true);
    this.refreshCollider();
  }

  /**
   * A footprint box, capped so an animation with outstretched arms cannot turn
   * the figure into a wall. It still has to cover the chair character's
   * 0.86 x 0.92 m footprint, or the player walks into its legs and feet.
   */
  refreshCollider(): void {
    this.collider.setFromObject(this.root, true);
    const centre = this.collider.getCenter(new THREE.Vector3());
    const maxHalf = 0.47;
    this.collider.min.x = Math.max(this.collider.min.x, centre.x - maxHalf);
    this.collider.max.x = Math.min(this.collider.max.x, centre.x + maxHalf);
    this.collider.min.z = Math.max(this.collider.min.z, centre.z - maxHalf);
    this.collider.max.z = Math.min(this.collider.max.z, centre.z + maxHalf);
  }

  get height(): number {
    return this.authoredHeight * this.scale;
  }

  get scaled(): boolean {
    return this.scale !== 1;
  }

  get clipNames(): string[] {
    return this.clips.map((c, i) => c.name || `Clip ${i + 1}`);
  }

  /** Prefers an idle-looking clip, which is what a standing figure wants. */
  get defaultClipIndex(): number {
    const idle = this.clips.findIndex((c) => /idle|breath|stand|sway/i.test(c.name));
    return this.clips.length ? (idle >= 0 ? idle : 0) : -1;
  }

  playClip(index: number, fade = 0.3): void {
    if (!this.mixer || !this.clips[index]) return;
    const next = this.mixer.clipAction(this.clips[index]);
    if (this.current === next) return;
    next.reset().fadeIn(fade).play();
    this.current?.fadeOut(fade);
    this.current = next;
  }

  update(dt: number): void {
    this.mixer?.update(dt);
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    disposeObject(this.root);
    this.root.removeFromParent();
  }
}
