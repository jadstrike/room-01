export const HOUSE_ROOMS = ["living-room", "kitchen", "utility-room", "bedroom", "basement", "study"] as const;
export type HouseRoom = typeof HOUSE_ROOMS[number];
export const ROOM_NAMES: Record<HouseRoom, string> = { "living-room": "Living room", kitchen: "Kitchen", "utility-room": "Utility room", bedroom: "Bedroom", basement: "Basement", study: "Study" };
export type Configuration = { id: string; name: string; hint: string; edges: readonly (readonly [HouseRoom, HouseRoom])[] };
/** Replace this provider with Labyrinth later; room geometry and the journal stay independent. */
export const CONFIGURATIONS: readonly Configuration[] = [
  { id: "hearth", name: "01 · Hearth", hint: "The everyday rooms draw close.", edges: [["living-room", "kitchen"], ["kitchen", "utility-room"]] },
  { id: "echo", name: "02 · Echo", hint: "Upstairs and downstairs meet in the dark.", edges: [["living-room", "bedroom"], ["bedroom", "basement"]] },
  { id: "paper", name: "03 · Paper", hint: "Follow the repairs to the records.", edges: [["basement", "study"], ["study", "utility-room"]] },
];
export type Evidence = { id: string; room: HouseRoom; title: string; observation: string; memory: string | null };
export type Inspection = Evidence & { recall: string };
export const KEY_CLUES: Record<HouseRoom, string> = {
  "living-room": "living-room:Mantel_Clock", kitchen: "kitchen:Forgotten_Mug", "utility-room": "utility-room:Cleaning_Cupboard",
  bedroom: "bedroom:Broken_Frame", basement: "basement:Hunting_Rifle", study: "study:Repair_Receipts",
};
const MEMORIES: Partial<Record<HouseRoom, string>> = {
  "living-room": "I remember a clock ticking under the raised voices. This one is silent. I cannot place that sound on a date.",
  kitchen: "Someone once asked me to put the kettle on. I remember the request, but not the face that went with it.",
  "utility-room": "He said the cellar latch needed fixing. At the time it sounded like an excuse. Perhaps it was simply a repair.",
  bedroom: "Raised voices, then something breaking. I never saw whose hand struck the frame. Remembering a sound is not witnessing a killing.",
  basement: "The entity called him dangerous. I remember him carrying a long case, but I do not remember a shot.",
  study: "The marks downstairs looked like blood to me. These receipts offer another explanation. The certainty belonged to the entity, not to the evidence.",
};
export function memoryFor(room: HouseRoom, id: string): string {
  return id === KEY_CLUES[room] ? MEMORIES[room]! : "A feeling of familiarity returns, but no clear event. I should keep what I can see separate from what I think I remember.";
}
export type HouseSave = { version: 1; room: HouseRoom; configuration: number; history: number[]; visited: HouseRoom[]; journal: Evidence[]; device: boolean; restores: number };
export const SAVE_KEY = "moth.house.playthrough.v1";
export function newHouseSave(): HouseSave {
  return { version: 1, room: "living-room", configuration: 0, history: [0], visited: ["living-room"], journal: [], device: false, restores: 0 };
}
export function parseHouseSave(raw: string | null): HouseSave {
  if (!raw) return newHouseSave();
  try {
    const s = JSON.parse(raw) as HouseSave;
    const isRoom = (v: unknown): v is HouseRoom => HOUSE_ROOMS.includes(v as HouseRoom);
    if (s.version !== 1 || !isRoom(s.room) || !Number.isInteger(s.configuration) || !CONFIGURATIONS[s.configuration]
      || !Array.isArray(s.history) || !s.history.length || s.history.length > 3 || s.history.some((n, i) => n !== i) || !s.history.includes(s.configuration)
      || !Array.isArray(s.visited) || !s.visited.every(isRoom) || !s.visited.includes(s.room) || new Set(s.visited).size !== s.visited.length
      || typeof s.device !== "boolean" || !Number.isSafeInteger(s.restores) || s.restores < 0
      || !Array.isArray(s.journal) || s.journal.length > 100 || new Set(s.journal.map(e => e.id)).size !== s.journal.length
      || !s.journal.every(e => isRoom(e.room) && typeof e.id === "string" && e.id.startsWith(`${e.room}:`) && [e.title, e.observation].every(t => typeof t === "string" && t.length < 5000) && (e.memory === null || typeof e.memory === "string"))) return newHouseSave();
    return s;
  } catch { return newHouseSave(); }
}
export class HouseRun {
  constructor(public state: HouseSave = newHouseSave()) {}
  get config(): Configuration { return CONFIGURATIONS[this.state.configuration]; }
  get exits(): HouseRoom[] {
    return this.config.edges.flatMap(([a, b]) => a === this.state.room ? [b] : b === this.state.room ? [a] : []);
  }
  acquireDevice(): void { this.state = { ...this.state, device: true }; }
  shift(): boolean {
    if (!this.state.device || this.state.history.length === CONFIGURATIONS.length) return false;
    const configuration = this.state.history.length;
    this.state = { ...this.state, configuration, history: [...this.state.history, configuration] }; return true;
  }
  restore(configuration: number): boolean {
    if (!this.state.device || configuration === this.state.configuration || !this.state.history.includes(configuration)) return false;
    this.state = { ...this.state, configuration, restores: this.state.restores + 1 }; return true;
  }
  travel(room: HouseRoom): boolean {
    if (!this.exits.includes(room)) return false;
    this.state = { ...this.state, room, visited: [...new Set([...this.state.visited, room])] }; return true;
  }
  collect(inspection: Inspection, recalled: boolean): void {
    const existing = this.state.journal.find(e => e.id === inspection.id);
    const { id, room, title, observation } = inspection;
    const entry: Evidence = { id, room, title, observation, memory: recalled ? inspection.recall : existing?.memory ?? null };
    this.state = { ...this.state, journal: existing ? this.state.journal.map(e => e.id === id ? entry : e) : [...this.state.journal, entry] };
  }
  get clueCount(): number { return Object.values(KEY_CLUES).filter(id => this.state.journal.some(e => e.id === id)).length; }
  get complete(): boolean { return this.state.visited.length === 6 && this.clueCount === 6 && this.state.restores > 0 && this.state.journal.some(e => e.memory) && this.state.room === "living-room"; }
  get objective(): string {
    if (this.complete) return "House investigation complete. The evidence supports questions, not a verdict.";
    if (!this.state.device) return "Find the brass device beside the living-room door. Examine the stopped clock and record it.";
    if (this.state.visited.length < 6) return "Explore the open connections. Shift the device; restore an earlier configuration if a room is cut off.";
    if (this.clueCount < 6) return "Record the clock, cup, cleaning cupboard, broken frame, hunting rifle and repair receipts.";
    if (!this.state.journal.some(e => e.memory)) return "Recall a memory while examining evidence, then record it in the journal.";
    if (!this.state.restores) return "Use the device to restore one of its remembered configurations.";
    return "Restore Hearth and return to the living room with your journal.";
  }
}
