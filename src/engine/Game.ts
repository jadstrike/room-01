import * as THREE from "three";
import type { Card, Engine } from "./Engine";
import type { Interactable } from "./Interact";
import { PROP_INTERACTIONS } from "./Room";
import { Room01Level } from "./levels/Room01Level";
import type { Entity } from "./Entity";
import { SiteLevel } from "./levels/SiteLevel";
import { ROOMS } from "./levels/rooms";
import type { Examinable } from "./house/ProceduralSection";
import { Conversation, type Script } from "../story/dialogue";
import { ACCUSED_SCRIPT, accusedStart } from "../story/accusedScript";
import { ENTITY_SCRIPT, entityStart } from "../story/entityScript";
import { Investigation, type Inspection } from "../story/investigation";
import { SITES, type AccusedId, type Place } from "../story/sites";
import { prepareCoin, prepareSite, siteMeasurement, waitForCoin } from "../story/quantum";
import { layoutsFrom } from "../story/labyrinth";
import { SAVE_KEY, currentPlace, newStoryState, parseSave, type Act, type EndingId, type Request, type StoryState } from "../story/state";
import { ENDING_ORDER, endingFor, type EndingView } from "../story/endings";

export type Panel = "inspection" | "journal" | "device" | "passage";

/** The current site, as the investigation panels show it. */
export type SiteView = {
  name: string;
  roomName: string;
  /** What the exit door looks like from here. */
  door: string;
  config: { name: string; hint: string };
  clues: { found: number; total: number };
  rooms: { id: string; name: string; visited: boolean; open: boolean; here: boolean }[];
  device: { name: string; intro: string; held: boolean };
  configurations: { index: number; name: string; hint: string; links: string[]; active: boolean }[];
  canShift: boolean;
  complete: boolean;
  /** The Moth job whose measurements these arrangements are, if Moth answered. */
  measuredBy: string | null;
};

export type InspectionView = Inspection & {
  /** Already in the journal, and whether with the memory. */
  recorded: boolean;
  remembered: boolean;
};

/** Where the game layer's view of things lives in the Engine's store. */
export type GameState = {
  act: Act;
  /** "Room 01", or "The boyfriend's house · Kitchen". */
  place: string;
  objective: string;
  site: SiteView | null;
  panel: Panel | null;
  inspection: InspectionView | null;
  recalled: boolean;
  journal: StoryState["journal"];
  /** Set when the save could not be read or written. */
  saveWarning: string;
  /** The ending card, once the story is over. */
  ending: EndingView | null;
  /** The main menu over the room, the opening card of a new game, or play. */
  screen: "title" | "prologue" | "game";
  /** A one-time hint about whatever the player has just met, with the keys it needs. */
  tip: Tip | null;
  /** Every ending this player has reached, across runs. */
  endingsFound: EndingId[];
  /** Where Continue would resume, or null with nothing to continue. */
  progress: string | null;
};

export const INITIAL_GAME: GameState = {
  act: "intro",
  place: "Room 01",
  objective: "",
  site: null,
  panel: null,
  inspection: null,
  recalled: false,
  journal: [],
  saveWarning: "",
  tip: null,
  ending: null,
  screen: "title",
  endingsFound: [],
  progress: null,
};

const ENDINGS_KEY = "moth.endings";
/** Where the lent entity waits between appearances: under the floor, still drawn, so still compiled. */
const HIDDEN_Y = -60;
const TIPS_KEY = "moth.tips";

export type Tip = { id: string; title: string; text: string; keys: string[] };

/** Each shown once per player, the first time it matters. */
const TIPS: Readonly<Record<string, Omit<Tip, "id">>> = {
  look: { title: "Moving", text: "Walk with W A S D and look with the mouse. When the mark in the middle turns red, press E.", keys: ["W", "A", "S", "D", "E"] },
  evidence: { title: "Evidence", text: "It is dark here: L for your flashlight. Examine everything with E, and record the key evidence.", keys: ["L", "E"] },
  journal: { title: "Journal", text: "Everything you record goes in the journal. Read it any time.", keys: ["J"] },
  device: { title: "The device", text: "It decides where this place's doors lead. Turn it when a door leads nowhere useful.", keys: ["P"] },
  trial: { title: "The trial", text: "Talk to the accused and put what you found to them. When you are ready, give the entity your answer.", keys: ["E"] },
  gun: { title: "The verdict", text: "Aim at him and click to fire. Or talk to the entity to take it back.", keys: ["Click", "E"] },
};

const ACT_LABELS: Record<Act, string> = {
  intro: "before the coin",
  investigating: "",
  trial: "the trial",
  execution: "the verdict",
  revealed: "after the truth",
  released: "the door is open",
  ended: "",
};

/**
 * The game layer: the story state and its save, which level each part of the
 * story happens in, and what interacting with things means. The Engine
 * provides the world (rendering, the player, the gun, level loading); this
 * decides what happens in it. Story content stays in src/story as data.
 */
export class Game {
  story: StoryState;
  /** Room 01 is loaded once and kept; see Room01Level. */
  room01: Room01Level | null = null;
  private investigation: Investigation | null = null;
  private site: SiteLevel | null = null;
  private conversation: Conversation<StoryState> | null = null;
  private inspection: Inspection | null = null;
  private seatOffs: Array<() => void> = [];
  private deviceOff: (() => void) | null = null;
  private entityOff: (() => void) | null = null;
  private travelling = false;
  /** The entity, lent to the site Rowan is in. */
  private ghost: Entity | null = null;
  private haunted = false;
  private roomTime = 0;
  private ghostUntil = 0;
  private dreadUntil = 0;
  /** Waiting for the coin to land before the toss line. */
  private flipping = false;
  /** The act when the last line was shown, to catch the line that changes it. */
  private shownAct: Act = "intro";
  private wakeTimer: ReturnType<typeof setTimeout> | undefined;
  /** The ending card waiting for its moment to land; cancelled by leaving to the title or starting over. */
  private endingTimer: ReturnType<typeof setTimeout> | undefined;
  /** Room 01's door, whose verb has to follow it when the story opens it. */
  private doorItem: Interactable | null = null;
  private disposed = false;
  private endingsFound: EndingId[] = [];
  private tipsSeen = new Set<string>();

  constructor(private engine: Engine) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      this.engine.store.set({ saveWarning: "Saving is unavailable here. Progress lasts for this visit only." });
    }
    this.story = parseSave(raw);
    // An ending is the end; a reload starts the story again.
    if (this.story.act === "ended") this.story = newStoryState();
    try {
      const found = JSON.parse(localStorage.getItem(ENDINGS_KEY) ?? "[]");
      if (Array.isArray(found)) this.endingsFound = ENDING_ORDER.filter((id) => found.includes(id));
    } catch {
      // Nothing found yet, as far as this browser knows.
    }
    this.engine.store.set({ endingsFound: [...this.endingsFound] });
    try {
      for (const id of JSON.parse(localStorage.getItem(TIPS_KEY) ?? "[]")) this.tipsSeen.add(String(id));
    } catch {
      // Every tip shows again; that is all.
    }
  }

  /** Show tip `id` if this player has not seen it. */
  private tip(id: keyof typeof TIPS): void {
    if (this.tipsSeen.has(id)) return;
    this.tipsSeen.add(id);
    try {
      localStorage.setItem(TIPS_KEY, JSON.stringify([...this.tipsSeen]));
    } catch {
      // It will show again next time.
    }
    this.engine.store.set({ tip: { id, ...TIPS[id] } });
  }

  // --- the front end --------------------------------------------------------------
  private get hasProgress(): boolean {
    return this.story.met || this.story.act !== "intro";
  }

  /** Back into the saved story, from the title. The click is the gesture pointer lock needs. */
  continueGame(): void {
    this.engine.store.set({ screen: "game" });
    this.engine.requestLock();
  }

  /** The prologue card, with a fresh story loading behind it. */
  async beginNewGame(): Promise<void> {
    this.cancelTimers();
    this.engine.store.set({ screen: "prologue", ending: null });
    // A fresh save already sitting in an untouched Room 01 needs no reload.
    if (this.hasProgress || !this.room01 || this.engine.level !== this.room01) await this.newGame();
  }

  /** The end of the prologue: Rowan wakes up, and a moment later the entity speaks. */
  wake(): void {
    this.engine.store.set({ screen: "game" });
    prepareCoin();
    this.tip("look");
    this.engine.requestLock();
    clearTimeout(this.wakeTimer);
    this.wakeTimer = setTimeout(() => {
      const { screen, transition } = this.engine.store.get();
      if (screen === "game" && !transition && !this.story.met && !this.conversation && this.engine.level === this.room01) this.talkToEntity();
    }, 2600);
  }

  /** From the pause menu. Everything is already saved. */
  quitToTitle(): void {
    this.cancelTimers();
    if (this.conversation) this.endDialogue();
    this.closePanel();
    this.engine.player.releaseLock();
    this.engine.store.set({ screen: "title" });
  }

  /** From an ending: a fresh story waits behind the title. */
  async toTitle(): Promise<void> {
    this.cancelTimers();
    this.engine.store.set({ screen: "title", ending: null });
    await this.newGame();
  }

  private cancelTimers(): void {
    clearTimeout(this.wakeTimer);
    clearTimeout(this.endingTimer);
  }

  /** Put the player wherever the saved story says they are. */
  async start(): Promise<void> {
    // Saved between the coin landing and the conversation closing: the coin has spoken, so go.
    if (this.story.act === "intro" && this.story.destination) return this.beginRound(this.story.destination);
    const place = currentPlace(this.story);
    if (place) return this.enterSite(place, false);
    await this.enterRoom01({ title: "Room 01" }, "Click to look around. WASD to move, E to interact.");
    // Pick up mid-act where the save left off.
    if (this.story.act === "execution") this.engine.setHolstered(false);
    if (this.story.act === "released") this.release();
  }

  // --- levels ---------------------------------------------------------------
  private async enterRoom01(card: Card, message: string): Promise<void> {
    this.travelling = true;
    const ok = await this.engine.enter(async (report) => {
      let level = this.room01;
      if (!level) {
        level = await Room01Level.load(report, this.engine.store.get().autoScale);
        // Closed mid-load (StrictMode does this on every dev start): the closed Engine disposes it.
        if (this.disposed) return level;
        this.room01 = level;
      }
      this.site = null;
      this.investigation = null;
      if (this.ghost) {
        level.reclaimEntity();
        this.ghost = null;
      }
      this.wireRoom01(level);
      return level;
    }, card);
    this.travelling = false;
    if (ok && this.room01) {
      this.engine.store.set({ specOk: this.room01.specOk, doorOpen: this.room01.room.doorOpen, message });
      this.publishSeats();
    }
    this.publish();
  }

  private async enterSite(place: Place, arriving: boolean): Promise<void> {
    const site = SITES[place];
    const inv = new Investigation(site, this.story);
    this.investigation = inv;
    this.travelling = true;
    const deviceHere = inv.room === site.start && !inv.progress.device;
    const ok = await this.engine.enter(
      async (report) => {
        // A first arrival waits for Moth to measure this place's doors; a later visit already has them.
        if (arriving && !inv.progress.measured) {
          report(`Moth's Quantum Labyrinth is measuring ${site.id === "house" ? "the house" : "the lab"}`, 0.25);
          const m = await siteMeasurement(place, 14_000);
          const layouts = m && layoutsFrom(site, m.jobId, m.measurements);
          if (layouts) {
            inv.progress.measured = layouts;
            this.save();
          }
          report(layouts ? "Measured" : "The doors stay where they were built", 0.7);
        }
        const level = SiteLevel.create(inv.room, deviceHere ? { label: site.device.name, style: site.device.style } : null);
        this.site = level;
        this.wireSite(level, inv);
        this.lendGhost(level);
        return level;
      },
      arriving ? { title: site.name, line: "The coin decided." } : { title: inv.roomName, line: inv.config.name },
    );
    this.travelling = false;
    if (ok) this.engine.store.set({ message: arriving ? site.arrival : `${inv.roomName}.` });
    if (ok && arriving) {
      this.engine.audio?.sting("arrive");
      this.tip("evidence");
    }
    this.publish();
  }

  /** The coin (or a challenge) sends Rowan to `place` for a round of investigation. */
  private beginRound(place: Place): void {
    this.story.act = "investigating";
    this.story.rounds.push(place);
    this.save();
    void this.enterSite(place, true);
  }

  // --- Room 01 ----------------------------------------------------------------
  private wireRoom01(level: Room01Level): void {
    const room = level.room;
    for (const prop of PROP_INTERACTIONS) {
      const object = room.root.getObjectByName(prop.node);
      if (!object) continue;
      const item: Interactable = {
        id: prop.node,
        object,
        verb: prop.node === "Door" && room.doorOpen ? "Close" : prop.verb,
        label: prop.label,
        range: prop.range,
        onInteract: () => {
          if (prop.node === "Door") {
            const open = room.toggleDoor();
            item.verb = open ? "Close" : "Open";
            this.engine.store.set({
              doorOpen: open,
              focus: { id: item.id, verb: item.verb, label: item.label, distance: 0 },
              message: open ? "The hallway is darker than the room." : "The latch does not sound like it caught.",
            });
            this.engine.audio?.blip(160, 0.2);
            return;
          }
          this.engine.audio?.blip(300, 0.06);
          this.engine.store.set({ message: prop.text });
        },
      };
      if (prop.node === "Door") this.doorItem = item;
      this.engine.register(item);
    }
    this.seatOffs = [];
    this.wireSeats();
    level.onSeatsChanged = () => {
      if (this.engine.level === level) this.wireSeats();
      this.publishSeats();
    };
    level.onSignsChanged = () => this.publishSeats();
    this.entityOff = level.entity
      ? this.engine.register({ id: "entity", object: level.entity.root, verb: "Talk to", label: "The entity", range: 6, onInteract: () => this.talkToEntity() })
      : null;
  }

  private wireSeats(): void {
    const level = this.room01;
    if (!level) return;
    for (const off of this.seatOffs) off();
    this.seatOffs = [];
    // Gagged until the trial; after that, they can be questioned.
    const gagged = this.story.act === "intro" || this.story.act === "investigating";
    for (const seat of level.seats) {
      if (!seat.character) continue;
      const id = seat.def.id as AccusedId;
      this.seatOffs.push(
        this.engine.register({
          id,
          object: seat.character.root,
          verb: gagged ? "Examine" : "Talk to",
          label: seat.def.label,
          // Seated back against the chair, each figure is about 2.6 m from the spawn point.
          range: 2.8,
          onInteract: () => {
            if (!gagged) return this.talkTo(id);
            this.engine.audio?.blip(220, 0.12);
            this.engine.store.set({ message: seat.def.examine });
          },
        }),
      );
    }
  }

  publishSeats(): void {
    const level = this.room01;
    if (!level) return;
    const first = level.seats[0].character;
    this.engine.store.set({
      signs: level.seats.filter((s) => s.sign.available).map((s) => ({ id: s.def.id, label: s.def.label, custom: s.sign.custom })),
      clips: first?.clipNames ?? [],
      clipIndex: first?.defaultClipIndex ?? -1,
    });
  }

  // --- dialogue ---------------------------------------------------------------
  /** Open a conversation with the entity. The pointer is released so choices can be clicked. */
  talkToEntity(): void {
    const entity = this.room01?.entity;
    if (!entity || this.conversation) return;
    if (!this.story.met) this.engine.audio?.sting("wake");
    // Start measuring the coin now, so Moth's answer is in by the time the entity flips it.
    if (this.story.act === "intro" && !this.story.destination) prepareCoin();
    entity.hold(true);
    this.converse(ENTITY_SCRIPT, entityStart(this.story));
  }

  /** Question one of the accused. */
  talkTo(id: AccusedId): void {
    if (this.conversation) return;
    this.converse(ACCUSED_SCRIPT, accusedStart(id, this.story));
  }

  private converse(script: Script<StoryState>, start: string): void {
    this.conversation = new Conversation(script, this.story, start);
    this.engine.player.releaseLock();
    this.showLine();
  }

  chooseDialogue(index: number): void {
    if (this.conversation?.choose(index)) this.showLine();
  }

  /** Continue past a line with no choices; closes the conversation after its last line. */
  advanceDialogue(): void {
    const conversation = this.conversation;
    if (!conversation || this.flipping) return;
    // The coin is in the air: hold on "I'm going to flip a coin" until Moth's measurement lands, a few seconds at most.
    if (conversation.at === "override") {
      this.flipping = true;
      void waitForCoin(6000).then(() => {
        this.flipping = false;
        if (this.conversation === conversation && conversation.at === "override") this.step(conversation);
      });
      return;
    }
    this.step(conversation);
  }

  private step(conversation: Conversation<StoryState>): void {
    if (conversation.advance()) this.showLine();
    else this.endDialogue();
  }

  endDialogue(): void {
    if (!this.conversation) return;
    this.conversation = null;
    this.room01?.entity?.hold(false);
    this.engine.store.set({ dialogue: null });
    const request = this.story.request;
    this.story.request = null;
    this.save();
    if (request) this.carryOut(request);
    this.publish();
  }

  private showLine(): void {
    // The coin (or a challenge) has decided where Rowan goes: start measuring that place now.
    if (this.story.request?.kind === "travel") prepareSite(this.story.request.to);
    const before = this.shownAct;
    this.shownAct = this.story.act;
    if (before === "trial" && this.story.act === "revealed") this.engine.audio?.sting("reveal");
    const view = this.conversation?.view ?? null;
    this.engine.store.set({ dialogue: view });
    if (view) this.engine.audio?.voice(view.text.length);
    this.save();
    this.publish();
  }

  private carryOut(request: Request): void {
    switch (request.kind) {
      case "travel":
        return this.beginRound(request.to);
      case "execute":
        this.tip("gun");
        this.engine.setHolstered(false);
        this.engine.store.set({ message: "One round. The entity is holding him still." });
        return;
      case "stand-down":
        this.engine.setHolstered(true);
        return;
      case "ending":
        return this.finish(request.ending, 600);
      case "release":
        return this.release();
    }
  }

  // --- the entity follows ------------------------------------------------------------
  /**
   * Room 01 is detached while Rowan is in a site, so its entity can be lent
   * to the site. It waits below the floor, where it is drawn (cheaply) and so
   * compiled with the room behind the loading screen; the scare never stalls.
   */
  private lendGhost(level: SiteLevel): void {
    const entity = this.room01?.entity;
    if (!entity) return;
    level.root.add(entity.root);
    entity.hold(true);
    entity.root.position.set(0, HIDDEN_Y, 0);
    this.ghost = entity;
    this.haunted = false;
    this.roomTime = 0;
    this.ghostUntil = 0;
  }

  /**
   * Once per room visit, after Rowan has been there a while, when the lights
   * black out: the entity at the edge of the torch beam, facing him, for a
   * second, then gone.
   */
  private haunt(dt: number): void {
    const ghost = this.ghost;
    const site = this.site;
    if (!ghost || !site || this.engine.level !== site) return;
    const player = this.engine.player.position;
    ghost.update(dt, { player, obstacles: [], area: { xMin: -99, xMax: 99, zMin: -99, zMax: 99 }, light: this.engine.live.bulb });
    this.roomTime += dt;
    // Timed by the clock, not by frames: on a slow machine a second must still be a second.
    if (this.ghostUntil) {
      if (performance.now() >= this.ghostUntil) {
        ghost.root.position.y = HIDDEN_Y;
        this.ghostUntil = 0;
      }
      return;
    }
    const { screen, panel, locked } = { ...this.engine.store.get(), locked: this.engine.player.locked };
    if (this.haunted || this.roomTime < 10 || this.engine.live.bulb > 0.15 || screen !== "game" || panel || this.conversation || !locked) return;
    // Three to four metres down the line Rowan is looking, inside the room.
    const forward = new THREE.Vector3();
    this.engine.camera.getWorldDirection(forward);
    forward.setY(0).normalize();
    const b = site.bounds;
    const at = player.clone().addScaledVector(forward, 3.6);
    at.x = THREE.MathUtils.clamp(at.x, b.min.x + 0.5, b.max.x - 0.5);
    at.z = THREE.MathUtils.clamp(at.z, b.min.z + 0.5, b.max.z - 0.5);
    // Facing a wall, there is no room for it in front of him. Next blackout.
    if (at.distanceTo(player) < 2) return;
    this.haunted = true;
    ghost.place(at, player);
    this.ghostUntil = performance.now() + 1100;
    this.dreadUntil = performance.now() + 4000;
    this.engine.audio?.sting("arrive");
  }

  /** How close the entity is, 0..1, for the heartbeat; an execution keeps it going regardless. */
  private dread(): number {
    if (performance.now() < this.dreadUntil) return 1;
    const entity = this.room01?.entity;
    if (!entity || this.engine.level !== this.room01 || this.engine.store.get().screen !== "game") return 0;
    const near = Math.min(1, Math.max(0, (4 - entity.position.distanceTo(this.engine.player.position)) / 3));
    return this.story.act === "execution" ? Math.max(near, 0.5) : near;
  }

  // --- the end --------------------------------------------------------------------
  /** The entity lets all three of them go: it vanishes, the chairs are empty, the door opens. */
  private release(): void {
    const level = this.room01;
    if (!level) return;
    level.release();
    for (const off of this.seatOffs) off();
    this.seatOffs = [];
    this.entityOff?.();
    this.entityOff = null;
    if (!level.room.doorOpen) level.room.toggleDoor();
    if (this.doorItem) this.doorItem.verb = "Close";
    if (this.engine.level === level) this.engine.refreshLevel();
    this.engine.setHolstered(true);
    this.engine.store.set({ doorOpen: true, message: "The entity is gone. So are the chairs. The door is open." });
    this.publish();
  }

  /** Show ending `id`, after `delay` ms so the moment that caused it can land. */
  private finish(id: EndingId, delay: number): void {
    if (this.story.act === "ended") return;
    this.engine.audio?.sting(id === "walk-away" ? "arrive" : "death");
    this.story.ending = id;
    this.story.act = "ended";
    this.save();
    if (!this.endingsFound.includes(id)) this.endingsFound.push(id);
    try {
      localStorage.setItem(ENDINGS_KEY, JSON.stringify(this.endingsFound));
    } catch {
      // The ending still shows; it just will not be remembered.
    }
    this.engine.store.set({ endingsFound: [...this.endingsFound] });
    clearTimeout(this.endingTimer);
    this.endingTimer = setTimeout(() => {
      this.engine.player.releaseLock();
      this.engine.store.set({ ending: endingFor(id, this.story), dialogue: null, panel: null });
      this.publish();
    }, delay);
  }

  /** Per frame: only the walk out of Room 01 is a place rather than an action. */
  update(dt: number): void {
    this.haunt(dt);
    this.engine.audio?.setDread(this.dread());
    if (this.story.act !== "released" || !this.room01 || this.engine.level !== this.room01) return;
    // The far end of the spec's hallway runs to x = 7.
    if (this.engine.player.position.x > 6.2) this.finish("walk-away", 0);
  }

  get talking(): boolean {
    return this.conversation !== null;
  }

  // --- sites --------------------------------------------------------------------
  private wireSite(level: SiteLevel, inv: Investigation): void {
    for (const item of level.examinables) {
      this.engine.register({ id: item.id, object: item.object, verb: "Examine", label: item.label, range: 2.4, onInteract: () => this.examine(item) });
    }
    const exit = level.exit;
    if (exit) {
      this.engine.register({ id: exit.id, object: exit.object, verb: "Go through", label: exit.label, range: 2.6, onInteract: () => this.useDoor() });
    }
    this.deviceOff = level.device
      ? this.engine.register({ id: "device", object: level.device.object, verb: "Take", label: inv.site.device.name, range: 2.4, onInteract: () => this.takeDevice() })
      : null;
  }

  private examine(item: Examinable): void {
    const inv = this.investigation;
    if (!inv) return;
    // Fridges and cupboards open as Rowan looks in them.
    const swung = this.site?.open(item.id);
    if (swung === "fridge") this.engine.audio?.fridge();
    else if (swung) this.engine.audio?.door();
    const title = item.label.replace(/^the /, "");
    this.inspection = inv.inspection(item.id, title[0].toUpperCase() + title.slice(1), item.text);
    this.engine.audio?.blip(260, 0.08);
    this.engine.store.set({ recalled: false });
    this.openPanel("inspection");
    this.engine.focusOn(item.object);
  }

  /** Let Rowan's memory of what he is looking at come back. */
  recall(): void {
    if (!this.inspection) return;
    this.engine.store.set({ recalled: true });
    this.publish();
  }

  /** Write what is on screen into the journal. */
  record(): void {
    const inv = this.investigation;
    const inspection = this.inspection;
    if (!inv || !inspection) return;
    const wasComplete = inv.complete;
    inv.record(inspection, this.engine.store.get().recalled);
    this.save();
    this.engine.store.set({
      message: !wasComplete && inv.complete ? "That is everything. Any door will take you back to Room 01." : "Recorded in your journal.",
    });
    this.engine.audio?.scribble();
    this.tip("journal");
    this.publish();
  }

  /** The exit door: straight through when there is only one way to go, else a choice. */
  private useDoor(): void {
    const inv = this.investigation;
    if (!inv) return;
    const exits = inv.exits;
    if (!inv.complete && exits.length === 1) {
      void this.travel(exits[0]);
      return;
    }
    if (!inv.complete && !exits.length && !inv.progress.device) {
      this.engine.store.set({ message: "The door opens onto bare wall. Something in this place decides where doors go." });
      return;
    }
    this.openPanel("passage");
  }

  private takeDevice(): void {
    const inv = this.investigation;
    if (!inv || !this.site) return;
    inv.acquireDevice();
    this.deviceOff?.();
    this.deviceOff = null;
    this.site.removeDevice();
    // Site shadows are drawn once on entry; the device's has to go too.
    this.engine.redrawShadows();
    this.save();
    this.openPanel("device");
    this.tip("device");
  }

  async travel(room: string): Promise<void> {
    const inv = this.investigation;
    if (!inv || this.travelling || !inv.travel(room)) return;
    this.closePanel();
    this.save();
    await this.throughTheDoor();
    await this.enterSite(inv.site.id, false);
  }

  /** The exit door swings open on the fold behind it, and only then does the room change. */
  private async throughTheDoor(): Promise<void> {
    const site = this.site;
    if (!site) return;
    this.travelling = true;
    this.engine.player.frozen = true;
    this.engine.audio?.door();
    setTimeout(() => this.engine.audio?.portal(), 250);
    await site.openExit();
  }

  shiftDevice(): void {
    const inv = this.investigation;
    if (!inv?.shift()) return;
    this.save();
    this.engine.audio?.blip(120, 0.35);
    this.engine.store.set({ message: `The place settles into ${inv.config.name}.` });
    this.publish();
  }

  restoreDevice(index: number): void {
    const inv = this.investigation;
    if (!inv?.restore(index)) return;
    this.save();
    this.engine.audio?.blip(140, 0.3);
    this.engine.store.set({ message: `Restored ${inv.config.name}.` });
    this.publish();
  }

  /** With every key clue recorded, any door folds Rowan back to Room 01. */
  async leaveSite(): Promise<void> {
    const inv = this.investigation;
    if (!inv?.complete || this.travelling) return;
    this.closePanel();
    this.story.act = "trial";
    this.save();
    await this.throughTheDoor();
    await this.enterRoom01({ title: "Room 01", line: "The entity folds you back into the room." }, "Back in Room 01. The entity is waiting for an answer.");
    this.tip("trial");
  }

  // --- panels -------------------------------------------------------------------
  openPanel(panel: Panel): void {
    if (panel === "device" && !this.investigation?.progress.device) return;
    if (panel !== "journal" && !this.investigation) return;
    this.engine.store.set({ panel });
    if (panel !== "inspection") this.engine.focusOn(null);
    this.engine.player.releaseLock();
    this.publish();
  }

  closePanel(): void {
    this.engine.store.set({ panel: null });
    this.engine.focusOn(null);
  }

  /** Keys the game owns. Returns true when the key was used. */
  onKey(e: KeyboardEvent): boolean {
    if (e.repeat || this.conversation) return false;
    const { panel } = this.engine.store.get();
    if (e.code === "Escape" && panel) {
      this.closePanel();
      return true;
    }
    if (e.code === "KeyJ" || (e.code === "KeyP" && this.investigation?.progress.device)) {
      const next: Panel = e.code === "KeyJ" ? "journal" : "device";
      if (panel === next) {
        this.closePanel();
        this.engine.requestLock();
      } else this.openPanel(next);
      return true;
    }
    return false;
  }

  // --- the gun ------------------------------------------------------------------
  /** A bullet hit something. Returns true when the hit is handled and should leave no hole. */
  onShot(hit: THREE.Intersection): boolean {
    const level = this.room01;
    if (!level || this.engine.level !== level) return false;
    if (level.isEntity(hit.object) && level.entity && !this.conversation) {
      // A hole in something that moves in four dimensions would not stay put; it just is not there any more.
      level.entity.blink(level.entityContext(this.engine.live.bulb));
      this.engine.store.set({ message: "It is somewhere else now. It did not seem to mind." });
      return true;
    }
    const seat = level.seatOf(hit.object);
    if (!seat) return false;
    const id = seat.def.id as AccusedId;
    if (this.story.act === "execution" && this.story.accused === id) {
      this.finish(id, 1400);
      return false;
    }
    // The gun only works on them once a verdict says it should: the entity is holding the rest of the room still.
    const said: Partial<Record<Act, string>> = {
      intro: "\"Not yet,\" says the entity. \"We haven't had the trial.\"",
      execution: "\"Not that one,\" says the entity.",
      trial: "\"Say which one first,\" says the entity. \"Then shoot.\"",
      revealed: "\"Choose first,\" says the entity. \"I do love a ceremony.\"",
    };
    const line = said[this.story.act];
    if (line) this.engine.store.set({ message: `The round stops an inch short and drops onto the rug. ${line}` });
    return true;
  }

  // --- state ----------------------------------------------------------------------
  private objective(): string {
    const s = this.story;
    switch (s.act) {
      case "intro":
        return s.met ? "Ask the entity how to find out which of them did it." : "Talk to the entity.";
      case "investigating":
        return this.investigation?.objective ?? "";
      case "trial":
        return "Question the accused about what you found, then give the entity your answer.";
      case "execution":
        return `Shoot ${s.accused === "coworker" ? "the coworker" : "the boyfriend"}. Or tell the entity you have changed your mind.`;
      case "revealed":
        return "Nobody did anything, and the entity still wants someone dead. Decide.";
      case "released":
        return "Walk out through the door.";
      default:
        return "";
    }
  }

  private siteView(inv: Investigation): SiteView {
    const { site, progress } = inv;
    const exits = inv.exits;
    return {
      name: site.name,
      roomName: inv.roomName,
      door: this.site?.exit?.text ?? "",
      config: { name: inv.config.name, hint: inv.config.hint },
      clues: { found: inv.clueCount, total: inv.clueTotal },
      rooms: site.rooms.map((id) => ({
        id,
        name: site.roomNames[id] ?? id,
        visited: progress.visited.includes(id),
        open: exits.includes(id),
        here: id === progress.room,
      })),
      device: { name: site.device.name, intro: site.device.intro, held: progress.device },
      configurations: progress.history.map((index) => {
        const c = inv.configurations[index];
        return {
          index,
          name: c.name,
          hint: c.hint,
          links: c.edges.map(([a, b]) => `${site.roomNames[a]} ↔ ${site.roomNames[b]}`),
          active: index === progress.configuration,
        };
      }),
      canShift: progress.device && progress.history.length < inv.configurations.length,
      complete: inv.complete,
      measuredBy: progress.measured?.jobId ?? null,
    };
  }

  private inspectionView(): InspectionView | null {
    const inspection = this.inspection;
    if (!inspection || this.engine.store.get().panel !== "inspection") return null;
    const entry = this.story.journal.find((e) => e.id === inspection.id);
    return { ...inspection, recorded: !!entry, remembered: !!entry?.memory };
  }

  /** Push the story's state to the UI. */
  publish(): void {
    const inv = this.story.act === "investigating" ? this.investigation : null;
    const place = inv ? `${inv.site.name} · ${inv.roomName}` : "Room 01";
    this.engine.store.set({
      act: this.story.act,
      place,
      progress: this.hasProgress && this.story.act !== "ended" ? [place, ACT_LABELS[this.story.act]].filter(Boolean).join(" · ") : null,
      objective: this.objective(),
      site: inv ? this.siteView(inv) : null,
      inspection: this.inspectionView(),
      journal: [...this.story.journal],
    });
  }

  private save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.story));
    } catch {
      this.engine.store.set({ saveWarning: "Could not save progress. Keep this page open to continue." });
    }
  }

  /** Start the story again from the top: a fresh save, and a fresh Room 01. */
  async newGame(): Promise<void> {
    if (this.travelling) return;
    this.cancelTimers();
    this.conversation = null;
    this.inspection = null;
    this.story = newStoryState();
    this.save();
    this.engine.store.set({ dialogue: null, panel: null, recalled: false, ending: null });
    this.engine.setHolstered(false);
    const old = this.room01;
    this.room01 = null;
    await this.enterRoom01({ title: "Room 01", line: "Again." }, "Click to look around. WASD to move, E to interact.");
    if (old && this.engine.level !== old) old.dispose();
    this.engine.resetWeapon();
  }

  /** Development shortcut: drop straight into a site, as if the coin had sent Rowan there. */
  async jumpTo(place: Place): Promise<void> {
    if (this.travelling) return;
    this.story = { ...newStoryState(), met: true, coin: place === "house" ? "heads" : "tails", destination: place, picked: place };
    this.beginRound(place);
  }

  /**
   * Development shortcut: back in Room 01 at the trial, with every key clue
   * from `places` in the journal, as if each had been investigated in turn.
   */
  async jumpToTrial(...places: Place[]): Promise<void> {
    if (this.travelling || !places.length) return;
    const first = places[0];
    this.story = { ...newStoryState(), met: true, coin: first === "house" ? "heads" : "tails", destination: first, picked: first, rounds: [...places] };
    for (const place of places) {
      const site = SITES[place];
      const inv = new Investigation(site, this.story);
      for (const room of site.rooms) {
        const section = ROOMS[room]();
        for (const item of section.examinables) {
          if (!inv.isKeyClue(item.id)) continue;
          const title = item.label.replace(/^the /, "");
          inv.record({ ...inv.inspection(item.id, title[0].toUpperCase() + title.slice(1), item.text), room }, true);
        }
        section.dispose();
      }
    }
    this.story.act = "trial";
    this.save();
    await this.enterRoom01({ title: "Room 01", line: "The entity folds you back into the room." }, "Back in Room 01.");
  }

  /** Room 01 is persistent, so the Engine never disposes it; this does. */
  dispose(): void {
    this.disposed = true;
    this.cancelTimers();
    this.room01?.dispose();
    this.room01 = null;
  }
}
