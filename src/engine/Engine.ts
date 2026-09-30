import * as THREE from "three";
import { Store } from "./store";
import { Room, PROP_INTERACTIONS } from "./Room";
import { dressChair } from "./ChairDressing";
import { Character } from "./Character";
import { Viewmodel, VIEWMODEL_LAYER } from "./Viewmodel";
import { WeaponModel } from "./WeaponModel";
import { Weapon, type WeaponState } from "./Weapon";
import { Impacts } from "./Impacts";
import { PISTOL } from "./weapons";
import { SignPicture } from "./Sign";
import { Entity, type EntityContext } from "./Entity";
import { SEATS, type SeatDef } from "./cast";
import { Conversation, type DialogueView } from "../story/dialogue";
import { ENTITY_SCRIPT, entityStart, newStoryState, type Place, type StoryState } from "../story/entityScript";
import { Player } from "./Player";
import { Interact, type FocusInfo, type Interactable } from "./Interact";
import { Post } from "./Post";
import { Flicker } from "./Flicker";
import { Dust } from "./Dust";
import { Audio } from "./Audio";
import { ROOM01 } from "./room01";
import { Kitchen } from "./house/Kitchen";
import { LivingRoom } from "./house/LivingRoom";
import type { HouseSection } from "./house/HouseSection";
import { locationFromSearch, locationLabel, type LocationId } from "./house/locations";

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
  location: LocationId;
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
  weapon: WeaponState | null;
  /** Each accused's sign, and whether it shows the player's picture. */
  signs: { id: string; label: string; custom: boolean }[];
  /** The conversation on screen, if any. */
  dialogue: DialogueView | null;
  /** Where the coin sent Rowan, once it has been tossed. */
  destination: Place | null;
  stats: { fps: number; triangles: number; roomMeshes: number; characterHeight: number; scaled: boolean };
};

export const INITIAL_STATE: EngineState = {
  phase: "loading",
  location: "room01",
  error: null,
  locked: false,
  focus: null,
  clips: [],
  clipIndex: -1,
  flicker: true,
  // On, but the AudioContext only starts with the click that begins play.
  sound: true,
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
  weapon: null,
  signs: [],
  dialogue: null,
  destination: null,
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
  readonly live = { speed01: 0, bulb: 1, fps: 0, bloom01: 0 };

  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly player: Player;
  readonly interact = new Interact();

  readonly location = locationFromSearch(window.location.search);
  houseSection: HouseSection | null = null;
  room: Room | null = null;
  /** The two accused, each tied to a chair, in the order of `SEATS`. */
  readonly seats: Seat[] = SEATS.map((def) => ({
    def,
    holder: new THREE.Group(),
    character: null,
    sign: new SignPicture(`room01.sign.${def.id}`),
    off: null,
  }));
  entity: Entity | null = null;
  private story: StoryState = newStoryState();
  private conversation: Conversation<StoryState> | null = null;
  weapon: Weapon | null = null;

  private renderer: THREE.WebGLRenderer;
  private post: Post;
  private flicker = new Flicker(true);
  private dust = new Dust();
  private viewmodel = new Viewmodel();
  private impacts = new Impacts();
  /** Room colliders plus the chairs: what the entity steers around. */
  private obstacles: THREE.Box3[] = [];
  private audio: Audio | null = null;
  private timer = new THREE.Timer();
  private debugGroup = new THREE.Group();
  private unregister: Array<() => void> = [];
  private resizeObserver: ResizeObserver;
  private frames = 0;
  private fpsAccum = 0;
  private statAccum = 0;
  private interactAccum = 0;
  private wheelCooldown = 0;
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
    this.store.set({ location: this.location, flicker: this.flicker.enabled });

    this.interact.onFocusChange = (focus) => {
      this.store.set({ focus });
      if (focus) this.audio?.blip(360, 0.05);
    };

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    window.addEventListener("keydown", this.onKeyDown);
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("wheel", this.onWheel, { passive: true });
    this.resize();
  }

  async init(): Promise<void> {
    if (this.location !== "room01") {
      try {
        const publish = (message: string) => this.store.set({ message });
        const section = this.location === "kitchen" ? new Kitchen(publish) : new LivingRoom(publish);
        this.houseSection = section;
        this.scene.add(section.root);
        section.root.traverse(o => { if (o instanceof THREE.Light) o.layers.enable(VIEWMODEL_LAYER); });
        this.player.setBounds(section.bounds);
        this.player.setColliders(section.colliders);
        this.setConfineToRoom(true);
        this.player.spawnAt(section.spawn, section.lookAt);
        this.interact.setRoots([section.root]);
        for (const item of section.interactions) this.register(item);
        this.dust.setBulbPosition(section.dustOrigin);
        this.buildDebug();
        const model = PISTOL.viewmodel ? await WeaponModel.load(PISTOL.viewmodel).catch(() => null) : null;
        if (this.disposed) { model?.dispose(); return; }
        if (model) this.viewmodel.useModel(model);
        this.equip();
        this.store.set({ location: this.location, phase: "ready", message: `${locationLabel(this.location)}. WASD to explore, E to examine. Esc returns to the menu.` });
        this.renderer.setAnimationLoop(this.frame);
      } catch (error) {
        this.store.set({ phase: "error", error: error instanceof Error ? error.message : String(error) });
      }
      return;
    }
    // The game carries on without it if it fails to load.
    const entityModel = Entity.load().catch((error) => {
      console.warn("[entity] could not load the entity", error);
      return null;
    });
    // Loads alongside the room; if it fails, the procedural pistol stands in.
    const gunModel = PISTOL.viewmodel
      ? WeaponModel.load(PISTOL.viewmodel).catch((error) => {
          console.warn("[weapon] could not load the pistol model, using the built-in one", error);
          return null;
        })
      : Promise.resolve(null);
    try {
      const room = await Room.load(ASSETS.room);
      if (this.disposed) return room.dispose();
      this.room = room;
      this.scene.add(room.root);
      // Lights only reach cameras that share a layer with them.
      room.root.traverse((o) => {
        if ((o as THREE.Light).isLight) o.layers.enable(VIEWMODEL_LAYER);
      });
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

      await this.setCharacters(() => Character.fromURL(ASSETS.character));
      if (this.disposed) return;

      const entity = await entityModel;
      if (this.disposed) return entity?.dispose();
      if (entity) this.addEntity(entity);

      const model = await gunModel;
      if (this.disposed) return model?.dispose();
      if (model) this.viewmodel.useModel(model);
      this.equip();
      this.store.set({ phase: "ready", message: "Click to look around. WASD to move, click to fire, R to reload, F to inspect, E to interact." });
      this.renderer.setAnimationLoop(this.frame);
    } catch (error) {
      console.error(error);
      this.store.set({ phase: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }

  // --- the accused ----------------------------------------------------------
  /** Seat a fresh figure in every chair, from whatever `make` loads. */
  async setCharacters(make: () => Promise<Character>): Promise<void> {
    const loaded = await Promise.all(this.seats.map(() => make()));
    const room = this.room;
    if (!room || this.disposed) {
      for (const c of loaded) c.dispose();
      return;
    }
    this.seats.forEach((seat, i) => this.seatCharacter(seat, loaded[i], room));
    this.refreshColliders();
    this.interact.setRoots(this.interactRoots());
    const first = loaded[0];
    this.store.set({
      clips: first.clipNames,
      clipIndex: first.defaultClipIndex,
      message: `Loaded character · ${first.clips.length} clip(s) · ${first.authoredHeight.toFixed(2)} m as authored`,
    });
    this.publishSigns();
  }

  private seatCharacter(seat: Seat, next: Character, room: Room): void {
    seat.off?.();
    seat.character?.dispose();
    seat.character = next;
    if (!seat.holder.parent) {
      // The holder places the chair; the room's CharacterSpawn places the holder.
      seat.holder.position.set(seat.def.x, 0, seat.def.z);
      seat.holder.rotation.y = seat.def.yaw;
      room.spawn.add(seat.holder);
    }
    // fit() measures in world space, so the holder's placement has to be in the matrices first.
    seat.holder.updateWorldMatrix(true, false);
    dressChair(next.root, room.root);
    seat.holder.add(next.root);
    next.fit(this.store.get().autoScale);
    const clipIndex = next.defaultClipIndex;
    if (clipIndex >= 0) next.playClip(clipIndex);
    this.attachSign(seat);
    seat.off = this.register({
      id: seat.def.id,
      object: next.root,
      verb: "Examine",
      label: seat.def.label,
      // Seated back against the chair, each figure is about 2.6 m from the spawn point.
      range: 2.8,
      onInteract: () => {
        this.audio?.blip(220, 0.12);
        this.store.set({ message: seat.def.examine });
      },
    });
  }

  private attachSign(seat: Seat): void {
    if (!seat.character || !seat.sign.attach(seat.character.root)) return;
    const saved = seat.sign.saved();
    if (!saved) return;
    seat.sign
      .set(saved, false)
      .then(() => this.publishSigns())
      .catch(() => seat.sign.reset());
  }

  private publishSigns(): void {
    this.store.set({
      signs: this.seats
        .filter((seat) => seat.sign.available)
        .map((seat) => ({ id: seat.def.id, label: seat.def.label, custom: seat.sign.custom })),
    });
  }

  /** Put the player's picture on one accused's sign. */
  async setSignPicture(id: string, file: Blob): Promise<void> {
    const seat = this.seats.find((s) => s.def.id === id);
    if (!seat?.sign.available) {
      this.store.set({ message: "That figure has no sign to put a picture on." });
      return;
    }
    try {
      if (await seat.sign.set(file)) {
        this.publishSigns();
        this.store.set({ message: `Your picture is on the sign of ${seat.def.label.toLowerCase()} now.` });
      }
    } catch {
      this.store.set({ message: "Could not read that picture. Try a .jpg, .png or .webp." });
    }
  }

  resetSignPicture(id: string): void {
    this.seats.find((s) => s.def.id === id)?.sign.reset();
    this.publishSigns();
  }

  /** Where a dropped picture goes: the accused under the crosshair, else the first still showing the old face. */
  signDropTarget(): string | null {
    const { signs, focus } = this.store.get();
    return (signs.find((s) => s.id === focus?.id) ?? signs.find((s) => !s.custom) ?? signs[0])?.id ?? null;
  }

  /** Load a character the user picked or dropped, into every chair. */
  async loadCharacterFiles(files: FileList | File[]): Promise<void> {
    const list = [...files];
    try {
      await this.setCharacters(() => Character.fromFiles(list));
    } catch (error) {
      this.store.set({ message: `Could not load that file: ${error instanceof Error ? error.message : error}` });
    }
  }

  setAutoScale(on: boolean): void {
    this.store.set({ autoScale: on });
    for (const seat of this.seats) seat.character?.fit(on);
    this.refreshColliders();
  }

  selectClip(index: number): void {
    for (const seat of this.seats) seat.character?.playClip(index);
    this.store.set({ clipIndex: index });
  }

  private refreshColliders(): void {
    if (!this.room) return;
    this.obstacles = [...this.room.colliders];
    for (const seat of this.seats) {
      if (!seat.character) continue;
      seat.character.refreshCollider();
      this.obstacles.push(seat.character.collider);
    }
    // The entity's box is moved in place every frame, so the player always collides with where it is now.
    this.player.setColliders(this.entity ? [...this.obstacles, this.entity.collider] : this.obstacles);
    this.buildDebug();
  }

  // --- the entity -------------------------------------------------------------
  private addEntity(entity: Entity): void {
    this.entity = entity;
    this.scene.add(entity.root);
    // It starts behind the accused, facing the player, where the bulb barely reaches.
    entity.place(new THREE.Vector3(-0.9, 0, -2.05), ROOM01.markers.cameraStart);
    this.refreshColliders();
    this.interact.setRoots(this.interactRoots());
    this.register({
      id: "entity",
      object: entity.root,
      verb: "Talk to",
      label: "The entity",
      range: 6,
      onInteract: () => this.talkToEntity(),
    });
  }

  // --- dialogue ------------------------------------------------------------------
  /** Open a conversation with the entity. The pointer is released so choices can be clicked. */
  talkToEntity(): void {
    if (!this.entity || this.conversation) return;
    this.conversation = new Conversation(ENTITY_SCRIPT, this.story, entityStart(this.story));
    this.entity.hold(true);
    this.player.releaseLock();
    this.showLine();
  }

  chooseDialogue(index: number): void {
    if (this.conversation?.choose(index)) this.showLine();
  }

  /** Continue past a line with no choices; closes the conversation after its last line. */
  advanceDialogue(): void {
    const conversation = this.conversation;
    if (!conversation) return;
    if (conversation.advance()) this.showLine();
    else this.endDialogue();
  }

  endDialogue(): void {
    if (!this.conversation) return;
    this.conversation = null;
    this.entity?.hold(false);
    const destination = this.story.destination;
    this.store.set({
      dialogue: null,
      destination,
      message: destination
        ? `The coin said ${destination === "house" ? "the boyfriend's house" : "the lab"}. That place is not built yet.`
        : "",
    });
  }

  private showLine(): void {
    const view = this.conversation?.view ?? null;
    this.store.set({ dialogue: view });
    if (view) this.audio?.voice(view.text.length);
  }

  private entityContext(light: number): EntityContext {
    return { player: this.player.position, obstacles: this.obstacles, area: ROOM01.walkable.room, light };
  }

  private interactRoots(): THREE.Object3D[] {
    const roots: THREE.Object3D[] = [];
    if (this.room) roots.push(this.room.root);
    if (this.houseSection) roots.push(this.houseSection.root);
    if (this.entity) roots.push(this.entity.root);
    return roots;
  }

  // --- weapon ----------------------------------------------------------------
  private equip(): void {
    const weapon = new Weapon(PISTOL, this.viewmodel, (pitch, yaw) => this.player.punch(pitch, yaw));
    weapon.onChange = (state) => this.store.set({ weapon: state });
    weapon.onShot = (hit) => {
      this.audio?.gunshot();
      if (!hit) return;
      const entity = this.entity;
      if (entity && isDescendant(hit.object, entity.root) && !this.conversation) {
        // A hole in something that moves in four dimensions would not stay put; it just is not there any more.
        entity.blink(this.entityContext(this.live.bulb));
        this.store.set({ message: "It is somewhere else now. It did not seem to mind." });
        return;
      }
      this.impacts.add(hit);
      const seat = this.seats.find((s) => s.character && isDescendant(hit.object, s.character.root));
      if (seat) this.store.set({ message: "The round goes in. It does not react." });
    };
    weapon.onDryFire = () => this.audio?.dryFire();
    weapon.onReload = (empty) => this.audio?.reload(empty, empty ? PISTOL.reloadEmptyTime : PISTOL.reloadTime);
    this.weapon = weapon;
    this.store.set({ weapon: weapon.state });
  }

  fire(): void {
    if (!this.player.locked || !this.weapon || (!this.room && !this.houseSection)) return;
    this.weapon.trigger({
      camera: this.camera,
      speed01: this.player.speed01,
      onGround: this.player.onGround,
      roots: this.interactRoots(),
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

  // --- interaction -------------------------------------------------------
  /** The game layer can register its own targets on top of these. */
  register(item: Interactable): () => void {
    const off = this.interact.register(item);
    this.unregister.push(off);
    return off;
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

  /** Off lets the player walk through the doorway into the hallway. */
  setConfineToRoom(on: boolean): void {
    const b = this.houseSection?.bounds;
    this.player.setConfinement(on ? (b ? { xMin: b.min.x, xMax: b.max.x, zMin: b.min.z, zMax: b.max.z } : ROOM01.walkable.room) : null);
    this.store.set({ confineToRoom: on });
  }

  requestLock(): void {
    this.startAudio();
    this.player.requestLock();
  }

  // --- internals ---------------------------------------------------------
  private buildDebug(): void {
    for (const child of [...this.debugGroup.children]) {
      if (child instanceof THREE.Box3Helper) { child.geometry.dispose(); for (const material of ([] as THREE.Material[]).concat(child.material)) material.dispose(); }
    }
    this.debugGroup.clear();
    if (this.houseSection) {
      this.debugGroup.add(new THREE.Box3Helper(this.houseSection.bounds, new THREE.Color(0x4ad3a1)));
      for (const box of this.houseSection.colliders) this.debugGroup.add(new THREE.Box3Helper(box, new THREE.Color(0x8e1b17)));
    }
    if (!this.room) return;
    const bounds = new THREE.Box3().copy(this.room.bounds);
    this.debugGroup.add(new THREE.Box3Helper(bounds, new THREE.Color(0x4ad3a1)));
    for (const box of this.room.colliders) {
      this.debugGroup.add(new THREE.Box3Helper(box, new THREE.Color(0x8e1b17)));
    }
    for (const seat of this.seats) {
      if (seat.character) this.debugGroup.add(new THREE.Box3Helper(seat.character.collider, new THREE.Color(0xd8d2c4)));
    }
    if (this.entity) this.debugGroup.add(new THREE.Box3Helper(this.entity.collider, new THREE.Color(0x9fb4d8)));
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
    for (const seat of this.seats) seat.character?.update(dt);
    this.entity?.update(dt, this.entityContext(level));
    this.viewmodel.update(dt, this.camera, this.player, this.player.speed01);
    this.weapon?.update(dt);
    this.wheelCooldown = Math.max(0, this.wheelCooldown - dt);
    this.impacts.update(dt);
    this.live.bloom01 = this.weapon?.bloom01 ?? 0;
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
    (this.houseSection?.root ?? this.room?.root)?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) roomMeshes++;
    });
    this.store.set({
      stats: {
        fps: this.live.fps,
        triangles: Math.round(triangles),
        roomMeshes,
        characterHeight: this.seats[0].character?.height ?? 0,
        scaled: this.seats[0].character?.scaled ?? false,
      },
    });
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("wheel", this.onWheel);
    this.resizeObserver.disconnect();
    for (const off of this.unregister) off();
    this.unregister = [];
    this.interact.clear();
    this.player.dispose();
    this.audio?.close();
    for (const seat of this.seats) {
      seat.character?.dispose();
      seat.sign.dispose();
    }
    this.entity?.dispose();
    this.room?.dispose();
    this.houseSection?.dispose();
    for (const child of this.debugGroup.children) {
      if (child instanceof THREE.Box3Helper) { child.geometry.dispose(); for (const material of ([] as THREE.Material[]).concat(child.material)) material.dispose(); }
    }
    this.dust.dispose();
    this.viewmodel.dispose();
    this.impacts.dispose();
    this.post.dispose();
    this.renderer.dispose();
  }
}

type Seat = {
  def: SeatDef;
  /** Places the chair around CharacterSpawn. */
  holder: THREE.Group;
  character: Character | null;
  sign: SignPicture;
  /** Unregisters this seat's interaction. */
  off: (() => void) | null;
};

function isDescendant(o: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (n === ancestor) return true;
  return false;
}
