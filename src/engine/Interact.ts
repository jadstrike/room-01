import * as THREE from "three";

/**
 * Centre-screen raycast interaction, the way an FPS does it: whatever the
 * crosshair is actually over wins. Occlusion is free because we raycast the
 * whole scene and then walk the hit object's ancestors looking for something
 * registered - a prop behind a wall simply never produces the nearest hit.
 *
 * The game layer registers its own targets through register(); nothing here
 * knows what the objects mean.
 */

export type Interactable = {
  id: string;
  object: THREE.Object3D;
  /** Shown in the HUD prompt as "<verb> <label>". */
  verb: string;
  label: string;
  /** Metres. Beyond this the prompt does not appear. */
  range?: number;
  onInteract?: (self: Interactable) => void;
};

export type FocusInfo = {
  id: string;
  verb: string;
  label: string;
  distance: number;
};

const DEFAULT_RANGE = 2.4;

export class Interact {
  focus: FocusInfo | null = null;
  /** Called when the focused target changes (including to null). */
  onFocusChange: ((focus: FocusInfo | null) => void) | null = null;

  private items = new Map<THREE.Object3D, Interactable>();
  private roots: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private centre = new THREE.Vector2(0, 0);

  constructor() {
    this.raycaster.far = 8;
  }

  /** What the ray is cast against - normally the room and the character. */
  setRoots(roots: THREE.Object3D[]): void {
    this.roots = roots;
  }

  register(item: Interactable): () => void {
    this.items.set(item.object, item);
    return () => {
      this.items.delete(item.object);
      if (this.focus?.id === item.id) this.setFocus(null);
    };
  }

  clear(): void {
    this.items.clear();
    this.setFocus(null);
  }

  update(camera: THREE.Camera): void {
    if (!this.items.size || !this.roots.length) {
      this.setFocus(null);
      return;
    }
    this.raycaster.setFromCamera(this.centre, camera);
    const hits = this.raycaster.intersectObjects(this.roots, true);
    for (const hit of hits) {
      const item = this.findRegistered(hit.object);
      if (!item) {
        // Nearest thing under the crosshair is not interactable: it occludes.
        this.setFocus(null);
        return;
      }
      if (hit.distance > (item.range ?? DEFAULT_RANGE)) {
        this.setFocus(null);
        return;
      }
      this.setFocus({ id: item.id, verb: item.verb, label: item.label, distance: hit.distance });
      return;
    }
    this.setFocus(null);
  }

  /** Fires the focused target's handler. Returns whether anything happened. */
  trigger(): boolean {
    if (!this.focus) return false;
    for (const item of this.items.values()) {
      if (item.id === this.focus.id) {
        item.onInteract?.(item);
        return true;
      }
    }
    return false;
  }

  private findRegistered(object: THREE.Object3D): Interactable | null {
    let node: THREE.Object3D | null = object;
    while (node) {
      const item = this.items.get(node);
      if (item) return item;
      node = node.parent;
    }
    return null;
  }

  private setFocus(next: FocusInfo | null): void {
    const same = next?.id === this.focus?.id;
    this.focus = next;
    if (!same) this.onFocusChange?.(next);
  }
}
