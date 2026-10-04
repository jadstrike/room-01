/**
 * The places the coin can send Rowan, as data: which rooms they have, how the
 * device can connect them, and which piece of evidence in each room the case
 * turns on. Geometry lives in src/engine; this file never imports three.js.
 *
 * Connections are not floor plans. The device "folds" the place, so each
 * configuration is a small graph of which doors lead where, and a room can
 * be cut off until the device is turned again. Configurations are authored
 * for now; the saved Moth Labyrinth run in docs/quantum-house/ is the
 * intended source once its doors can be guaranteed to stay reachable.
 */

export type Place = "house" | "lab";
export type AccusedId = "boyfriend" | "coworker";

export type Configuration = {
  id: string;
  name: string;
  hint: string;
  edges: readonly (readonly [string, string])[];
};

export type SiteDef = {
  id: Place;
  /** "The boyfriend's house": loading screens and the status panel. */
  name: string;
  /** Whose place this is. */
  owner: AccusedId;
  rooms: readonly string[];
  roomNames: Readonly<Record<string, string>>;
  /** Where Rowan arrives, and where the device waits. */
  start: string;
  configurations: readonly Configuration[];
  /** The one piece of evidence in each room the case turns on, by interaction id. */
  keyClues: Readonly<Record<string, string>>;
  /** What Rowan remembers when he recalls a key clue, by interaction id. */
  memories: Readonly<Record<string, string>>;
  device: { name: string; intro: string; style: "brass" | "tablet" };
  /** Shown when the entity drops Rowan here. */
  arrival: string;
};

/** Said when Rowan recalls something that is not a key clue. */
export const VAGUE_MEMORY =
  "A feeling of familiarity returns, but no clear event. I should keep what I can see separate from what I think I remember.";

export const HOUSE: SiteDef = {
  id: "house",
  name: "The boyfriend's house",
  owner: "boyfriend",
  rooms: ["living-room", "kitchen", "utility-room", "bedroom", "basement", "study"],
  roomNames: {
    "living-room": "Living room",
    kitchen: "Kitchen",
    "utility-room": "Utility room",
    bedroom: "Bedroom",
    basement: "Basement",
    study: "Study",
  },
  start: "living-room",
  configurations: [
    { id: "hearth", name: "01 · Hearth", hint: "The everyday rooms draw close.", edges: [["living-room", "kitchen"], ["kitchen", "utility-room"]] },
    { id: "echo", name: "02 · Echo", hint: "Upstairs and downstairs meet in the dark.", edges: [["living-room", "bedroom"], ["bedroom", "basement"]] },
    { id: "paper", name: "03 · Paper", hint: "Follow the repairs to the records.", edges: [["basement", "study"], ["study", "utility-room"]] },
  ],
  keyClues: {
    "living-room": "living-room:Mantel_Clock",
    kitchen: "kitchen:Forgotten_Mug",
    "utility-room": "utility-room:Cleaning_Cupboard",
    bedroom: "bedroom:Broken_Frame",
    basement: "basement:Hunting_Rifle",
    study: "study:Repair_Receipts",
  },
  memories: {
    "living-room:Mantel_Clock": "I remember a clock ticking under raised voices, the night of the fourteenth, and then not ticking. I don't remember being in this room to hear it.",
    "kitchen:Forgotten_Mug": "Someone once asked me to put the kettle on. I remember the request, but not the face that went with it.",
    "utility-room:Cleaning_Cupboard": "He said the cellar latch needed fixing. At the time it sounded like an excuse. Perhaps it was simply a repair.",
    "bedroom:Broken_Frame": "Raised voices, then something breaking. I never saw whose hand struck the frame. Remembering a sound is not witnessing a killing.",
    "basement:Hunting_Rifle": "The entity called him dangerous. I remember him carrying a long case, but I do not remember a shot.",
    "study:Repair_Receipts": "The marks downstairs looked like blood to me. These receipts offer another explanation. The certainty belonged to the entity, not to the evidence.",
  },
  device: {
    name: "the brass device",
    style: "brass",
    intro: "Turning the dial folds the house into a new arrangement. You keep your journal. Each arrangement is remembered; restore one whenever a door leads nowhere.",
  },
  arrival: "The boyfriend's house. A brass device hums beside the door you came in by.",
};

/** The lab is not built yet. */
export const SITES: Readonly<Partial<Record<Place, SiteDef>>> = { house: HOUSE };
