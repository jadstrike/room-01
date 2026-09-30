import * as THREE from "three";
import type { Interactable } from "../Interact";
import type { HouseSection } from "./HouseSection";

/** All measurements are local metres. Instantiate once per placed house section. */
export class Kitchen implements HouseSection {
  readonly root = new THREE.Group();
  readonly bounds = new THREE.Box3(new THREE.Vector3(-3, 0, -2.5), new THREE.Vector3(3, 3, 2.5));
  readonly spawn = new THREE.Vector3(0, 0, 1.8);
  readonly lookAt = new THREE.Vector3(-0.6, 1.2, -1.8);
  readonly ports = [{ id: "hall", position: new THREE.Vector3(0, 0, 2.5), outward: new THREE.Vector3(0, 0, 1), width: 1.2, height: 2.2 }];
  readonly colliders: THREE.Box3[] = [];
  readonly interactions: Interactable[] = [];
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private cube = new THREE.BoxGeometry(1, 1, 1);

  constructor(message: (text: string) => void) {
    this.root.name = "House_Kitchen";
    this.geometries.add(this.cube);
    const plaster = this.material(0x8c8370, this.texture("plaster"));
    const green = this.material(0x465850, this.texture("plaster"));
    const wood = this.material(0x65503a, this.texture("wood"));
    const dark = this.material(0x222421);
    const cream = this.material(0xbab29b);
    const metal = this.material(0x788281, undefined, 0.7);
    const tile = this.material(0xb1ac91, this.texture("tile"));
    const floor = this.material(0x858372, this.texture("floor"));
    const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, solid = false) => this.box(name, x, y, z, w, h, d, mat, solid);
    box("Floor", 0, -0.06, 0, 6.2, 0.12, 5.2, floor);
    box("Ceiling", 0, 3.06, 0, 6.2, 0.12, 5.2, plaster);
    box("Wall_Left", -3.1, 1.5, 0, 0.2, 3, 5.2, plaster, true);
    box("Wall_Right", 3.1, 1.5, 0, 0.2, 3, 5.2, plaster, true);
    box("Wall_Back", 0, 1.5, -2.6, 6.2, 3, 0.2, plaster, true);
    for (const x of [-1.8, 1.8]) box("Entry_Wall", x, 1.5, 2.6, 2.4, 3, 0.2, plaster, true);
    box("Entry_Lintel", 0, 2.6, 2.6, 1.2, 0.8, 0.2, plaster, true);
    const door = box("Hall_Door", 0, 1.1, 2.49, 1.18, 2.2, 0.08, green, true);
    for (const x of [-0.67, 0.67]) box("Door_Trim", x, 1.13, 2.4, 0.1, 2.26, 0.1, wood);
    box("Door_Trim", 0, 2.26, 2.4, 1.44, 0.1, 0.1, wood);
    box("Door_Handle", -0.43, 1.02, 2.4, 0.12, 0.04, 0.06, metal);
    for (const x of [-2.98, 2.98]) box("Skirting", x, 0.09, 0, 0.045, 0.18, 5, wood);
    box("Skirting", 0, 0.09, -2.48, 6, 0.18, 0.045, wood);
    box("Splashback", -0.55, 1.32, -2.47, 4.5, 0.78, 0.04, tile);
    // Cabinet carcasses share one geometry and a small material palette.
    for (const x of [-2.3, -1.4, -0.5, 0.4]) {
      box("Base_Cabinet", x, 0.46, -2.06, 0.86, 0.84, 0.8, green, true);
      box("Cabinet_Door", x, 0.48, -1.645, 0.8, 0.72, 0.04, green);
      box("Cabinet_Inset", x, 0.48, -1.62, 0.64, 0.55, 0.02, wood);
      box("Cabinet_Handle", x + 0.28, 0.68, -1.58, 0.035, 0.15, 0.045, metal);
    }
    box("Counter_Left", -2.02, 0.92, -2.05, 1.47, 0.08, 0.9, cream);
    box("Counter_Right", 0.15, 0.92, -2.05, 1.4, 0.08, 0.9, cream);
    // Recessed sink, with counter strips around its opening.
    box("Sink_Back_Rim", -0.94, 0.92, -2.39, 0.72, 0.08, 0.22, metal);
    box("Sink_Front_Rim", -0.94, 0.92, -1.7, 0.72, 0.08, 0.2, metal);
    box("Sink_Basin", -0.94, 0.82, -2.05, 0.7, 0.06, 0.5, metal);
    for (const x of [-1.27, -0.61]) box("Sink_Side", x, 0.88, -2.05, 0.04, 0.15, 0.5, metal);
    this.cylinder("Tap", -0.94, 1.1, -2.34, 0.025, 0.35, metal);
    box("Tap_Spout", -0.94, 1.26, -2.23, 0.05, 0.045, 0.25, metal);
    for (const x of [-2.3, 0.4]) {
      box("Wall_Cupboard", x, 2.12, -2.28, 0.86, 0.8, 0.42, green);
      box("Upper_Panel", x, 2.12, -2.05, 0.7, 0.64, 0.025, wood);
      box("Upper_Handle", x + 0.28, 1.9, -2.01, 0.035, 0.13, 0.04, metal);
    }
    const stove = box("Cooker", 1.36, 0.47, -2.05, 0.86, 0.94, 0.84, cream, true);
    box("Oven_Glass", 1.36, 0.4, -1.615, 0.66, 0.46, 0.025, dark);
    box("Oven_Handle", 1.36, 0.72, -1.55, 0.62, 0.045, 0.06, metal);
    for (const x of [1.13, 1.58]) for (const z of [-2.28, -1.87]) this.cylinder("Burner", x, 0.95, z, 0.14, 0.018, dark);
    for (let i = 0; i < 4; i++) this.cylinder("Cooker_Dial", 1.1 + i * 0.17, 0.86, -1.6, 0.04, 0.045, dark).rotation.x = Math.PI / 2;
    const fridge = box("Fridge", 2.43, 1.02, -1.96, 0.91, 2.04, 0.97, cream, true);
    box("Freezer_Seam", 2.43, 1.5, -1.466, 0.85, 0.018, 0.012, dark);
    box("Fridge_Handle", 2.1, 1.15, -1.41, 0.045, 0.4, 0.08, metal);
    box("Fridge_Note", 2.45, 1.67, -1.462, 0.22, 0.28, 0.008, this.material(0xd4c894));
    this.cylinder("Magnet", 2.45, 1.78, -1.45, 0.022, 0.015, green).rotation.x = Math.PI / 2;
    // Moonlit window on the left wall; the backing is intentionally opaque.
    const glass = new THREE.MeshStandardMaterial({ color: 0x172c37, emissive: 0x496579, emissiveIntensity: 0.45, roughness: 0.3 });
    this.materials.add(glass);
    box("Window", -2.97, 1.95, -0.2, 0.04, 1.2, 1.5, glass);
    for (const z of [-0.98, -0.2, 0.58]) box("Window_Frame", -2.91, 1.95, z, 0.09, 1.32, 0.06, wood);
    for (const y of [1.3, 1.95, 2.6]) box("Window_Frame", -2.91, y, -0.2, 0.09, 0.06, 1.62, wood);
    box("Window_Sill", -2.82, 1.28, -0.2, 0.32, 0.08, 1.7, cream);
    box("Table", -1.48, 0.76, 0.62, 1.35, 0.09, 0.94, wood, true);
    for (const x of [-2.02, -0.94]) for (const z of [0.27, 0.97]) box("Table_Leg", x, 0.36, z, 0.08, 0.72, 0.08, wood);
    box("Chair_Seat", -1.48, 0.43, 1.45, 0.48, 0.08, 0.48, wood, true);
    box("Chair_Back", -1.48, 0.76, 1.66, 0.48, 0.65, 0.06, wood);
    for (const x of [-1.67, -1.29]) for (const z of [1.26, 1.64]) box("Chair_Leg", x, 0.21, z, 0.055, 0.42, 0.055, wood);
    const mug = this.cylinder("Forgotten_Mug", -1.3, 0.9, 0.52, 0.085, 0.19, cream);
    this.cylinder("Tea", -1.3, 0.997, 0.52, 0.069, 0.003, dark);
    const handleGeometry = new THREE.TorusGeometry(0.06, 0.014, 6, 12);
    this.geometries.add(handleGeometry);
    const handle = new THREE.Mesh(handleGeometry, cream);
    handle.position.set(-1.2, 0.9, 0.52); this.root.add(handle);
    box("Teaspoon", -1.55, 0.817, 0.57, 0.025, 0.008, 0.19, metal);
    this.cylinder("Plate", -1.85, 0.82, 0.44, 0.18, 0.02, cream);
    box("Bread", -1.85, 0.86, 0.44, 0.18, 0.06, 0.15, this.material(0x957144));
    const clothMaterial = this.material(0x827b68, this.texture("tile"));
    box("Tea_Towel", -2.42, 0.976, -1.96, 0.4, 0.02, 0.4, clothMaterial);
    box("Hanging_Towel", -2.42, 0.79, -1.58, 0.4, 0.38, 0.02, clothMaterial);
    const bulb = new THREE.MeshStandardMaterial({ color: 0xffdc99, emissive: 0xffbf68, emissiveIntensity: 3 });
    this.materials.add(bulb);
    this.cylinder("Light_Cord", 0, 2.8, -0.4, 0.012, 0.4, dark);
    this.cylinder("Pendant_Shade", 0, 2.54, -0.4, 0.24, 0.16, green);
    this.cylinder("Bulb", 0, 2.44, -0.4, 0.06, 0.09, bulb);
    const light = new THREE.PointLight(0xffcf8c, 17, 9, 2);
    light.position.set(0, 2.35, -0.4); light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -0.001; light.shadow.normalBias = 0.035;
    this.root.add(light);
    const moon = new THREE.PointLight(0x8eb5d2, 5, 6, 2);
    moon.position.set(-2.65, 1.95, -0.2); this.root.add(moon);
    const inspect = (object: THREE.Object3D, label: string, text: string) => this.interactions.push({ id: `kitchen:${object.name}`, object, verb: "Examine", label, range: 2.4, onInteract: () => message(text) });
    inspect(mug, "the forgotten cup", "A skin has formed over the tea. A teaspoon lies beside the cup. Someone left in a hurry—or meant to come back.");
    inspect(fridge, "the refrigerator", "The refrigerator hums. A scrap of paper is pinned to its door, too faded to read. There is no date.");
    inspect(stove, "the cooker", "All four rings are cold. Grease has settled around the controls. Nothing here tells you when it was last used.");
    inspect(door, "the hall door", "The rest of the house lies beyond this door. This section is not connected yet.");
  }

  private material(color: number, map?: THREE.Texture, metalness = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, map, roughness: metalness ? 0.4 : 0.92, metalness });
    this.materials.add(material); return material;
  }

  private box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, solid = false): THREE.Mesh {
    const mesh = new THREE.Mesh(this.cube, material);
    mesh.name = name; mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
    mesh.castShadow = true; mesh.receiveShadow = true; this.root.add(mesh);
    if (solid) this.colliders.push(new THREE.Box3(new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2), new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)));
    return mesh;
  }

  private cylinder(name: string, x: number, y: number, z: number, radius: number, height: number, material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; this.root.add(mesh);
    return mesh;
  }

  /** Small deterministic textures generated once; no downloads or per-frame work. */
  private texture(kind: "plaster" | "wood" | "tile" | "floor"): THREE.CanvasTexture {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    let seed = 71;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    ctx.fillStyle = "#c8c3b5"; ctx.fillRect(0, 0, 256, 256);
    if (kind === "tile" || kind === "floor") {
      const size = kind === "floor" ? 32 : 64;
      for (let x = 0; x < 256; x += size) for (let y = 0; y < 256; y += size) {
        ctx.fillStyle = kind === "floor" && (x / size + y / size) % 2 ? "#555c54" : "#c8c3b5";
        ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
      }
    }
    for (let i = 0; i < 6500; i++) {
      ctx.fillStyle = `rgba(35,29,19,${rand() * 0.14})`;
      ctx.fillRect(rand() * 256, rand() * 256, kind === "wood" ? 30 + rand() * 80 : 1 + rand() * 4, 1 + rand() * 2);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.add(texture); return texture;
  }

  dispose(): void {
    this.root.traverse(o => { if (o instanceof THREE.Light) o.dispose(); });
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.root.removeFromParent();
  }
}
