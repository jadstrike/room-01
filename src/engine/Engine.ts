import * as THREE from "three";
import { Store } from "./store";
import { Room, PROP_INTERACTIONS } from "./Room";
import { dressChair } from "./ChairDressing";
import { Character } from "./Character";
import { Player } from "./Player";
import { Interact, type FocusInfo, type Interactable } from "./Interact";
import { Post } from "./Post";
import { Flicker } from "./Flicker";
import { Dust } from "./Dust";
import { Audio } from "./Audio";
import { ROOM01 } from "./room01";

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

export type EngineState = {
  phase: "loading" | "ready" | "error";
  error: string | null;
  locked: boolean;
  focus: FocusInfo | null;
  clips: string[];
  clipIndex: number;
  flicker: boolean;
  sound: boolean;
  quality: boolean;
  autoScale: boolean;
  headBob: boolean;
  exposure: number;
  sensitivity: number;
  fov: number;
  debug: boolean;
  doorOpen: boolean;
  /** Keeps the player inside the room even when the door is open. */
  confineToRoom: boolean;
  specOk: boolean;
  message: string;
  stats: { fps: number; triangles: number; roomMeshes: number; characterHeight: number; scaled: boolean };
};

export const INITIAL_STATE: EngineState = {
  phase: "loading",
  error: null,
  locked: false,
  focus: null,
  clips: [],
  clipIndex: -1,
  flicker: true,
  sound: false,
  quality: true,
  autoScale: true,
  headBob: true,
  exposure: 1.5,
  sensitivity: 2.2,
  fov: 75,
  debug: false,
  doorOpen: false,
  confineToRoom: true,
  specOk: true,
  message: "",
  stats: { fps: 0, triangles: 0, roomMeshes: 0, characterHeight: 0, scaled: false },
};

/**
 * Owns the renderer, the scene and the frame loop. React mounts one of these
 * and reads discrete state through store.subscribe(); per-frame values live on
 * `live` and are read by an rAF in the components that need them, so the render
 * loop never causes a React re-render.
 */
export class Engine {
  readonly store = new Store<EngineState>(INITIAL_STATE);
  /** Mutable per-frame values. Read these imperatively, never via setState. */
  readonly live = { speed01: 0, bulb: 1, fps: 0 };

  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly player: Player;
  readonly interact = new Interact();

  room: Room | null = null;
  character: Character | null = null;

  private renderer: THREE.WebGLRenderer;
  private post: Post;
  private flicker = new Flicker(true);
  private dust = new Dust();
  private audio: Audio | null = null;
  private timer = new THREE.Timer();
  private debugGroup = new THREE.Group();
  private unregister: Array<() => void> = [];
  private resizeObserver: ResizeObserver;
  private frames = 0;
  private fpsAccum = 0;
  private statAccum = 0;
  private interactAccum = 0;
  private reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = INITIAL_STATE.exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color(0x030304);
    this.scene.fog = new THREE.FogExp2(0x040406, 0.075);
    this.scene.add(new THREE.HemisphereLight(0x3a4866, 0x1a110a, 1.3));
    this.scene.add(this.dust.points);
    this.debugGroup.visible = false;
    this.scene.add(this.debugGroup);

    this.camera = new THREE.PerspectiveCamera(INITIAL_STATE.fov, 1, 0.02, 60);
    this.post = new Post(this.renderer, this.scene, this.camera);

    this.player = new Player(this.camera, canvas, {
      sensitivity: INITIAL_STATE.sensitivity,
      headBob: INITIAL_STATE.headBob,
    });
    this.player.onLockChange = (locked) => this.store.set({ locked });
    this.player.onStep = (hard) => this.audio?.footstep(hard);
    this.flicker.enabled = !this.reduceMotion;
    this.store.set({ flicker: this.flicker.enabled });

    this.interact.onFocusChange = (focus) => {
      this.store.set({ focus });
      if (focus) this.audio?.blip(360, 0.05);
    };

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    window.addEventListener("keydown", this.onKeyDown);
    canvas.addEventListener("mousedown", this.onMouseDown);
    this.resize();
  }

  async init(): Promise<void> {
    try {
      const room = await Room.load(ASSETS.room);
      if (this.disposed) return room.dispose();
      this.room = room;
      this.scene.add(room.root);
      this.dust.setBulbPosition(room.bulbWorldPosition);
      this.player.setBounds(room.bounds);
      this.player.setColliders(room.colliders);
      this.player.setConfinement(ROOM01.walkable.room);
      this.interact.setRoots([room.root]);

      // Spec markers, not the GLB's camera nodes: the player's eye height comes
      // from the capsule, so only the XZ of CameraStart is meaningful here.
      this.player.spawnAt(ROOM01.markers.cameraStart, ROOM01.markers.cameraTarget);

      this.registerProps();
      this.buildDebug();

      const check = room.verifyAgainstSpec();
      this.store.set({ specOk: check.ok });
      if (check.ok) {
        console.info("[room] matches ROOM01_SPEC", check.report);
      } else {
        console.warn("[room] does NOT match ROOM01_SPEC", check.report);
      }

      await this.setCharacter(await Character.fromURL(ASSETS.character));
      if (this.disposed) return;

      this.store.set({ phase: "ready", message: "Click to look around. WASD to move, E to interact." });
      this.renderer.setAnimationLoop(this.frame);
    } catch (error) {
      console.error(error);
      this.store.set({ phase: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }

  // --- character ---------------------------------------------------------
  async setCharacter(next: Character): Promise<void> {
    const room = this.room;
    if (!room || this.disposed) return next.dispose();
    this.character?.dispose();
    this.character = next;
    dressChair(next.root, room.root);
    room.spawn.add(next.root);
    next.fit(this.store.get().autoScale);
    const clipIndex = next.defaultClipIndex;
    if (clipIndex >= 0) next.playClip(clipIndex);

    this.refreshColliders();
    this.interact.setRoots([room.root]); // the character hangs off the room graph
    this.store.set({
      clips: next.clipNames,
      clipIndex,
      message: `Loaded character · ${next.clips.length} clip(s) · ${next.authoredHeight.toFixed(2)} m as authored`,
    });
    this.registerCharacter();
  }

  /** Load a character the user picked or dropped. */
  async loadCharacterFiles(files: FileList | File[]): Promise<void> {
    try {
      await this.setCharacter(await Character.fromFiles([...files]));
    } catch (error) {
      this.store.set({ message: `Could not load that file: ${error instanceof Error ? error.message : error}` });
    }
  }

  setAutoScale(on: boolean): void {
    this.store.set({ autoScale: on });
    this.character?.fit(on);
    this.refreshColliders();
  }

  selectClip(index: number): void {
    this.character?.playClip(index);
    this.store.set({ clipIndex: index });
  }

  private refreshColliders(): void {
    if (!this.room) return;
    const boxes = [...this.room.colliders];
    if (this.character) {
      this.character.refreshCollider();
      boxes.push(this.character.collider);
    }
    this.player.setColliders(boxes);
    this.buildDebug();
  }

  // --- interaction -------------------------------------------------------
  /** The game layer can register its own targets on top of these. */
  register(item: Interactable): () => void {
    const off = this.interact.register(item);
    this.unregister.push(off);
    return off;
  }

  private registerCharacter(): void {
    if (!this.character) return;
    this.register({
      id: "character",
      object: this.character.root,
      verb: "Examine",
      label: "The figure",
      // Seated back against the chair, the figure is 2.62 m from the spawn point.
      range: 2.8,
      onInteract: () => {
        this.audio?.blip(220, 0.12);
        this.store.set({ message: "It is tied to the chair. Where its face should be, there is only a sign." });
      },
    });
  }

  private registerProps(): void {
    const room = this.room;
    if (!room) return;
    for (const prop of PROP_INTERACTIONS) {
      const object = room.root.getObjectByName(prop.node);
      if (!object) continue;
      const item: Interactable = {
        id: prop.node,
        object,
        verb: prop.verb,
        label: prop.label,
        range: prop.range,
        onInteract: () => {
          if (prop.node === "Door") {
            const open = room.toggleDoor();
            item.verb = open ? "Close" : "Open";
            this.store.set({
              doorOpen: open,
              focus: { id: item.id, verb: item.verb, label: item.label, distance: 0 },
              message: open ? "The hallway is darker than the room." : "The latch does not sound like it caught.",
            });
            this.audio?.blip(160, 0.2);
            return;
          }
          this.audio?.blip(300, 0.06);
          this.store.set({ message: `${prop.verb} ${prop.label} — nothing here yet.` });
        },
      };
      this.register(item);
    }
  }

  triggerInteract(): void {
    if (!this.player.locked) return;
    this.interact.trigger();
  }

  // --- settings ----------------------------------------------------------
  setFlicker(on: boolean): void {
    this.flicker.enabled = on;
    this.store.set({ flicker: on });
  }

  setQuality(on: boolean): void {
    this.post.setQuality(on);
    this.store.set({ quality: on });
  }

  setExposure(value: number): void {
    this.renderer.toneMappingExposure = value;
    this.store.set({ exposure: value });
  }

  setSensitivity(value: number): void {
    this.player.setOptions({ sensitivity: value });
    this.store.set({ sensitivity: value });
  }

  setHeadBob(on: boolean): void {
    this.player.setOptions({ headBob: on });
    this.store.set({ headBob: on });
  }

  setFov(value: number): void {
    this.store.set({ fov: value });
    this.resize();
  }

  toggleSound(): void {
    if (this.audio) {
      this.audio.close();
      this.audio = null;
      this.store.set({ sound: false });
      return;
    }
    this.audio = new Audio();
    this.store.set({ sound: true });
  }

  setDebug(on: boolean): void {
    this.debugGroup.visible = on;
    this.store.set({ debug: on });
  }

  /** Off lets the player walk through the doorway into the hallway. */
  setConfineToRoom(on: boolean): void {
    this.player.setConfinement(on ? ROOM01.walkable.room : null);
    this.store.set({ confineToRoom: on });
  }

  requestLock(): void {
    this.player.requestLock();
  }

  // --- internals ---------------------------------------------------------
  private buildDebug(): void {
    this.debugGroup.clear();
    if (!this.room) return;
    const bounds = new THREE.Box3().copy(this.room.bounds);
    this.debugGroup.add(new THREE.Box3Helper(bounds, new THREE.Color(0x4ad3a1)));
    for (const box of this.room.colliders) {
      this.debugGroup.add(new THREE.Box3Helper(box, new THREE.Color(0x8e1b17)));
    }
    if (this.character) {
      this.debugGroup.add(new THREE.Box3Helper(this.character.collider, new THREE.Color(0xd8d2c4)));
    }
  }

  private resize(): void {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    // Portrait screens need a wider vertical FOV to keep the room readable.
    this.camera.fov = w < h ? this.store.get().fov * 1.18 : this.store.get().fov;
    this.camera.updateProjectionMatrix();
  }

  private onMouseDown = (e: MouseEvent): void => {
    // The first click only grabs the pointer; once locked, clicking interacts.
    if (this.player.locked && e.button === 0) this.triggerInteract();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Backquote") {
      this.setDebug(!this.store.get().debug);
      return;
    }
    if (!this.player.locked) return;
    if (e.code === "KeyE") this.triggerInteract();
  };

  private frame = (now: number): void => {
    this.timer.update(now);
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();

    this.player.update(dt);
    // The raycast walks the whole room, so run it at 30 Hz rather than every
    // frame: still well inside the time it takes to read the prompt.
    if ((this.interactAccum += dt) >= 1 / 30) {
      this.interactAccum = 0;
      this.interact.update(this.camera);
    }

    const level = this.flicker.level(t);
    this.room?.setBulbLevel(level);
    this.room?.update(dt);
    this.character?.update(dt);
    this.dust.update(this.reduceMotion ? 0 : t, level);
    this.audio?.setBulbLevel(level);

    this.live.speed01 = this.player.speed01;
    this.live.bulb = level;

    this.post.render(t, dt);

    this.frames++;
    this.fpsAccum += dt;
    if (this.fpsAccum >= 0.5) {
      this.live.fps = Math.round(this.frames / this.fpsAccum);
      this.frames = 0;
      this.fpsAccum = 0;
    }
    if ((this.statAccum += dt) >= 1) {
      this.statAccum = 0;
      this.publishStats();
    }
  };

  private publishStats(): void {
    let triangles = 0;
    let roomMeshes = 0;
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const g = mesh.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    this.room?.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) roomMeshes++;
    });
    this.store.set({
      stats: {
        fps: this.live.fps,
        triangles: Math.round(triangles),
        roomMeshes,
        characterHeight: this.character?.height ?? 0,
        scaled: this.character?.scaled ?? false,
      },
    });
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.resizeObserver.disconnect();
    for (const off of this.unregister) off();
    this.unregister = [];
    this.interact.clear();
    this.player.dispose();
    this.audio?.close();
    this.character?.dispose();
    this.room?.dispose();
    this.dust.dispose();
    this.post.dispose();
    this.renderer.dispose();
  }
}
