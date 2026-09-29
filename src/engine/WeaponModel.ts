import * as THREE from "three";
import { loadGLB, disposeObject } from "./loaders";
import type { ViewmodelDef } from "./weapons";

const FPS = 30;
const FADE = 0.12;

export type ModelAction = keyof ViewmodelDef["clips"];

/**
 * An animated first-person arms-and-gun rig. Every action is cut from the
 * model's single baked timeline; one-shots (draw, fire, reloads, inspect)
 * fade back to a looping idle when they finish.
 */
export class WeaponModel {
  /** Mount this in viewmodel-camera space; it carries the def's placement. */
  readonly object = new THREE.Group();
  /** Follow the muzzle and the ejection port (in gun-bone space) as the rig animates. */
  readonly muzzle = new THREE.Object3D();
  readonly port = new THREE.Object3D();

  private mixer: THREE.AnimationMixer;
  private actions = new Map<ModelAction, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;

  private constructor(
    private def: ViewmodelDef,
    private root: THREE.Object3D,
    clip: THREE.AnimationClip,
  ) {
    this.object.add(root);
    this.object.scale.setScalar(def.scale);
    this.object.rotation.set(def.rotation[0], Math.PI + def.rotation[1], def.rotation[2]);
    this.object.position.fromArray(def.offset);

    root.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      // Skinned bounds are wrong once the arms move; the rig is always in view anyway.
      mesh.frustumCulled = false;
    });

    this.mixer = new THREE.AnimationMixer(root);
    for (const [name, [start, end]] of Object.entries(def.clips) as [ModelAction, [number, number]][]) {
      const sub = THREE.AnimationUtils.subclip(clip, name, Math.round(start * FPS), Math.round(end * FPS), FPS);
      const action = this.mixer.clipAction(sub);
      if (name === "idle") {
        // Ping-pong so the ends of the idle cut never pop against each other.
        action.setLoop(THREE.LoopPingPong, Infinity);
      } else {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions.set(name, action);
    }
    this.mixer.addEventListener("finished", (e) => {
      if (e.action === this.current && e.action !== this.actions.get("holster")) this.play("idle");
    });

    this.placeAnchors();
    this.play("idle", 0);
  }

  static async load(def: ViewmodelDef): Promise<WeaponModel> {
    const gltf = await loadGLB(`${import.meta.env.BASE_URL}${def.url}`);
    const clip = gltf.animations[0];
    if (!clip) throw new Error(`${def.url} has no animation`);
    return new WeaponModel(def, gltf.scene, clip);
  }

  /**
   * Finds the muzzle (the front of the gun mesh) and a point on top of the
   * slide for the ejection port, at the idle pose, and parents both to the gun
   * bone so they follow every animation.
   */
  private placeAnchors(): void {
    let bone: THREE.Object3D | undefined;
    let gun: THREE.SkinnedMesh | undefined;
    this.root.traverse((o) => {
      if (!bone && o.name.startsWith(this.def.gunBone)) bone = o;
      const skinned = o as THREE.SkinnedMesh;
      // The gun is the skinned mesh driven by the gun's handful of bones, not the arms' dozens.
      if (skinned.isSkinnedMesh && (!gun || skinned.skeleton.bones.length < gun.skeleton.bones.length)) gun = skinned;
    });
    if (!bone || !gun) return;

    this.mixer.setTime(0);
    this.actions.get("idle")!.reset().play();
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    gun.skeleton.update();

    // Work in the rig's own space so the fit does not depend on where it is mounted.
    const toRig = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const pts: THREE.Vector3[] = [];
    const v = new THREE.Vector3();
    const pos = gun.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      gun.getVertexPosition(i, v);
      pts.push(v.clone().applyMatrix4(gun.matrixWorld).applyMatrix4(toRig));
    }
    const maxZ = Math.max(...pts.map((p) => p.z));
    const minZ = Math.min(...pts.map((p) => p.z));
    const front = pts.filter((p) => p.z > maxZ - 0.012);
    const muzzle = front.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / front.length);
    const midZ = minZ + (maxZ - minZ) * 0.45;
    const slide = pts.filter((p) => Math.abs(p.z - midZ) < 0.03);
    const top = slide.reduce((a, p) => (p.y > a.y ? p : a), slide[0]);
    const port = top.clone();
    port.x = Math.min(...slide.map((p) => p.x));

    const toBone = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(this.root.matrixWorld);
    this.muzzle.position.copy(muzzle).applyMatrix4(toBone);
    this.port.position.copy(port).applyMatrix4(toBone);
    bone.add(this.muzzle, this.port);
  }

  /**
   * Cross-fades to an action. `seconds` stretches a clip to a gameplay
   * duration (reloads), so the animation always ends when the ammo lands.
   */
  play(name: ModelAction, fade = FADE, seconds?: number): void {
    const next = this.actions.get(name);
    if (!next) return;
    const length = next.getClip().duration;
    next.reset();
    next.setEffectiveTimeScale(seconds ? length / seconds : 1);
    next.setEffectiveWeight(1);
    if (this.current && this.current !== next) {
      next.crossFadeFrom(this.current, fade, false);
    }
    next.play();
    this.current = next;
  }

  get playing(): ModelAction | null {
    for (const [name, action] of this.actions) if (action === this.current) return name;
    return null;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    disposeObject(this.root);
    this.object.removeFromParent();
  }
}
