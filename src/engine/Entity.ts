import * as THREE from "three";
import { loadGLB, disposeObject } from "./loaders";
import { ENTITY } from "./cast";

type Rect = { xMin: number; xMax: number; zMin: number; zMax: number };

export type EntityContext = {
  /** The player's feet. */
  player: THREE.Vector3;
  /** Everything it must not glide through: walls, furniture, the chairs. */
  obstacles: readonly THREE.Box3[];
  /** Where it may stand. */
  area: Rect;
  /** The bulb's flicker level, 0 dark .. 1 lit. */
  light: number;
};

type State = "glide" | "stare";

/**
 * The 4D entity. It has only an idle animation, so it does not walk: it
 * glides, feet still, between clear spots in the room, stops to stare at
 * the player, and when the bulb dies it is somewhere else when it comes
 * back. It keeps its distance and never paths through furniture.
 */
export class Entity {
  readonly root = new THREE.Group();
  /** World-space blocker, moved with it every frame. */
  readonly collider = new THREE.Box3();

  private mixer: THREE.AnimationMixer;
  private state: State = "stare";
  private target = new THREE.Vector3();
  private wait = 2;
  private yaw = 0;
  private darkFor = 0;
  private tmp = new THREE.Vector3();
  private toPlayer = new THREE.Vector3();

  private constructor(model: THREE.Object3D, clip: THREE.AnimationClip | undefined, scale: number) {
    model.scale.setScalar(scale);
    this.root.add(model);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Skinned bounds are often wrong, and it is never far from view.
      mesh.frustumCulled = false;
    });
    this.mixer = new THREE.AnimationMixer(model);
    if (clip) this.mixer.clipAction(clip).play();
  }

  static async load(): Promise<Entity> {
    const gltf = await loadGLB(`${import.meta.env.BASE_URL}${ENTITY.url}`);
    const model = gltf.scene;
    const clip = gltf.animations[0];
    // Measure in the posed rig: the file's static bounds do not account for the skeleton.
    const mixer = new THREE.AnimationMixer(model);
    if (clip) mixer.clipAction(clip).play();
    mixer.update(0);
    model.updateMatrixWorld(true);
    const height = new THREE.Box3().setFromObject(model, true).getSize(new THREE.Vector3()).y;
    mixer.stopAllAction();
    return new Entity(model, clip, height > 0.1 ? ENTITY.height / height : 1);
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  /** Put it somewhere, facing a point. */
  place(at: THREE.Vector3, facing: THREE.Vector3): void {
    this.root.position.set(at.x, 0, at.z);
    this.yaw = Math.atan2(facing.x - at.x, facing.z - at.z);
    this.root.rotation.y = this.yaw;
    this.state = "stare";
    this.wait = 1.5 + Math.random() * 2;
    this.updateCollider();
  }

  /** Vanish and reappear elsewhere, facing the player. */
  blink(ctx: EntityContext): boolean {
    const spot = this.pickSpot(ctx, false);
    if (!spot) return false;
    this.place(spot, ctx.player);
    return true;
  }

  update(dt: number, ctx: EntityContext): void {
    this.mixer.update(dt);

    // The dark is when it moves in four dimensions: once per blackout, not
    // on every blink of a stutter, and not every time.
    if (ctx.light < 0.15) {
      const before = this.darkFor;
      this.darkFor += dt;
      if (before < 0.3 && this.darkFor >= 0.3 && Math.random() < 0.7) this.blink(ctx);
    } else this.darkFor = 0;

    this.toPlayer.subVectors(ctx.player, this.root.position).setY(0);
    const playerDist = this.toPlayer.length();

    if (this.state === "stare") {
      this.turnTowards(Math.atan2(this.toPlayer.x, this.toPlayer.z), dt, 1.6);
      this.wait -= dt;
      if (this.wait <= 0) {
        const spot = this.pickSpot(ctx, true);
        if (spot) {
          this.target.copy(spot);
          this.state = "glide";
        } else this.wait = 1;
      }
    } else {
      this.tmp.subVectors(this.target, this.root.position).setY(0);
      const dist = this.tmp.length();
      const step = Math.min(dist, ENTITY.speed * dt);
      const next = this.root.position.clone().addScaledVector(this.tmp.normalize(), step);
      // If the player has stepped into its way, it stops and looks at them instead.
      if (dist < 0.05 || next.distanceTo(ctx.player) < ENTITY.personalSpace * 0.7 || playerDist < ENTITY.personalSpace * 0.7) {
        this.state = "stare";
        this.wait = 2 + Math.random() * 3;
      } else {
        this.root.position.copy(next);
        this.turnTowards(Math.atan2(this.tmp.x, this.tmp.z), dt, 2.2);
      }
    }
    this.root.rotation.y = this.yaw;
    this.updateCollider();
  }

  private turnTowards(target: number, dt: number, rate: number): void {
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * rate);
  }

  private updateCollider(): void {
    const r = ENTITY.radius;
    const p = this.root.position;
    this.collider.min.set(p.x - r, 0, p.z - r);
    this.collider.max.set(p.x + r, ENTITY.height, p.z + r);
  }

  /** A random clear spot away from the player; with `reachable`, one it can glide to in a straight line. */
  private pickSpot(ctx: EntityContext, reachable: boolean): THREE.Vector3 | null {
    const margin = ENTITY.radius + 0.15;
    const a = ctx.area;
    for (let attempt = 0; attempt < 40; attempt++) {
      const spot = new THREE.Vector3(
        THREE.MathUtils.lerp(a.xMin + margin, a.xMax - margin, Math.random()),
        0,
        THREE.MathUtils.lerp(a.zMin + margin, a.zMax - margin, Math.random()),
      );
      if (spot.distanceTo(this.root.position) < 1 || spot.distanceTo(ctx.player) < ENTITY.personalSpace + 0.4) continue;
      if (!this.clear(spot, ctx)) continue;
      if (reachable && !this.pathClear(this.root.position, spot, ctx)) continue;
      return spot;
    }
    return null;
  }

  private clear(p: THREE.Vector3, ctx: EntityContext): boolean {
    const r = ENTITY.radius + 0.1;
    for (const b of ctx.obstacles) {
      if (b === this.collider || b.max.y < 0.15) continue;
      if (p.x > b.min.x - r && p.x < b.max.x + r && p.z > b.min.z - r && p.z < b.max.z + r) return false;
    }
    return true;
  }

  private pathClear(from: THREE.Vector3, to: THREE.Vector3, ctx: EntityContext): boolean {
    const steps = Math.ceil(from.distanceTo(to) / 0.2);
    const p = new THREE.Vector3();
    for (let i = 1; i <= steps; i++) {
      p.lerpVectors(from, to, i / steps);
      if (!this.clear(p, ctx) || p.distanceTo(ctx.player) < ENTITY.personalSpace) return false;
    }
    return true;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    disposeObject(this.root);
    this.root.removeFromParent();
  }
}
