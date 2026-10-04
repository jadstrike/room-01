import * as THREE from "three";
import { Room } from "../Room";
import { Character } from "../Character";
import { dressChair } from "../ChairDressing";
import { SignPicture } from "../Sign";
import { Entity, type EntityContext } from "../Entity";
import { SEATS, type SeatDef } from "../cast";
import { ROOM01 } from "../room01";
import { raycastAsBox } from "../boxRaycast";
import type { WalkRect } from "../Player";
import type { DebugBox, Level, LevelContext, Report } from "./Level";

/**
 * Asset paths go through BASE_URL so a sub-path deploy (GitHub Pages) works.
 * horror_room.web.glb is the meshopt + WebP build (1.1 MB); horror_room.glb is
 * the uncompressed 3 MB original, kept for exact side-by-side comparison with
 * docs/reference_camera_start.jpg.
 */
const BASE = import.meta.env.BASE_URL;
export const ASSETS = {
  room: `${BASE}models/horror_room.web.glb`,
  roomUncompressed: `${BASE}models/horror_room.glb`,
  character: `${BASE}models/chair_character.glb`,
};

export type Seat = {
  def: SeatDef;
  /** Places the chair around CharacterSpawn. */
  holder: THREE.Group;
  character: Character | null;
  sign: SignPicture;
};

/**
 * Room 01: the room GLB, the two accused in their chairs, and the entity.
 * It is the story's hub - Rowan comes back here after every site - and the
 * most expensive thing to load, so it is persistent: leaving detaches it
 * from the scene (it costs nothing per frame) instead of disposing it.
 */
export class Room01Level implements Level {
  readonly id = "room01";
  readonly persistent = true;
  /** The entity glides and the door swings, and both cast shadows. */
  readonly dynamicShadows = true;
  readonly root = new THREE.Group();
  readonly colliders: THREE.Box3[] = [];
  readonly spawn = ROOM01.markers.cameraStart;
  readonly lookAt = ROOM01.markers.cameraTarget;
  confine: WalkRect | null = ROOM01.walkable.room;
  /** The two accused, in the order of `SEATS`. */
  readonly seats: Seat[] = SEATS.map((def) => ({ def, holder: new THREE.Group(), character: null, sign: new SignPicture(`room01.sign.${def.id}`) }));
  entity: Entity | null = null;
  /** Called after the figures in the chairs are replaced, so their interactions can follow. */
  onSeatsChanged: (() => void) | null = null;
  /** Called when a saved sign picture finishes loading. */
  onSignsChanged: (() => void) | null = null;
  readonly specOk: boolean;
  /** Room colliders plus the chairs: what the entity steers around. */
  private obstacles: THREE.Box3[] = [];
  private player = new THREE.Vector3();
  private autoScale = true;
  /** The entity let them all go: no entity, no one in the chairs, no confinement. */
  private released = false;
  private disposed = false;

  private constructor(readonly room: Room) {
    this.root.name = "Room01";
    this.root.add(room.root);
    const check = room.verifyAgainstSpec();
    this.specOk = check.ok;
    if (check.ok) console.info("[room] matches ROOM01_SPEC", check.report);
    else console.warn("[room] does NOT match ROOM01_SPEC", check.report);
    this.refreshColliders();
  }

  static async load(report: Report, autoScale: boolean): Promise<Room01Level> {
    // The story carries on without it if it fails to load.
    const entityModel = Entity.load().catch((error) => {
      console.warn("[entity] could not load the entity", error);
      return null;
    });
    report("Opening Room 01", 0.1);
    const level = new Room01Level(await Room.load(ASSETS.room));
    level.autoScale = autoScale;
    report("Tying the accused to their chairs", 0.5);
    await level.setCharacters(() => Character.fromURL(ASSETS.character));
    report("Something is already in the room", 0.8);
    const entity = await entityModel;
    if (entity) level.addEntity(entity);
    return level;
  }

  get bounds(): THREE.Box3 {
    return this.room.bounds;
  }

  get lightPosition(): THREE.Vector3 {
    return this.room.bulbWorldPosition;
  }

  setLightLevel(level: number): void {
    this.room.setBulbLevel(level);
  }

  raycastRoots(): THREE.Object3D[] {
    return this.entity ? [this.room.root, this.entity.root] : [this.room.root];
  }

  update(dt: number, ctx: LevelContext): void {
    this.player.copy(ctx.player);
    this.room.update(dt);
    for (const seat of this.seats) seat.character?.update(dt);
    this.entity?.update(dt, this.entityContext(ctx.light));
  }

  entityContext(light: number): EntityContext {
    return { player: this.player, obstacles: this.obstacles, area: ROOM01.walkable.room, light };
  }

  // --- the accused ----------------------------------------------------------
  /** Seat a fresh figure in every chair, from whatever `make` loads. */
  async setCharacters(make: () => Promise<Character>): Promise<void> {
    const loaded = await Promise.all(this.seats.map(() => make()));
    // The chairs are gone (released), or the room is (a new game): nowhere to seat anyone.
    if (this.released || this.disposed) {
      for (const c of loaded) c.dispose();
      return;
    }
    this.seats.forEach((seat, i) => this.seatCharacter(seat, loaded[i]));
    this.refreshColliders();
    this.onSeatsChanged?.();
  }

  private seatCharacter(seat: Seat, next: Character): void {
    seat.character?.dispose();
    seat.character = next;
    if (!seat.holder.parent) {
      // The holder places the chair; the room's CharacterSpawn places the holder.
      seat.holder.position.set(seat.def.x, 0, seat.def.z);
      seat.holder.rotation.y = seat.def.yaw;
      this.room.spawn.add(seat.holder);
    }
    // fit() measures in world space, so the holder's placement has to be in the matrices first.
    seat.holder.updateWorldMatrix(true, false);
    dressChair(next.root, this.room.root);
    seat.holder.add(next.root);
    next.fit(this.autoScale);
    raycastAsBox(next.root, next.collider);
    const clipIndex = next.defaultClipIndex;
    if (clipIndex >= 0) next.playClip(clipIndex);
    this.attachSign(seat);
  }

  private attachSign(seat: Seat): void {
    if (!seat.character || !seat.sign.attach(seat.character.root)) return;
    const saved = seat.sign.saved();
    if (!saved) return;
    seat.sign
      .set(saved, false)
      .then(() => this.onSignsChanged?.())
      .catch(() => seat.sign.reset());
  }

  setAutoScale(on: boolean): void {
    this.autoScale = on;
    for (const seat of this.seats) seat.character?.fit(on);
    this.refreshColliders();
  }

  selectClip(index: number): void {
    for (const seat of this.seats) seat.character?.playClip(index);
  }

  seatOf(object: THREE.Object3D): Seat | null {
    return this.seats.find((s) => s.character && isDescendant(object, s.character.root)) ?? null;
  }

  // --- the entity -------------------------------------------------------------
  private addEntity(entity: Entity): void {
    this.entity = entity;
    this.reclaimEntity();
    raycastAsBox(entity.root, entity.collider);
    this.refreshColliders();
  }

  /** The entity vanishes, the chairs are empty, and the open door leads out. */
  release(): void {
    if (this.released) return;
    this.released = true;
    this.entity?.dispose();
    this.entity = null;
    for (const seat of this.seats) seat.holder.removeFromParent();
    this.confine = null;
    this.refreshColliders();
  }

  /**
   * Take the entity back after it has been lent to a site (where it follows
   * Rowan), and put it where it starts: behind the accused, facing the
   * player, where the bulb barely reaches.
   */
  reclaimEntity(): void {
    const entity = this.entity;
    if (!entity) return;
    this.root.add(entity.root);
    entity.hold(false);
    entity.place(new THREE.Vector3(-0.9, 0, -2.05), ROOM01.markers.cameraStart);
  }

  isEntity(object: THREE.Object3D): boolean {
    return !!this.entity && isDescendant(object, this.entity.root);
  }

  private refreshColliders(): void {
    this.obstacles = [...this.room.colliders];
    for (const seat of this.seats) {
      if (!seat.character || this.released) continue;
      seat.character.refreshCollider();
      this.obstacles.push(seat.character.collider);
    }
    // The entity's box is moved in place every frame, so the player always collides with where it is now.
    this.colliders.length = 0;
    this.colliders.push(...this.obstacles);
    if (this.entity) this.colliders.push(this.entity.collider);
  }

  debugBoxes(): DebugBox[] {
    const boxes: DebugBox[] = [{ box: this.room.bounds, color: 0x4ad3a1 }];
    for (const box of this.room.colliders) boxes.push({ box, color: 0x8e1b17 });
    for (const seat of this.seats) if (seat.character) boxes.push({ box: seat.character.collider, color: 0xd8d2c4 });
    if (this.entity) boxes.push({ box: this.entity.collider, color: 0x9fb4d8 });
    return boxes;
  }

  dispose(): void {
    this.disposed = true;
    for (const seat of this.seats) {
      seat.character?.dispose();
      seat.sign.dispose();
    }
    this.entity?.dispose();
    this.room.dispose();
    this.root.removeFromParent();
  }
}

export function isDescendant(o: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (n === ancestor) return true;
  return false;
}
