import type * as THREE from "three";
import type { Card, Engine } from "./Engine";
import type { Interactable } from "./Interact";
import { PROP_INTERACTIONS } from "./Room";
import { Room01Level } from "./levels/Room01Level";
import { SiteLevel } from "./levels/SiteLevel";
import { ROOMS } from "./levels/rooms";
import type { Examinable } from "./house/ProceduralSection";
import { Conversation } from "../story/dialogue";
import { ENTITY_SCRIPT, entityStart } from "../story/entityScript";
import { Investigation, type Inspection } from "../story/investigation";
import { SITES, type Place } from "../story/sites";
import { SAVE_KEY, currentPlace, newStoryState, parseSave, type Act, type Request, type StoryState } from "../story/state";

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
  private travelling = false;

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
  }

  /** Put the player wherever the saved story says they are. */
  async start(): Promise<void> {
    const place = currentPlace(this.story);
    if (place) return this.enterSite(place, false);
    return this.enterRoom01({ title: "Room 01" }, "Click to look around. WASD to move, E to interact.");
  }

  // --- levels ---------------------------------------------------------------
  private async enterRoom01(card: Card, message: string): Promise<void> {
    this.travelling = true;
    const ok = await this.engine.enter(async (report) => {
      const level = this.room01 ?? (this.room01 = await Room01Level.load(report, this.engine.store.get().autoScale));
      this.site = null;
      this.investigation = null;
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
      () => {
        const level = SiteLevel.create(inv.room, deviceHere ? { label: site.device.name, style: site.device.style } : null);
        this.site = level;
        this.wireSite(level, inv);
        return level;
      },
      arriving ? { title: site.name, line: "The coin decided." } : { title: inv.roomName, line: inv.config.name },
    );
    this.travelling = false;
    if (ok) this.engine.store.set({ message: arriving ? site.arrival : `${inv.roomName}.` });
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
          this.engine.store.set({ message: `${prop.verb} ${prop.label} — nothing here yet.` });
        },
      };
      this.engine.register(item);
    }
    this.seatOffs = [];
    this.wireSeats();
    level.onSeatsChanged = () => {
      if (this.engine.level === level) this.wireSeats();
      this.publishSeats();
    };
    level.onSignsChanged = () => this.publishSeats();
    if (level.entity) {
      this.engine.register({ id: "entity", object: level.entity.root, verb: "Talk to", label: "The entity", range: 6, onInteract: () => this.talkToEntity() });
    }
  }

  private wireSeats(): void {
    const level = this.room01;
    if (!level) return;
    for (const off of this.seatOffs) off();
    this.seatOffs = [];
    for (const seat of level.seats) {
      if (!seat.character) continue;
      this.seatOffs.push(
        this.engine.register({
          id: seat.def.id,
          object: seat.character.root,
          verb: "Examine",
          label: seat.def.label,
          // Seated back against the chair, each figure is about 2.6 m from the spawn point.
          range: 2.8,
          onInteract: () => {
            this.engine.audio?.blip(220, 0.12);
            this.engine.store.set({ message: seat.def.examine });
          },
        }),
      );
    }
  }

  private publishSeats(): void {
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
    this.conversation = new Conversation(ENTITY_SCRIPT, this.story, entityStart(this.story));
    entity.hold(true);
    this.engine.player.releaseLock();
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
    this.room01?.entity?.hold(false);
    this.engine.store.set({ dialogue: null });
    const request = this.story.request;
    this.story.request = null;
    this.save();
    if (request) this.carryOut(request);
    this.publish();
  }

  private showLine(): void {
    const view = this.conversation?.view ?? null;
    this.engine.store.set({ dialogue: view });
    if (view) this.engine.audio?.voice(view.text.length);
    this.save();
    this.publish();
  }

  private carryOut(request: Request): void {
    if (request.kind === "travel") this.beginRound(request.to);
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
    const title = item.label.replace(/^the /, "");
    this.inspection = inv.inspection(item.id, title[0].toUpperCase() + title.slice(1), item.text);
    this.engine.audio?.blip(260, 0.08);
    this.engine.store.set({ recalled: false });
    this.openPanel("inspection");
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
    this.save();
    this.openPanel("device");
  }

  async travel(room: string): Promise<void> {
    const inv = this.investigation;
    if (!inv || this.travelling || !inv.travel(room)) return;
    this.closePanel();
    this.save();
    await this.enterSite(inv.site.id, false);
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
    await this.enterRoom01({ title: "Room 01", line: "The entity folds you back into the room." }, "Back in Room 01. The entity is waiting for an answer.");
  }

  // --- panels -------------------------------------------------------------------
  openPanel(panel: Panel): void {
    if (panel === "device" && !this.investigation?.progress.device) return;
    if (panel !== "journal" && !this.investigation) return;
    this.engine.store.set({ panel });
    this.engine.player.releaseLock();
    this.publish();
  }

  closePanel(): void {
    this.engine.store.set({ panel: null });
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
    if (level.seatOf(hit.object)) this.engine.store.set({ message: "The round goes in. It does not react." });
    return false;
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
        return "Tell the entity what you found.";
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
        const c = site.configurations[index];
        return {
          index,
          name: c.name,
          hint: c.hint,
          links: c.edges.map(([a, b]) => `${site.roomNames[a]} ↔ ${site.roomNames[b]}`),
          active: index === progress.configuration,
        };
      }),
      canShift: progress.device && progress.history.length < site.configurations.length,
      complete: inv.complete,
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
    this.engine.store.set({
      act: this.story.act,
      place: inv ? `${inv.site.name} · ${inv.roomName}` : "Room 01",
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
    this.conversation = null;
    this.inspection = null;
    this.story = newStoryState();
    this.save();
    this.engine.store.set({ dialogue: null, panel: null, recalled: false });
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

  /** Development shortcut: back in Room 01 with everything from `place` in the journal. */
  async jumpToTrial(place: Place): Promise<void> {
    const site = SITES[place];
    if (this.travelling) return;
    this.story = { ...newStoryState(), met: true, coin: place === "house" ? "heads" : "tails", destination: place, picked: place, rounds: [place] };
    const inv = new Investigation(site, this.story);
    for (const room of site.rooms) {
      const section = ROOMS[room]();
      for (const item of section.examinables) {
        if (inv.isKeyClue(item.id)) {
          const title = item.label.replace(/^the /, "");
          inv.record({ ...inv.inspection(item.id, title, item.text), room }, true);
        }
      }
      section.dispose();
    }
    this.story.act = "trial";
    this.save();
    await this.enterRoom01({ title: "Room 01", line: "The entity folds you back into the room." }, "Back in Room 01.");
  }

  /** Room 01 is persistent, so the Engine never disposes it; this does. */
  dispose(): void {
    this.room01?.dispose();
    this.room01 = null;
  }
}
