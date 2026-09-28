import * as THREE from "three";
import type { WeaponDef } from "./weapons";
import type { Viewmodel } from "./Viewmodel";

export type WeaponState = {
  name: string;
  ammo: number;
  reserve: number;
  magSize: number;
  reloading: boolean;
};

export type ShotContext = {
  camera: THREE.Camera;
  /** 0..1 horizontal speed, as the crosshair uses it. */
  speed01: number;
  onGround: boolean;
  roots: THREE.Object3D[];
};

/**
 * Semi-automatic hitscan, with Counter-Strike's rules of thumb: accuracy comes
 * from standing still and pacing shots, recoil punches the view and recovers
 * on its own, and pulling the trigger on an empty magazine starts a reload.
 */
export class Weapon {
  ammo: number;
  reserve: number;
  /** 0..1, how far the spread has bloomed from firing; the crosshair reads it. */
  bloom01 = 0;

  onChange: ((state: WeaponState) => void) | null = null;
  onShot: ((hit: THREE.Intersection | null) => void) | null = null;
  onDryFire: (() => void) | null = null;
  onReload: ((empty: boolean) => void) | null = null;

  private cooldown = 0;
  private reloadLeft = -1;
  private reloadEmpty = false;
  private heat = 0;
  private raycaster = new THREE.Raycaster();
  private dir = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();

  constructor(
    readonly def: WeaponDef,
    private viewmodel: Viewmodel,
    private punch: (pitch: number, yaw: number) => void,
  ) {
    this.ammo = def.magSize;
    this.reserve = def.reserve;
    this.raycaster.far = def.range;
    viewmodel.equip();
  }

  get state(): WeaponState {
    return {
      name: this.def.name,
      ammo: this.ammo,
      reserve: this.reserve,
      magSize: this.def.magSize,
      reloading: this.reloadLeft >= 0,
    };
  }

  /** Current spread-cone radius in radians. */
  inaccuracy(ctx: Pick<ShotContext, "speed01" | "onGround">): number {
    const d = this.def;
    return d.spreadStand + ctx.speed01 * ctx.speed01 * d.spreadMove + (ctx.onGround ? 0 : d.spreadAir) + this.heat * d.spreadFire;
  }

  trigger(ctx: ShotContext): void {
    if (this.reloadLeft >= 0 || this.cooldown > 0) return;
    if (this.ammo <= 0) {
      this.cooldown = 0.25;
      this.viewmodel.dryFire();
      this.onDryFire?.();
      this.reload();
      return;
    }

    this.ammo--;
    this.cooldown = this.def.fireInterval;
    this.viewmodel.fire(this.ammo === 0);

    // The shot uses the view before this shot's punch, like CS.
    const spread = this.inaccuracy(ctx);
    ctx.camera.getWorldDirection(this.dir);
    this.right.crossVectors(this.dir, ctx.camera.up).normalize();
    this.up.crossVectors(this.right, this.dir).normalize();
    const r = spread * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    this.dir.addScaledVector(this.right, Math.cos(a) * r).addScaledVector(this.up, Math.sin(a) * r).normalize();
    const origin = ctx.camera.getWorldPosition(new THREE.Vector3());
    this.raycaster.set(origin, this.dir);
    const hit = this.raycaster.intersectObjects(ctx.roots, true).find((h) => isSolid(h.object)) ?? null;

    this.heat = Math.min(4, this.heat + 1);
    this.punch(this.def.kickPitch * (0.85 + Math.random() * 0.3), (Math.random() - 0.5) * 2 * this.def.kickYaw);
    this.onShot?.(hit);
    this.emit();
  }

  /** Turn the gun over to look at it; firing or reloading cuts it short. */
  inspect(): void {
    if (this.reloadLeft >= 0) return;
    this.viewmodel.inspect();
  }

  reload(): void {
    if (this.reloadLeft >= 0 || this.ammo >= this.def.magSize || this.reserve <= 0) return;
    this.reloadEmpty = this.ammo === 0;
    this.reloadLeft = this.reloadEmpty ? this.def.reloadEmptyTime : this.def.reloadTime;
    this.viewmodel.reload(this.reloadLeft, this.reloadEmpty);
    this.onReload?.(this.reloadEmpty);
    this.emit();
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.heat = Math.max(0, this.heat - dt * this.def.recoverRate);
    this.bloom01 = Math.min(1, this.heat / 3);
    if (this.reloadLeft >= 0) {
      this.reloadLeft -= dt;
      if (this.reloadLeft < 0) {
        const take = Math.min(this.def.magSize - this.ammo, this.reserve);
        this.ammo += take;
        this.reserve -= take;
        this.reloadLeft = -1;
        this.emit();
      }
    }
  }

  private emit(): void {
    this.onChange?.(this.state);
  }
}

/** Skip helpers and anything not actually drawn. */
function isSolid(o: THREE.Object3D): boolean {
  let n: THREE.Object3D | null = o;
  while (n) {
    if (!n.visible) return false;
    n = n.parent;
  }
  const mesh = o as THREE.Mesh;
  return !!mesh.isMesh;
}
