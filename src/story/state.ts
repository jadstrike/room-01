import type { Coin, CoinMeasurement } from "./quantum";
import type { AccusedId, Place } from "./sites";

/**
 * Everything the story remembers, in one plain object: it is what the
 * dialogue scripts read and write, what the Game acts on, and, serialised,
 * the save. Where the player is follows from it - investigating means the
 * current site's current room, anything else means Room 01 - so a reload
 * puts Rowan back exactly where the story is.
 */

export type Act =
  /** Room 01, before the coin has sent Rowan anywhere. */
  | "intro"
  /** In a site, gathering evidence. */
  | "investigating"
  /** Back in Room 01 with evidence: question the accused, then answer the entity. */
  | "trial"
  /** A verdict was given; the gun will now fire on the one named. */
  | "execution"
  /** The entity has admitted tampering; nothing is certain any more. */
  | "revealed"
  /** Rowan refused; the entity let them all go. */
  | "released"
  | "ended";

export type EndingId = "boyfriend" | "coworker" | "rowan" | "walk-away";

export type Evidence = {
  /** The interaction id, e.g. "basement:Hunting_Rifle". */
  id: string;
  place: Place;
  room: string;
  title: string;
  observation: string;
  memory: string | null;
};

export type SiteProgress = {
  room: string;
  /** The device's active configuration, and every one it has shown so far, in order. */
  configuration: number;
  history: number[];
  visited: string[];
  device: boolean;
  restores: number;
};

/** Set by a script line; the Game carries it out when the conversation closes. */
export type Request =
  | { kind: "travel"; to: Place }
  | { kind: "execute" }
  /** The verdict was taken back: put the gun away. */
  | { kind: "stand-down" }
  | { kind: "ending"; ending: EndingId }
  | { kind: "release" };

export type StoryState = {
  version: 1;
  met: boolean;
  asked: { who: boolean; where: boolean; boyfriend: boolean; coworker: boolean; sister: boolean; research: boolean };
  /** Where Rowan wanted to go, and what the coin said. */
  picked: Place | null;
  coin: Coin | null;
  /** How the coin was measured: Moth's counts and job id, or the local stand-in. */
  coinProof: Omit<CoinMeasurement, "coin"> | null;
  destination: Place | null;
  act: Act;
  /** Sites investigated, in order; a second entry is the round a challenge bought. */
  rounds: Place[];
  sites: Partial<Record<Place, SiteProgress>>;
  journal: Evidence[];
  /** Evidence ids shown to each accused. */
  shown: Record<AccusedId, string[]>;
  /** Who Rowan named. */
  accused: AccusedId | null;
  /** Where a reconsidered verdict goes back to. */
  verdictFrom: "trial" | "revealed" | null;
  ending: EndingId | null;
  request: Request | null;
};

export function newStoryState(): StoryState {
  return {
    version: 1,
    met: false,
    asked: { who: false, where: false, boyfriend: false, coworker: false, sister: false, research: false },
    picked: null,
    coin: null,
    coinProof: null,
    destination: null,
    act: "intro",
    rounds: [],
    sites: {},
    journal: [],
    shown: { boyfriend: [], coworker: [] },
    accused: null,
    verdictFrom: null,
    ending: null,
    request: null,
  };
}

/** The site Rowan is in, while investigating. */
export function currentPlace(s: StoryState): Place | null {
  return s.act === "investigating" ? (s.rounds[s.rounds.length - 1] ?? null) : null;
}

export function hasEvidence(s: StoryState, id: string): boolean {
  return s.journal.some((e) => e.id === id);
}

export const SAVE_KEY = "moth.story.v1";

const ACTS: readonly Act[] = ["intro", "investigating", "trial", "execution", "revealed", "released", "ended"];
const PLACES: readonly Place[] = ["house", "lab"];
const isPlace = (v: unknown): v is Place => PLACES.includes(v as Place);
const isAccused = (v: unknown): v is AccusedId => v === "boyfriend" || v === "coworker";

/**
 * A save from localStorage, or a new game if it is missing, from another
 * version, or does not hang together. Saves are only ever written by this
 * game, so this guards against corruption and old builds, not tampering.
 */
export function parseSave(raw: string | null): StoryState {
  if (!raw) return newStoryState();
  try {
    const s = JSON.parse(raw) as StoryState;
    const fresh = newStoryState();
    if (s.version !== 1 || !ACTS.includes(s.act) || !Array.isArray(s.rounds) || !s.rounds.every(isPlace)) return fresh;
    if (!Array.isArray(s.journal) || !s.journal.every((e) => typeof e?.id === "string" && isPlace(e.place) && typeof e.observation === "string")) {
      return fresh;
    }
    if (s.act === "investigating" && !s.sites?.[s.rounds[s.rounds.length - 1]]) return fresh;
    for (const progress of Object.values(s.sites ?? {})) {
      if (!progress || typeof progress.room !== "string" || !Array.isArray(progress.history) || !progress.history.includes(progress.configuration)) {
        return fresh;
      }
    }
    if (s.accused !== null && !isAccused(s.accused)) return fresh;
    return {
      ...fresh,
      ...s,
      asked: { ...fresh.asked, ...s.asked },
      shown: { boyfriend: s.shown?.boyfriend ?? [], coworker: s.shown?.coworker ?? [] },
      // A request belongs to the conversation that made it.
      request: null,
    };
  } catch {
    return newStoryState();
  }
}
