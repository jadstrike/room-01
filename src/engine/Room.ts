import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { loadGLB, disposeObject } from "./loaders";
import { ROOM01, specColliderBoxes, roomBounds } from "./room01";

/**
 * The room GLB is not an opaque blob: objects are looked up BY NAME, so
 * renaming a node or material in the model silently changes behaviour. Every
 * lookup falls back gracefully, which makes those failures easy to miss -
 * verifyAgainstSpec() re-derives what it can from the geometry and warns in the
 * console when the model and docs/ROOM01_SPEC.md have drifted apart.
 */
const NO_SHADOW_MATS = new Set(["M_WindowGlass", "M_NightSky", "M_Void", "M_BulbGlass"]);

/** Props the interaction system offers: node name -> verb + label, and what Rowan finds. */
export const PROP_INTERACTIONS: ReadonlyArray<{ node: string; verb: string; label: string; text: string; range?: number }> = [
  { node: "Door", verb: "Open", label: "the door", text: "" },
  { node: "Mirror", verb: "Look into", label: "the mirror", text: "You look like someone who has been crying. You don't remember crying." },
  { node: "Frame_Portrait", verb: "Examine", label: "the portrait", text: "A family portrait, sun-faded. Everyone in it is turned slightly away from the camera." },
  { node: "Frame_Fallen", verb: "Examine", label: "the fallen frame", text: "Face down, the glass cracked. You leave it face down." },
  { node: "Desk_Items", verb: "Search", label: "the desk", text: "Pens, a dead phone, a florist's receipt. The date has been torn off." },
  { node: "Wardrobe", verb: "Open", label: "the wardrobe", text: "Empty hangers, still swaying, as if someone has only just taken the clothes." },
  { node: "Window_Boards", verb: "Examine", label: "the boarded window", text: "Nailed shut from the inside. Whoever did it was keeping something in." },
  { node: "Bed", verb: "Examine", label: "the bed", text: "Made with hospital corners. Nobody has slept in it. Nobody has slept here at all." },
  { node: "Radiator", verb: "Touch", label: "the radiator", text: "Stone cold. Something taps inside it, once, and stops." },
];

export class Room {
  readonly root: THREE.Group;
  /** Node the character is parented to, so the room's transform places it. */
  readonly spawn: THREE.Object3D;
  readonly bulbLight: THREE.PointLight | null;
  readonly moonLight: THREE.SpotLight | null;
  readonly hallLight: THREE.PointLight | null;
  readonly bulbWorldPosition = new THREE.Vector3(0, 2.16, 0.3);
  /** The room volume: floor to ceiling, x and z from -3 to 3. */
  readonly bounds = roomBounds();
  /** Spec colliders (walls, hallway, furniture) plus the swinging door. */
  readonly colliders: THREE.Box3[];

  private bulbMat: THREE.MeshStandardMaterial | null = null;
  private bulbBase = 1;
  private bulbEmissive = 1;
  private mixer: THREE.AnimationMixer | null = null;
  private doorAction: THREE.AnimationAction | null = null;
  private doorHinge: THREE.Object3D | null = null;
  private doorCollider = new THREE.Box3();
  private doorIsOpen = false;

  private constructor(gltf: GLTF) {
    this.root = gltf.scene as THREE.Group;

    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = ([] as THREE.Material[]).concat(mesh.material as THREE.Material);
      const names = materials.map((m) => m.name);
      mesh.receiveShadow = true;
      for (const m of materials) m.shadowSide = THREE.DoubleSide; // seals light leaks at thin wall seams
      mesh.castShadow =
        !names.some((n) => NO_SHADOW_MATS.has(n)) && !/Hanging_Bulb/.test(String(mesh.parent?.name) + mesh.name);
      if (!this.bulbMat && names.includes("M_BulbGlass")) {
        this.bulbMat = materials.find((m) => m.name === "M_BulbGlass") as THREE.MeshStandardMaterial;
      }
    });

    this.spawn = this.root.getObjectByName("CharacterSpawn") ?? new THREE.Object3D();
    if (!this.spawn.parent) {
      this.spawn.position.copy(ROOM01.markers.characterSpawn);
      this.root.add(this.spawn);
    }

    this.bulbLight = findLight<THREE.PointLight>(this.root, "Light_Bulb");
    this.moonLight = findLight<THREE.SpotLight>(this.root, "Light_Moon");
    this.hallLight = findLight<THREE.PointLight>(this.root, "Light_Hall");

    // Shadow configuration lives in code: the glTF carries intensities only.
    if (this.bulbLight) {
      this.bulbLight.castShadow = true;
      this.bulbLight.shadow.mapSize.set(1024, 1024);
      this.bulbLight.shadow.bias = -0.002;
      this.bulbLight.shadow.normalBias = 0.02;
      this.bulbLight.shadow.radius = 3;
      this.bulbBase = this.bulbLight.intensity;
      this.bulbLight.getWorldPosition(this.bulbWorldPosition);
    }
    if (this.moonLight) {
      this.moonLight.castShadow = true;
      this.moonLight.shadow.mapSize.set(1024, 1024);
      this.moonLight.shadow.bias = -0.0008;
      this.moonLight.shadow.normalBias = 0.02;
      this.moonLight.shadow.camera.near = 1;
      this.moonLight.shadow.camera.far = 12;
    }
    if (this.bulbMat) this.bulbEmissive = this.bulbMat.emissiveIntensity;

    if (gltf.animations.length) {
      this.mixer = new THREE.AnimationMixer(this.root);
      const clip = THREE.AnimationClip.findByName(gltf.animations, ROOM01.door.clip) ?? gltf.animations[0];
      this.doorAction = this.mixer.clipAction(clip);
      this.doorAction.setLoop(THREE.LoopOnce, 1);
      this.doorAction.clampWhenFinished = true;
    }
    this.doorHinge = this.root.getObjectByName(ROOM01.door.hingeNode) ?? null;

    this.colliders = specColliderBoxes();
    this.refreshDoorCollider();
    this.colliders.push(this.doorCollider);
  }

  static async load(url: string): Promise<Room> {
    return new Room(await loadGLB(url));
  }

  /** One value drives the bulb light and its emissive material together. */
  setBulbLevel(level: number): void {
    if (this.bulbLight) this.bulbLight.intensity = this.bulbBase * level;
    if (this.bulbMat) this.bulbMat.emissiveIntensity = this.bulbEmissive * level;
  }

  get hasDoor(): boolean {
    return this.doorAction !== null;
  }

  get doorOpen(): boolean {
    return this.doorIsOpen;
  }

  /** The door swings INTO the room, so its collider has to follow the hinge. */
  get doorAngleDeg(): number {
    return this.doorHinge ? THREE.MathUtils.radToDeg(this.doorHinge.rotation.y) : ROOM01.door.angles.rest;
  }

  toggleDoor(): boolean {
    if (!this.doorAction) return false;
    this.doorIsOpen = !this.doorIsOpen;
    this.doorAction.paused = false;
    this.doorAction.timeScale = this.doorIsOpen ? 1 : -1.6;
    if (this.doorIsOpen && this.doorAction.time >= this.doorAction.getClip().duration) this.doorAction.time = 0;
    this.doorAction.play();
    return this.doorIsOpen;
  }

  update(dt: number): void {
    this.mixer?.update(dt);
    // Only re-measure while the door is actually moving: setFromObject walks
    // every vertex of the 1,292-triangle slab.
    if (this.doorAction?.isRunning()) this.refreshDoorCollider();
  }

  private refreshDoorCollider(): void {
    const slab = this.root.getObjectByName(ROOM01.door.slabNode);
    if (!slab) {
      this.doorCollider.makeEmpty();
      return;
    }
    slab.updateWorldMatrix(true, true);
    this.doorCollider.setFromObject(slab, true);
  }

  /**
   * Cross-checks the loaded GLB against docs/ROOM01_SPEC.md. Everything here is
   * a warning, not an error: the scene still runs, but a silent re-export that
   * moves the floor or renames a node shows up immediately in the console.
   */
  verifyAgainstSpec(): { ok: boolean; report: Record<string, unknown> } {
    const problems: string[] = [];
    const floor = this.root.getObjectByName("Floor");
    if (!floor) {
      problems.push("no Floor node");
    } else {
      const box = new THREE.Box3().setFromObject(floor, true);
      const s = ROOM01.shell;
      const off = Math.max(
        Math.abs(box.min.x - s.xMin),
        Math.abs(box.max.x - s.xMax),
        Math.abs(box.min.z - s.zMin),
        Math.abs(box.max.z - s.zMax),
      );
      if (off > 0.01) problems.push(`floor bounds differ from spec by ${off.toFixed(3)} m`);
    }

    let meshes = 0;
    let triangles = 0;
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      meshes++;
      const g = mesh.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    triangles = Math.round(triangles);
    if (meshes !== ROOM01.expected.meshes) problems.push(`${meshes} meshes, spec says ${ROOM01.expected.meshes}`);
    if (triangles !== ROOM01.expected.triangles) {
      problems.push(`${triangles} triangles, spec says ${ROOM01.expected.triangles}`);
    }

    for (const name of ["CharacterSpawn", "Door_Hinge", "Door", "Light_Bulb", "Light_Moon", "Light_Hall"]) {
      if (!this.root.getObjectByName(name)) problems.push(`missing node ${name}`);
    }
    if (!this.bulbMat) problems.push("missing material M_BulbGlass");
    if (!this.hasDoor) problems.push(`missing clip ${ROOM01.door.clip}`);

    return {
      ok: problems.length === 0,
      report: { meshes, triangles, doorAngle: +this.doorAngleDeg.toFixed(1), colliders: this.colliders.length, problems },
    };
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    disposeObject(this.root);
    this.root.removeFromParent();
  }
}

/** Accepts either the light itself or a parent node containing one. */
function findLight<T extends THREE.Light>(root: THREE.Object3D, name: string): T | null {
  const node = root.getObjectByName(name);
  if (!node) return null;
  if ((node as THREE.Light).isLight) return node as T;
  let found: T | null = null;
  node.traverse((child) => {
    if (!found && (child as THREE.Light).isLight) found = child as T;
  });
  return found;
}
