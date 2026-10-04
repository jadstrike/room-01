import * as THREE from "three";
import { Store } from "./store";
import { Viewmodel, VIEWMODEL_LAYER } from "./Viewmodel";
import { WeaponModel } from "./WeaponModel";
import { Weapon, type WeaponState } from "./Weapon";
import { Impacts } from "./Impacts";
import { PISTOL } from "./weapons";
import { Player } from "./Player";
import { Interact, type FocusInfo, type Interactable } from "./Interact";
import { Post } from "./Post";
import { Flicker } from "./Flicker";
import { Dust } from "./Dust";
import { Audio } from "./Audio";
import { Character } from "./Character";
import { Pacer, AdaptiveResolution, FRAME_CAPS, type FrameCap, type PaceMode } from "./Pacer";
import { Game, INITIAL_GAME, type GameState } from "./Game";
import type { Level, Report } from "./levels/Level";
import type { DialogueView } from "../story/dialogue";

/** What the loading screen shows. */
export type Card = { title: string; line?: string };

export type Transition = Card & { step: string; progress: number };

export type EngineState = GameState & {
  phase: "loading" | "ready" | "error";
  error: string | null;
  /** The loading screen, while one level is being swapped for another. */
  transition: Transition | null;
  locked: boolean;
  focus: FocusInfo | null;
  clips: string[];
  clipIndex: number;
  flicker: boolean;
  sound: boolean;
  quality: boolean;
  /** Frames per second while playing; 0 renders every display refresh. */
  frameCap: FrameCap;
  /** Lower the render resolution when the frame rate cannot hold. */
  autoResolution: boolean;
  autoScale: boolean;
  headBob: boolean;
  exposure: number;
  sensitivity: number;
  fov: number;
  debug: boolean;
  doorOpen: boolean;
  /** Keeps the player inside the room even when a door is open. */
  confineToRoom: boolean;
  specOk: boolean;
  message: string;
  weapon: WeaponState | null;
  /** Each accused's sign, and whether it shows the player's picture. */
  signs: { id: string; label: string; custom: boolean }[];
  /** The conversation on screen, if any. */
  dialogue: DialogueView | null;
  stats: { fps: number; triangles: number; meshes: number; characterHeight: number; scaled: boolean; renderScale: number };
};

export const INITIAL_STATE: EngineState = {
  ...INITIAL_GAME,
  phase: "loading",
  error: null,
  transition: { title: "", step: "", progress: 0 },
  locked: false,
  focus: null,
  clips: [],
  clipIndex: -1,
  flicker: true,
  // On, but the AudioContext only starts with the click that begins play.
  sound: true,
  quality: true,
  frameCap: 60,
  autoResolution: true,
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
  weapon: null,
  signs: [],
  dialogue: null,
  stats: { fps: 0, triangles: 0, meshes: 0, characterHeight: 0, scaled: false, renderScale: 1 },
};

/** Matches the loading screen's CSS fade. */
const FADE_MS = 320;
/** Moving shadow casters (the entity, the door) do not need their shadows redrawn every frame. */
const SHADOW_HZ = 30;

/**
 * Owns the renderer, the scene and the frame loop, and hosts one level at a
 * time. React mounts one of these and reads discrete state through
 * store.subscribe(); per-frame values live on `live` and are read by an rAF in
 * the components that need them, so the render loop never causes a re-render.
 * What happens in the world is the Game's business (`game`).
 */
export class Engine {
  readonly store = new Store<EngineState>(INITIAL_STATE);
  /** Mutable per-frame values. Read these imperatively, never via setState. */
  readonly live = { speed01: 0, bulb: 1, fps: 0, bloom01: 0 };

  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly player: Player;
  readonly interact = new Interact();
  readonly game: Game;
  /** The level in the scene, or null while the loading screen is up. */
  level: Level | null = null;
  weapon: Weapon | null = null;
  audio: Audio | null = null;

  private renderer: THREE.WebGLRenderer;
  private post: Post;
  private flicker = new Flicker(true);
  private dust = new Dust();
  private viewmodel = new Viewmodel();
  private impacts = new Impacts();
  private timer = new THREE.Timer();
  private debugGroup = new THREE.Group();
  /** Interactions registered for the current level; cleared when it is left. */
  private scope: Array<() => void> = [];
  private resizeObserver: ResizeObserver;
  private pacer = new Pacer();
  private resolution = new AdaptiveResolution();
  /** Whether the frame loop should run while the tab is visible. */
  private running = false;
  /** Bumped by each enter(), so a slow load cannot land after a newer one. */
  private entering = 0;
  private shadowAccum = 0;
  /** The view's yaw before the title screen's drift took over. */
  private attractYaw: number | null = null;
  private frames = 0;
  private fpsAccum = 0;
  private statAccum = 0;
  private interactAccum = 0;
  private wheelCooldown = 0;
  private reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(basePixelRatio());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = INITIAL_STATE.exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Every renderer.render() would otherwise redraw every shadow map - and
    // the post chain renders the scene three times a frame (scene, GTAO
    // normals, viewmodel). Shadows are redrawn only when a level asks.
    this.renderer.shadowMap.autoUpdate = false;

    this.scene.background = new THREE.Color(0x030304);
    this.scene.fog = new THREE.FogExp2(0x040406, 0.075);
    const ambient = new THREE.HemisphereLight(0x3a4866, 0x1a110a, 1.3);
    ambient.layers.enable(VIEWMODEL_LAYER);
    this.scene.add(ambient);
    this.scene.add(this.viewmodel.camera);
    this.scene.add(this.impacts.group);
    this.scene.add(this.dust.points);
    this.debugGroup.visible = false;
    this.scene.add(this.debugGroup);

    this.camera = new THREE.PerspectiveCamera(INITIAL_STATE.fov, 1, 0.02, 60);
    this.post = new Post(this.renderer, this.scene, this.camera);
    this.post.addViewmodel(this.scene, this.viewmodel.camera);

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

    this.game = new Game(this);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    window.addEventListener("keydown", this.onKeyDown);
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("wheel", this.onWheel, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibility);
    this.loadPerformance();
    this.resize();
  }

  async init(): Promise<void> {
    // Loads alongside the first level; until it arrives, the procedural pistol stands in.
    const gunModel = PISTOL.viewmodel
      ? WeaponModel.load(PISTOL.viewmodel).catch((error) => {
          console.warn("[weapon] could not load the pistol model, using the built-in one", error);
          return null;
        })
      : Promise.resolve(null);
    this.equip();
    void gunModel.then((model) => {
      if (this.disposed) model?.dispose();
      else if (model) this.viewmodel.useModel(model);
    });
    await this.game.start();
  }

  // --- levels ------------------------------------------------------------------
  /**
   * Swap the current level for the one `load` produces, behind the loading
   * screen: fade to black, stop rendering, let the old level go, build the
   * new one, compile its shaders and draw its shadows once, fade back in.
   * Nothing is rendered while the CPU is busy loading, and the first frame of
   * the new level does not stall on shader compilation.
   *
   * Returns false if the load failed or a newer enter() overtook this one.
   */
  async enter(load: (report: Report) => Level | Promise<Level>, card: Card): Promise<boolean> {
    const token = ++this.entering;
    const report: Report = (step, progress) => {
      if (token === this.entering) this.store.set({ transition: { ...card, step, progress } });
    };
    this.store.set({ transition: { ...card, step: "", progress: 0 }, focus: null, message: "" });
    this.player.frozen = true;
    if (this.level) await wait(FADE_MS);
    if (token !== this.entering || this.disposed) return false;

    this.stopLoop();
    this.leaveLevel();
    let level: Level;
    try {
      level = await load(report);
    } catch (error) {
      console.error(error);
      this.store.set({ phase: "error", error: error instanceof Error ? error.message : String(error), transition: null });
      return false;
    }
    // A persistent level overtaken by a newer enter() is still the Game's to keep; a closed engine keeps nothing.
    if (this.disposed || token !== this.entering) {
      if (this.disposed || !level.persistent) level.dispose();
      return false;
    }

    this.attach(level);
    report("Preparing the light", 0.92);
    // Behind the black screen either way; compiling in parallel just keeps the page responsive while it happens.
    if (this.renderer.extensions.has("KHR_parallel_shader_compile")) await this.renderer.compileAsync(this.scene, this.camera);
    else this.renderer.compile(this.scene, this.camera);
    if (token !== this.entering || this.disposed) return false;
    this.renderer.shadowMap.needsUpdate = true;
    this.player.frozen = false;
    this.store.set({ phase: "ready", transition: null });
    this.startLoop();
    return true;
  }

  private leaveLevel(): void {
    for (const off of this.scope) off();
    this.scope = [];
    this.interact.clear();
    this.interact.setRoots([]);
    this.impacts.clear();
    const old = this.level;
    this.level = null;
    if (!old) return;
    old.root.removeFromParent();
    if (!old.persistent) old.dispose();
  }

  private attach(level: Level): void {
    this.level = level;
    this.scene.add(level.root);
    // Lights only reach cameras that share a layer with them.
    level.root.traverse((o) => {
      if ((o as THREE.Light).isLight) o.layers.enable(VIEWMODEL_LAYER);
    });
    this.player.setBounds(level.bounds);
    this.player.setColliders(level.colliders);
    this.player.setConfinement(this.store.get().confineToRoom ? level.confine : null);
    this.player.spawnAt(level.spawn, level.lookAt);
    // The title screen's drift starts again from the new view, not the last level's.
    this.attractYaw = null;
    this.interact.setRoots(level.raycastRoots());
    this.dust.setBulbPosition(level.lightPosition);
    this.buildDebug();
  }

  /** Static shadows are drawn once; call this when one of their casters goes away. */
  redrawShadows(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** Raycast roots and colliders change when something joins or leaves the level. */
  refreshLevel(): void {
    const level = this.level;
    if (!level) return;
    this.interact.setRoots(level.raycastRoots());
    this.player.setColliders(level.colliders);
    this.player.setConfinement(this.store.get().confineToRoom ? level.confine : null);
    this.buildDebug();
  }

  // --- interaction -------------------------------------------------------
  /** Register a target for the current level; it goes when the level does. */
  register(item: Interactable): () => void {
    const off = this.interact.register(item);
    this.scope.push(off);
    return off;
  }

  triggerInteract(): void {
    if (!this.player.locked) return;
    this.interact.trigger();
  }

  // --- weapon ----------------------------------------------------------------
  private equip(): void {
    const weapon = new Weapon(PISTOL, this.viewmodel, (pitch, yaw) => this.player.punch(pitch, yaw));
    weapon.onChange = (state) => this.store.set({ weapon: state });
    weapon.onShot = (hit) => {
      this.audio?.gunshot();
      if (hit && !this.game.onShot(hit)) this.impacts.add(hit);
    };
    weapon.onDryFire = () => this.audio?.dryFire();
    weapon.onReload = (empty) => this.audio?.reload(empty, empty ? PISTOL.reloadEmptyTime : PISTOL.reloadTime);
    this.weapon = weapon;
    this.store.set({ weapon: weapon.state });
  }

  /** A fresh magazine and reserve, as at the start of the story. */
  resetWeapon(): void {
    const weapon = this.weapon;
    if (!weapon) return;
    weapon.ammo = PISTOL.magSize;
    weapon.reserve = PISTOL.reserve;
    this.store.set({ weapon: weapon.state });
  }

  fire(): void {
    if (!this.player.locked || !this.weapon || !this.level) return;
    this.weapon.trigger({
      camera: this.camera,
      speed01: this.player.speed01,
      onGround: this.player.onGround,
      roots: this.level.raycastRoots(),
    });
  }

  reload(): void {
    if (this.player.locked) this.weapon?.reload();
  }

  /** Put the gun away (true) or draw it (false). */
  setHolstered(on: boolean): void {
    if (this.weapon?.setHolstered(on)) this.audio?.holster(!on);
  }

  private onWheel = (e: WheelEvent): void => {
    // One slot for now, so any scroll swaps between the gun and empty hands.
    if (!this.player.locked || Math.abs(e.deltaY) < 1 || this.wheelCooldown > 0) return;
    this.wheelCooldown = 0.25;
    this.setHolstered(!this.weapon?.state.holstered);
  };

  // --- Room 01 dressing: the figure in the chairs, and the pictures on their signs ---
  /** Load a character the user picked or dropped, into every chair. */
  async loadCharacterFiles(files: FileList | File[]): Promise<void> {
    const room = this.game.room01;
    if (!room) return;
    const list = [...files];
    try {
      await room.setCharacters(() => Character.fromFiles(list));
      const first = room.seats[0].character;
      if (first) this.store.set({ message: `Loaded character · ${first.clips.length} clip(s) · ${first.authoredHeight.toFixed(2)} m as authored` });
      if (this.level === room) this.refreshLevel();
    } catch (error) {
      this.store.set({ message: `Could not load that file: ${error instanceof Error ? error.message : error}` });
    }
  }

  setAutoScale(on: boolean): void {
    this.store.set({ autoScale: on });
    this.game.room01?.setAutoScale(on);
    if (this.level === this.game.room01) this.refreshLevel();
  }

  selectClip(index: number): void {
    this.game.room01?.selectClip(index);
    this.store.set({ clipIndex: index });
  }

  /** Put the player's picture on one accused's sign. */
  async setSignPicture(id: string, file: Blob): Promise<void> {
    const seat = this.game.room01?.seats.find((s) => s.def.id === id);
    if (!seat?.sign.available) {
      this.store.set({ message: "That figure has no sign to put a picture on." });
      return;
    }
    try {
      if (await seat.sign.set(file)) {
        this.game.publishSeats();
        this.store.set({ message: `Your picture is on the sign of ${seat.def.label.toLowerCase()} now.` });
      }
    } catch {
      this.store.set({ message: "Could not read that picture. Try a .jpg, .png or .webp." });
    }
  }

  resetSignPicture(id: string): void {
    this.game.room01?.seats.find((s) => s.def.id === id)?.sign.reset();
    this.game.publishSeats();
  }

  /** Where a dropped picture goes: the accused under the crosshair, else the first still showing the old face. */
  signDropTarget(): string | null {
    const { signs, focus } = this.store.get();
    return (signs.find((s) => s.id === focus?.id) ?? signs.find((s) => !s.custom) ?? signs[0])?.id ?? null;
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

  setFrameCap(cap: FrameCap): void {
    this.pacer.cap = cap;
    this.store.set({ frameCap: cap });
    this.savePerformance();
  }

  setAutoResolution(on: boolean): void {
    this.resolution.enabled = on;
    this.store.set({ autoResolution: on });
    this.savePerformance();
    if (!on && this.resolution.sample(0, this.pacer.cap)) this.applyPixelRatio();
  }

  private loadPerformance(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(PERFORMANCE_KEY) ?? "null") as Partial<EngineState> | null;
      if (saved && FRAME_CAPS.includes(saved.frameCap as FrameCap)) this.pacer.cap = saved.frameCap as FrameCap;
      if (typeof saved?.autoResolution === "boolean") this.resolution.enabled = saved.autoResolution;
    } catch {
      // Private windows can refuse storage; the defaults are fine.
    }
    this.store.set({ frameCap: this.pacer.cap, autoResolution: this.resolution.enabled });
  }

  private savePerformance(): void {
    const { frameCap, autoResolution } = this.store.get();
    try {
      localStorage.setItem(PERFORMANCE_KEY, JSON.stringify({ frameCap, autoResolution }));
    } catch {
      // As above: the setting still applies for this visit.
    }
  }

  private applyPixelRatio(): void {
    const ratio = basePixelRatio() * this.resolution.scale;
    this.renderer.setPixelRatio(ratio);
    this.post.composer.setPixelRatio(ratio);
    this.resize();
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
    const on = !this.store.get().sound;
    this.store.set({ sound: on });
    if (on) this.startAudio();
    else {
      this.audio?.close();
      this.audio = null;
    }
  }

  /** Browsers only allow audio after a user gesture, so this runs from clicks. */
  private startAudio(): void {
    if (!this.store.get().sound) return;
    if (this.audio) this.audio.resume();
    else {
      this.audio = new Audio();
      if (PISTOL.sounds) void this.audio.loadGunSounds(PISTOL.sounds, import.meta.env.BASE_URL);
    }
  }

  setDebug(on: boolean): void {
    this.debugGroup.visible = on;
    this.store.set({ debug: on });
  }

  /** Off lets the player walk out through an open door. */
  setConfineToRoom(on: boolean): void {
    this.player.setConfinement(on ? (this.level?.confine ?? null) : null);
    this.store.set({ confineToRoom: on });
  }

  requestLock(): void {
    this.startAudio();
    this.player.requestLock();
  }

  // --- internals ---------------------------------------------------------
  private buildDebug(): void {
    for (const child of this.debugGroup.children) disposeHelper(child);
    this.debugGroup.clear();
    for (const { box, color } of this.level?.debugBoxes() ?? []) {
      this.debugGroup.add(new THREE.Box3Helper(box, new THREE.Color(color)));
    }
  }

  private resize(): void {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.viewmodel.setAspect(w / h);
    // Portrait screens need a wider vertical FOV to keep the room readable.
    this.camera.fov = w < h ? this.store.get().fov * 1.18 : this.store.get().fov;
    this.camera.updateProjectionMatrix();
  }

  private onMouseDown = (e: MouseEvent): void => {
    this.startAudio();
    // The first click only grabs the pointer; once locked, clicking fires.
    if (this.player.locked && e.button === 0) this.fire();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const { transition, screen } = this.store.get();
    if (transition || screen !== "game") return;
    if (this.game.onKey(e)) {
      e.preventDefault();
      return;
    }
    if (e.code === "Backquote") {
      this.setDebug(!this.store.get().debug);
      return;
    }
    if (!this.player.locked) return;
    if (e.code === "KeyE") this.triggerInteract();
    if (e.code === "KeyR") this.reload();
    if (e.code === "KeyF") this.weapon?.inspect();
    if (e.code === "Digit1") this.setHolstered(false);
    if (e.code === "Digit2") this.setHolstered(true);
    if (e.code === "KeyQ") this.setHolstered(!this.weapon?.state.holstered);
  };

  // --- frame loop ----------------------------------------------------------
  /** Run the frame loop (whenever the tab is visible). */
  private startLoop(): void {
    this.running = true;
    this.pacer.reset();
    this.resolution.reset();
    this.timer.reset();
    if (!document.hidden) this.renderer.setAnimationLoop(this.frame);
  }

  private stopLoop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  /** A hidden tab renders nothing at all, rather than whatever the browser's throttled rAF allows. */
  private onVisibility = (): void => {
    if (!this.running) return;
    if (document.hidden) {
      this.renderer.setAnimationLoop(null);
      return;
    }
    this.pacer.reset();
    this.resolution.reset();
    this.timer.reset();
    this.renderer.setAnimationLoop(this.frame);
  };

  private paceMode(): PaceMode {
    if (this.player.locked) return "play";
    const { dialogue, panel } = this.store.get();
    return dialogue || panel ? "ambient" : "menu";
  }

  private frame = (now: number): void => {
    this.pacer.mode = this.paceMode();
    if (!this.pacer.tick(now)) return;
    const level = this.level;
    const { ending, screen } = this.store.get();
    // Nothing behind an opaque card (the prologue, an ending) needs drawing.
    if (!level || ending || screen === "prologue") return;
    this.timer.update(now);
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();

    // Behind the title the view drifts a little, as if Rowan were coming round.
    if (screen === "title") {
      this.attractYaw ??= this.player.yaw;
      this.player.yaw = this.attractYaw + Math.sin(t * 0.13) * 0.16;
    } else if (this.attractYaw !== null) {
      this.player.yaw = this.attractYaw;
      this.attractYaw = null;
    }
    // The hands and gun belong to play, not to the title screen.
    this.viewmodel.setShown(screen === "game");
    this.player.update(dt);
    this.game.update();
    // The raycast walks the whole level, so run it at 30 Hz rather than every
    // frame: still well inside the time it takes to read the prompt.
    if ((this.interactAccum += dt) >= 1 / 30) {
      this.interactAccum = 0;
      this.interact.update(this.camera);
    }

    const light = this.flicker.level(t);
    level.setLightLevel(light);
    level.update(dt, { player: this.player.position, light });
    if (level.dynamicShadows && (this.shadowAccum += dt) >= 1 / SHADOW_HZ) {
      this.shadowAccum = 0;
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.viewmodel.update(dt, this.camera, this.player, this.player.speed01);
    this.weapon?.update(dt);
    this.wheelCooldown = Math.max(0, this.wheelCooldown - dt);
    this.impacts.update(dt);
    this.live.bloom01 = this.weapon?.bloom01 ?? 0;
    this.dust.update(this.reduceMotion ? 0 : t, light);
    this.audio?.setBulbLevel(light);

    this.live.speed01 = this.player.speed01;
    this.live.bulb = light;

    this.post.render(t, dt);

    if (this.pacer.mode === "play" && this.resolution.sample(dt, this.pacer.cap)) this.applyPixelRatio();

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
    let meshes = 0;
    this.level?.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      meshes++;
      const g = mesh.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    const figure = this.level === this.game.room01 ? this.game.room01?.seats[0].character : null;
    this.store.set({
      stats: {
        fps: this.live.fps,
        triangles: Math.round(triangles),
        meshes,
        characterHeight: figure?.height ?? 0,
        scaled: figure?.scaled ?? false,
        renderScale: this.resolution.scale,
      },
    });
  }

  dispose(): void {
    this.disposed = true;
    this.stopLoop();
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("wheel", this.onWheel);
    this.resizeObserver.disconnect();
    this.leaveLevel();
    this.game.dispose();
    this.player.dispose();
    this.audio?.close();
    for (const child of this.debugGroup.children) disposeHelper(child);
    this.dust.dispose();
    this.viewmodel.dispose();
    this.impacts.dispose();
    this.post.dispose();
    this.renderer.dispose();
  }
}

const PERFORMANCE_KEY = "moth.performance";

/** Above 1.75 the post chain costs far more than the sharpness is worth. */
function basePixelRatio(): number {
  return Math.min(devicePixelRatio, 1.75);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function disposeHelper(o: THREE.Object3D): void {
  if (!(o instanceof THREE.Box3Helper)) return;
  o.geometry.dispose();
  for (const material of ([] as THREE.Material[]).concat(o.material)) material.dispose();
}
