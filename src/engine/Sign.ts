import * as THREE from "three";

const MAX_SIDE = 1024;

/**
 * The picture on the chair character's sign. The model keeps a square
 * `SignImage` plane over an ivory board; a picture is contained on it without
 * cropping or stretching (the board shows round a portrait or landscape), and
 * the surface stays lit and weathered like the rest of the room.
 */
export class SignPicture {
  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshStandardMaterial | null = null;
  private baseScale = new THREE.Vector3(1, 1, 1);
  private placeholder: THREE.Texture | null = null;
  private owned: THREE.Texture | null = null;
  private version = 0;

  /** Each sign keeps its own picture on this device, under its own key. */
  constructor(private storageKey: string) {}

  attach(root: THREE.Object3D): boolean {
    this.release();
    const mesh = root.getObjectByName("SignImage") as THREE.Mesh | undefined;
    if (!mesh?.isMesh) {
      this.mesh = this.material = null;
      return false;
    }
    this.mesh = mesh;
    this.material = mesh.material as THREE.MeshStandardMaterial;
    this.baseScale.copy(mesh.scale);
    this.placeholder = this.material.map ?? null;
    return true;
  }

  get available(): boolean {
    return this.mesh !== null;
  }

  get custom(): boolean {
    return this.owned !== null;
  }

  /** Show a picture from a file, blob or data URL. Resolves false if a newer call won. */
  async set(source: Blob | string, remember = true): Promise<boolean> {
    if (!this.mesh || !this.material) return false;
    const version = ++this.version;
    const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
    let bitmap = await createImageBitmap(blob);
    const fit = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (fit < 1) {
      const full = bitmap;
      bitmap = await createImageBitmap(full, {
        resizeWidth: Math.round(full.width * fit),
        resizeHeight: Math.round(full.height * fit),
        resizeQuality: "high",
      });
      full.close();
    }
    if (version !== this.version || !this.mesh || !this.material) {
      bitmap.close();
      return false;
    }

    // glTF UVs put the top of the image at v = 0, which is how a bitmap already reads.
    const tex = new THREE.Texture(bitmap);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    this.material.map = tex;
    this.material.needsUpdate = true;
    this.owned?.dispose();
    this.owned = tex;

    const aspect = bitmap.width / bitmap.height;
    this.mesh.scale.set(this.baseScale.x * Math.min(1, aspect), this.baseScale.y * Math.min(1, 1 / aspect), this.baseScale.z);
    if (remember) save(this.storageKey, bitmap);
    return true;
  }

  /** Put the placeholder face back and forget the saved picture. */
  reset(): void {
    this.version++;
    if (this.mesh && this.material) {
      this.material.map = this.placeholder;
      this.material.needsUpdate = true;
      this.mesh.scale.copy(this.baseScale);
    }
    this.owned?.dispose();
    this.owned = null;
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Storage can be unavailable (private mode); the reset still applies.
    }
  }

  /** The picture saved on this device, if any. */
  saved(): string | null {
    try {
      return localStorage.getItem(this.storageKey);
    } catch {
      return null;
    }
  }

  private release(): void {
    this.version++;
    this.owned?.dispose();
    this.owned = null;
  }

  dispose(): void {
    this.release();
    this.mesh = this.material = null;
  }
}

/** Keep a small JPEG so the picture survives a reload; too big or no storage just means it is not kept. */
function save(key: string, bitmap: ImageBitmap): void {
  try {
    const fit = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * fit));
    canvas.height = Math.max(1, Math.round(bitmap.height * fit));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    localStorage.setItem(key, canvas.toDataURL("image/jpeg", 0.85));
  } catch {
    // Quota exceeded or storage blocked.
  }
}
