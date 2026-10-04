import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type TextureKind = "plaster" | "wood" | "tile" | "floor" | "fabric" | "rug";

/** Built once per kind and shared by every room for the life of the page: six 256 px canvases. */
const sharedTextures = new Map<TextureKind, THREE.CanvasTexture>();

/** Something in a room E can be pressed on, and what Rowan sees when it is. */
export type Examinable = { id: string; object: THREE.Object3D; label: string; text: string };

/** A doorway in a room's local space: the door the player leaves by. */
export type Port = { id: string; position: THREE.Vector3; outward: THREE.Vector3; width: number; height: number };

/**
 * Builds procedural props out of boxes and cylinders, and owns what they
 * allocate: geometry and materials are disposed with it, textures are shared.
 *
 * Rooms are written as many small boxes, which reads well but would cost a
 * draw call each - several hundred per room, times six for every point-light
 * shadow. finalize() merges everything static into one mesh per material, and
 * merges each inspectable object's parts the same way under that object, so
 * the centre-screen raycast still finds what it is looking at.
 */
export abstract class Procedural {
  readonly root = new THREE.Group();
  readonly colliders: THREE.Box3[] = [];
  readonly examinables: Examinable[] = [];
  protected geometries = new Set<THREE.BufferGeometry>();
  protected materials = new Set<THREE.Material>();
  private cube = new THREE.BoxGeometry(1, 1, 1);
  private finalized = false;

  /** `prefix` namespaces examinable ids, e.g. "kitchen". */
  constructor(protected prefix: string) {
    this.geometries.add(this.cube);
  }

  protected material(color: number, map?: THREE.Texture, metalness = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, map: map ?? null, roughness: metalness ? 0.4 : 0.92, metalness });
    this.materials.add(material);
    return material;
  }

  /** A material this room builds itself, registered so it is disposed with the room. */
  protected own<T extends THREE.Material>(material: T): T {
    this.materials.add(material);
    return material;
  }

  protected box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, solid = false): THREE.Mesh {
    const mesh = new THREE.Mesh(this.cube, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    if (solid) this.colliders.push(new THREE.Box3(new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2), new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)));
    return mesh;
  }

  protected cylinder(name: string, x: number, y: number, z: number, radius: number, height: number, material: THREE.Material): THREE.Mesh {
    return this.mesh(name, new THREE.CylinderGeometry(radius, radius, height, 16), material, x, y, z);
  }

  /** Any other geometry; the room owns and disposes it. */
  protected mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  /** A named group, so an inspectable object's parts do not occlude their own target. */
  protected group(name: string): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    this.root.add(group);
    return group;
  }

  /** Make an object examinable: E shows `text`. */
  protected inspect(object: THREE.Object3D, label: string, text: string): Examinable {
    const item = { id: `${this.prefix}:${object.name}`, object, label, text };
    this.examinables.push(item);
    return item;
  }

  /** A shadow-casting point light with the settings every room uses. */
  protected keyLight(color: number, intensity: number, distance: number, at: THREE.Vector3): THREE.PointLight {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.copy(at);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.001;
    light.shadow.normalBias = 0.035;
    this.root.add(light);
    return light;
  }

  /** Small deterministic textures, shared across rooms; no downloads or per-frame work. */
  protected texture(kind: TextureKind): THREE.CanvasTexture {
    let texture = sharedTextures.get(kind);
    if (!texture) {
      texture = drawTexture(kind);
      sharedTextures.set(kind, texture);
    }
    return texture;
  }

  /**
   * Merge static meshes per material. Call once, after the room is built and
   * its interactions are registered. Meshes under an inspectable object merge
   * into that object, in its own space, so it can still move or be found.
   */
  finalize(): void {
    if (this.finalized) return;
    this.finalized = true;
    this.root.updateMatrixWorld(true);
    const owners = new Set<THREE.Object3D>(this.interactionObjects());
    const batches = new Map<string, { owner: THREE.Object3D; material: THREE.Material; meshes: THREE.Mesh[] }>();
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material) || owners.has(mesh)) return;
      let owner: THREE.Object3D = this.root;
      for (let n = mesh.parent; n; n = n.parent) {
        if (owners.has(n)) {
          owner = n;
          break;
        }
      }
      const key = `${owner.uuid}/${mesh.material.uuid}/${mesh.castShadow}/${mesh.receiveShadow}`;
      let batch = batches.get(key);
      if (!batch) batches.set(key, (batch = { owner, material: mesh.material, meshes: [] }));
      batch.meshes.push(mesh);
    });

    const toOwner = new THREE.Matrix4();
    for (const { owner, material, meshes } of batches.values()) {
      if (meshes.length < 2) continue;
      toOwner.copy(owner.matrixWorld).invert();
      const parts = meshes.map((m) => m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toOwner, m.matrixWorld)));
      const merged = mergeGeometries(parts, false);
      for (const part of parts) part.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${owner === this.root ? "Static" : owner.name}_Batch`;
      mesh.castShadow = meshes[0].castShadow;
      mesh.receiveShadow = meshes[0].receiveShadow;
      for (const m of meshes) m.removeFromParent();
      owner.add(mesh);
      this.geometries.add(merged);
    }

    // Geometries nothing draws any more never reached the GPU; free them now.
    const used = new Set<THREE.BufferGeometry>();
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) used.add((o as THREE.Mesh).geometry);
    });
    for (const geometry of this.geometries) {
      if (used.has(geometry)) continue;
      geometry.dispose();
      this.geometries.delete(geometry);
    }
  }

  /** Objects the raycast must still be able to find after merging. */
  protected interactionObjects(): THREE.Object3D[] {
    return this.examinables.map((e) => e.object);
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Light) o.dispose();
    });
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.root.removeFromParent();
  }
}

/**
 * An authored room of a site. All measurements are local metres, with the
 * floor at y = 0 and the exit door in `ports[0]`.
 */
export abstract class ProceduralSection extends Procedural {
  abstract readonly bounds: THREE.Box3;
  /** The main light: dust glows around it. */
  abstract readonly dustOrigin: THREE.Vector3;
  abstract readonly spawn: THREE.Vector3;
  abstract readonly lookAt: THREE.Vector3;
  abstract readonly ports: readonly Port[];
  /** The door Rowan leaves by: E on it opens the way out. */
  exit: Examinable | null = null;

  /**
   * Floor, ceiling and four walls around a w x d room of height h, centred
   * on the origin, with a 1.2 x 2.2 m doorway in the middle of the +Z wall.
   * Walls are 0.2 m shells outside the bounds, as Room 01's spec has them.
   */
  protected shell(w: number, d: number, h: number, wall: THREE.Material, floor: THREE.Material, ceiling: THREE.Material): void {
    const hw = w / 2;
    const hd = d / 2;
    this.box("Floor", 0, -0.06, 0, w + 0.4, 0.12, d + 0.4, floor);
    this.box("Ceiling", 0, h + 0.06, 0, w + 0.4, 0.12, d + 0.4, ceiling);
    this.box("Wall_Left", -hw - 0.1, h / 2, 0, 0.2, h, d + 0.4, wall, true);
    this.box("Wall_Right", hw + 0.1, h / 2, 0, 0.2, h, d + 0.4, wall, true);
    this.box("Wall_Back", 0, h / 2, -hd - 0.1, w + 0.4, h, 0.2, wall, true);
    const side = (w - 1.2) / 2;
    for (const s of [-1, 1]) this.box("Entry_Wall", s * (0.6 + side / 2), h / 2, hd + 0.1, side, h, 0.2, wall, true);
    this.box("Entry_Lintel", 0, (2.2 + h) / 2, hd + 0.1, 1.2, h - 2.2, 0.2, wall, true);
  }

  /** The door that closes the doorway shell() leaves, at z = hd. */
  protected doorSlab(hd: number, slab: THREE.Material, handle: THREE.Material): THREE.Group {
    const door = this.group("Hall_Door");
    door.add(this.box("Door_Slab", 0, 1.1, hd - 0.01, 1.18, 2.2, 0.08, slab, true));
    door.add(this.box("Door_Handle", -0.43, 1.02, hd - 0.1, 0.14, 0.04, 0.08, handle));
    for (const x of [-0.67, 0.67]) this.box("Door_Trim", x, 1.13, hd - 0.08, 0.1, 2.26, 0.1, handle);
    this.box("Door_Trim", 0, 2.26, hd - 0.08, 1.44, 0.1, 0.1, handle);
    return door;
  }

  protected exitDoor(object: THREE.Object3D, label: string, text: string): void {
    this.exit = { id: `${this.prefix}:${object.name}`, object, label, text };
  }

  protected override interactionObjects(): THREE.Object3D[] {
    const objects = super.interactionObjects();
    if (this.exit) objects.push(this.exit.object);
    return objects;
  }
}

function drawTexture(kind: TextureKind): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  let seed = 71;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.fillStyle = "#c8c3b5";
  ctx.fillRect(0, 0, 256, 256);
  if (kind === "tile" || kind === "floor") {
    const size = kind === "floor" ? 32 : 64;
    for (let x = 0; x < 256; x += size) {
      for (let y = 0; y < 256; y += size) {
        ctx.fillStyle = kind === "floor" && (x / size + y / size) % 2 ? "#555c54" : "#c8c3b5";
        ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
      }
    }
  }
  if (kind === "fabric" || kind === "rug") {
    ctx.strokeStyle = "rgba(40,32,22,.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 256; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
    if (kind === "rug") {
      ctx.strokeStyle = "#5a4530";
      for (const inset of [10, 16, 30]) ctx.strokeRect(inset, inset, 256 - inset * 2, 256 - inset * 2);
      for (let x = 55; x < 220; x += 48) {
        for (let y = 55; y < 220; y += 48) {
          ctx.beginPath();
          ctx.moveTo(x, y - 13);
          ctx.lineTo(x + 10, y);
          ctx.lineTo(x, y + 13);
          ctx.lineTo(x - 10, y);
          ctx.closePath();
          ctx.stroke();
        }
      }
    }
  }
  for (let i = 0; i < 6500; i++) {
    ctx.fillStyle = `rgba(35,29,19,${rand() * 0.14})`;
    ctx.fillRect(rand() * 256, rand() * 256, kind === "wood" ? 30 + rand() * 80 : 1 + rand() * 4, 1 + rand() * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
