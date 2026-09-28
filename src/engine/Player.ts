import * as THREE from "three";
import { ROOM01 } from "./room01";

export type WalkRect = { xMin: number; xMax: number; zMin: number; zMax: number };

/**
 * First-person controller. Quake-style ground acceleration + friction (so the
 * feel is closer to Counter-Strike than to a lerped camera), pointer-lock mouse
 * look, and a circle-vs-AABB solver that keeps the player inside the room.
 *
 * Capsule dimensions come from docs/ROOM01_SPEC.md section 10.
 *
 * Containment is belt-and-braces on purpose: the spec's wall colliders push the
 * player out AND a confinement rectangle clamps the position every frame, so
 * neither an open door nor a corner can leak the camera through a wall. Clear
 * the confinement rectangle to let the player walk out into the hallway.
 */

const WALK = 2.5;
const SPRINT = 4.1;
const CROUCH = 1.15;
const ACCEL = 48;
const AIR_ACCEL = 9;
const FRICTION = 9.5;
const GRAVITY = 20;
const JUMP = 3.9;
const EYE_STAND = ROOM01.player.eyeHeight;
const EYE_CROUCH = ROOM01.player.crouchEyeHeight;
const RADIUS = ROOM01.player.radius;
const PITCH_LIMIT = THREE.MathUtils.degToRad(89);
const LOOK_SCALE = 0.0022; // rad per pixel at sensitivity 1
const STEP_DISTANCE = 0.95;

export type PlayerOptions = {
  sensitivity: number;
  headBob: boolean;
};

export class Player {
  /** Feet position. The camera sits at position.y + eye height. */
  readonly position = new THREE.Vector3(0, 0, 2);
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  /** Horizontal speed normalised to sprint speed - drives crosshair spread. */
  speed01 = 0;
  locked = false;
  onStep: ((hard: boolean) => void) | null = null;
  onLockChange: ((locked: boolean) => void) | null = null;

  private keys = new Set<string>();
  private bounds = new THREE.Box3(new THREE.Vector3(-3, 0, -3), new THREE.Vector3(3, 3, 3));
  /** Hard XZ clamp. null lets the wall colliders alone decide (hallway access). */
  private confine: WalkRect | null = ROOM01.walkable.room;
  private colliders: THREE.Box3[] = [];
  private grounded = true;
  private crouching = false;
  private eye = EYE_STAND;
  private bobPhase = 0;
  private stepAccum = 0;
  private reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private wish = new THREE.Vector3();
  private expanded = new THREE.Box3();
  /** Recoil view punch (pitch, yaw), decaying back to zero on its own. */
  private punchView = new THREE.Vector2();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private dom: HTMLElement,
    private options: PlayerOptions,
  ) {
    this.camera.rotation.order = "YXZ";
    this.dom.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  setOptions(patch: Partial<PlayerOptions>): void {
    Object.assign(this.options, patch);
  }

  setBounds(bounds: THREE.Box3): void {
    this.bounds = bounds;
  }

  setColliders(boxes: THREE.Box3[]): void {
    this.colliders = boxes;
  }

  /** Pass null to open up the doorway and hallway to the player. */
  setConfinement(rect: WalkRect | null): void {
    this.confine = rect;
  }

  /** Drop the player in at a position, facing a point of interest. */
  spawnAt(from: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.position.set(from.x, this.bounds.min.y, from.z);
    this.velocity.set(0, 0, 0);
    this.eye = EYE_STAND;
    const dx = lookAt.x - from.x;
    const dz = lookAt.z - from.z;
    this.yaw = Math.atan2(-dx, -dz); // -Z is forward in three.js
    this.pitch = Math.atan2(lookAt.y - (this.position.y + this.eye), Math.hypot(dx, dz));
    this.applyToCamera(0);
  }

  /** Kick the view, as a weapon's recoil does; it recovers by itself. */
  punch(pitch: number, yaw: number): void {
    this.punchView.x += pitch;
    this.punchView.y += yaw;
  }

  get onGround(): boolean {
    return this.grounded;
  }

  requestLock(): void {
    // Browsers refuse a re-lock for about a second after Esc; that is not an error worth surfacing.
    Promise.resolve(this.dom.requestPointerLock()).catch(() => {});
  }

  releaseLock(): void {
    if (document.pointerLockElement === this.dom) document.exitPointerLock();
  }

  update(dt: number): void {
    const wasGrounded = this.grounded;

    // --- wish direction in camera yaw space -------------------------------
    let forward = 0;
    let strafe = 0;
    if (this.locked) {
      if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) forward += 1;
      if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) forward -= 1;
      if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) strafe += 1;
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) strafe -= 1;
    }
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    this.wish.set(strafe * cos - forward * sin, 0, -strafe * sin - forward * cos);
    if (this.wish.lengthSq() > 0) this.wish.normalize();

    this.crouching = this.locked && (this.keys.has("ControlLeft") || this.keys.has("KeyC"));
    const sprinting = this.locked && this.keys.has("ShiftLeft") && !this.crouching;
    const maxSpeed = this.crouching ? CROUCH : sprinting ? SPRINT : WALK;

    // --- friction + acceleration ------------------------------------------
    if (this.grounded) {
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      if (speed > 0) {
        const drop = Math.max(speed, 1) * FRICTION * dt;
        const scale = Math.max(0, speed - drop) / speed;
        this.velocity.x *= scale;
        this.velocity.z *= scale;
      }
    }
    const accel = this.grounded ? ACCEL : AIR_ACCEL;
    const current = this.velocity.x * this.wish.x + this.velocity.z * this.wish.z;
    const add = Math.min(maxSpeed - current, accel * dt);
    if (add > 0) {
      this.velocity.x += this.wish.x * add;
      this.velocity.z += this.wish.z * add;
    }

    // --- jump / gravity ----------------------------------------------------
    if (this.grounded && this.locked && this.keys.has("Space") && !this.crouching) {
      this.velocity.y = JUMP;
      this.grounded = false;
    }
    if (!this.grounded) this.velocity.y -= GRAVITY * dt;

    // --- integrate + resolve ----------------------------------------------
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    const floorY = this.bounds.min.y;
    if (this.position.y <= floorY) {
      this.position.y = floorY;
      this.velocity.y = 0;
      this.grounded = true;
    }
    const headroom = this.bounds.max.y - this.eye - 0.08;
    if (this.position.y > headroom) {
      this.position.y = headroom;
      this.velocity.y = Math.min(this.velocity.y, 0);
    }
    this.resolveCollisions();

    // --- footsteps ---------------------------------------------------------
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.speed01 = speed / SPRINT;
    if (this.grounded && speed > 0.4) {
      this.stepAccum += speed * dt;
      const stride = this.crouching ? STEP_DISTANCE * 1.4 : STEP_DISTANCE;
      if (this.stepAccum >= stride) {
        this.stepAccum = 0;
        this.onStep?.(sprinting);
      }
    } else {
      this.stepAccum = STEP_DISTANCE * 0.6; // land the next step sooner
    }
    if (!wasGrounded && this.grounded) this.onStep?.(true);

    this.applyToCamera(dt);
  }

  /** Circle-vs-AABB push-out, plus a hard clamp to the walkable bounds. */
  private resolveCollisions(): void {
    const r = RADIUS;
    for (const box of this.colliders) {
      this.expanded.copy(box).expandByScalar(r);
      if (
        this.position.x < this.expanded.min.x ||
        this.position.x > this.expanded.max.x ||
        this.position.z < this.expanded.min.z ||
        this.position.z > this.expanded.max.z
      ) {
        continue;
      }
      // Step over anything low enough to be furniture-top rather than a wall.
      if (box.max.y <= this.position.y + 0.18) continue;

      const left = this.position.x - this.expanded.min.x;
      const right = this.expanded.max.x - this.position.x;
      const back = this.position.z - this.expanded.min.z;
      const front = this.expanded.max.z - this.position.z;
      const min = Math.min(left, right, back, front);
      if (min === left) {
        this.position.x = this.expanded.min.x;
        this.velocity.x = Math.min(this.velocity.x, 0);
      } else if (min === right) {
        this.position.x = this.expanded.max.x;
        this.velocity.x = Math.max(this.velocity.x, 0);
      } else if (min === back) {
        this.position.z = this.expanded.min.z;
        this.velocity.z = Math.min(this.velocity.z, 0);
      } else {
        this.position.z = this.expanded.max.z;
        this.velocity.z = Math.max(this.velocity.z, 0);
      }
    }

    if (this.confine) {
      this.position.x = THREE.MathUtils.clamp(this.position.x, this.confine.xMin + r, this.confine.xMax - r);
      this.position.z = THREE.MathUtils.clamp(this.position.z, this.confine.zMin + r, this.confine.zMax - r);
    }
  }

  private applyToCamera(dt: number): void {
    const targetEye = this.crouching ? EYE_CROUCH : EYE_STAND;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 12);

    let bobY = 0;
    let lean = 0;
    if (this.options.headBob && !this.reduceMotion) {
      this.bobPhase += dt * (4 + this.speed01 * 9) * Math.max(0.15, this.speed01);
      bobY = Math.sin(this.bobPhase * 2) * 0.019 * this.speed01;
      lean = Math.sin(this.bobPhase) * 0.004 * this.speed01;
    }

    this.camera.position.set(this.position.x, this.position.y + this.eye + bobY, this.position.z);
    this.punchView.multiplyScalar(Math.exp(-dt * 7));
    this.camera.rotation.set(this.pitch + this.punchView.x, this.yaw + this.punchView.y, lean);
  }

  // --- input -------------------------------------------------------------
  private onMouseDown = (): void => {
    if (!this.locked) this.requestLock();
  };

  private onPointerLockChange = (): void => {
    this.locked = document.pointerLockElement === this.dom;
    if (!this.locked) this.keys.clear();
    this.onLockChange?.(this.locked);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    const k = LOOK_SCALE * this.options.sensitivity;
    this.yaw -= e.movementX * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * k, -PITCH_LIMIT, PITCH_LIMIT);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.locked) return;
    this.keys.add(e.code);
    // Space would scroll the page and ' / would open browser search
    if (e.code === "Space" || e.code === "Slash") e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onBlur = (): void => {
    this.keys.clear();
  };

  dispose(): void {
    this.dom.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }
}
