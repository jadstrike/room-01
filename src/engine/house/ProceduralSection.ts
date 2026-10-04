import * as THREE from "three";
import type { Interactable } from "../Interact";
import type { HouseSection } from "./HouseSection";

/** Shared resource ownership for authored house rooms, independent of maze topology. */
export abstract class ProceduralSection implements HouseSection {
  readonly root = new THREE.Group();
  readonly colliders: THREE.Box3[] = [];
  readonly interactions: Interactable[] = [];
  abstract readonly bounds: THREE.Box3;
  abstract readonly dustOrigin: THREE.Vector3;
  abstract readonly spawn: THREE.Vector3;
  abstract readonly lookAt: THREE.Vector3;
  abstract readonly ports: HouseSection["ports"];
  protected geometries = new Set<THREE.BufferGeometry>();
  protected materials = new Set<THREE.Material>();
  protected textures = new Set<THREE.Texture>();
  private cube = new THREE.BoxGeometry(1, 1, 1);

  constructor() { this.geometries.add(this.cube); }

  protected material(color: number, map?: THREE.Texture, metalness = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, map: map ?? null, roughness: metalness ? 0.4 : 0.92, metalness });
    this.materials.add(material); return material;
  }

  protected box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, solid = false): THREE.Mesh {
    const mesh = new THREE.Mesh(this.cube, material);
    mesh.name = name; mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
    mesh.castShadow = true; mesh.receiveShadow = true; this.root.add(mesh);
    if (solid) this.colliders.push(new THREE.Box3(new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2), new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)));
    return mesh;
  }

  protected cylinder(name: string, x: number, y: number, z: number, radius: number, height: number, material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; this.root.add(mesh);
    return mesh;
  }

  /** Small deterministic textures generated once; no downloads or per-frame work. */
  protected texture(kind: "plaster" | "wood" | "tile" | "floor" | "fabric" | "rug"): THREE.CanvasTexture {
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
    if (kind === "fabric" || kind === "rug") {
      ctx.strokeStyle = "rgba(40,32,22,.18)"; ctx.lineWidth = 1;
      for (let i = 0; i < 256; i += 4) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
      }
      if (kind === "rug") {
        ctx.strokeStyle = "#5a4530";
        for (const inset of [10, 16, 30]) ctx.strokeRect(inset, inset, 256 - inset * 2, 256 - inset * 2);
        for (let x = 55; x < 220; x += 48) for (let y = 55; y < 220; y += 48) {
          ctx.beginPath(); ctx.moveTo(x, y - 13); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 13); ctx.lineTo(x - 10, y); ctx.closePath(); ctx.stroke();
        }
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
