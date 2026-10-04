import { VAGUE_MEMORY, type Configuration, type SiteDef } from "./sites";
import type { Evidence, SiteProgress, StoryState } from "./state";

/** What an Examine produced, before Rowan decides to record it. */
export type Inspection = Omit<Evidence, "memory"> & { recall: string; key: boolean };

export function newSiteProgress(site: SiteDef): SiteProgress {
  return { room: site.start, configuration: 0, history: [0], visited: [site.start], device: false, restores: 0 };
}

/**
 * The rules of one site's investigation, over the story state: which doors
 * are open, what the device can do, and what has been recorded. It mutates
 * the state in place, as the dialogue scripts do; the Game publishes it.
 */
export class Investigation {
  constructor(
    readonly site: SiteDef,
    private story: StoryState,
  ) {
    story.sites[site.id] ??= newSiteProgress(site);
  }

  get progress(): SiteProgress {
    return this.story.sites[this.site.id]!;
  }

  get room(): string {
    return this.progress.room;
  }

  get roomName(): string {
    return this.site.roomNames[this.progress.room] ?? this.progress.room;
  }

  /** The device's arrangements: Moth's measured layouts when there are some, else the authored ones. */
  get configurations(): readonly Configuration[] {
    return this.progress.measured?.configurations ?? this.site.configurations;
  }

  get config(): Configuration {
    return this.configurations[this.progress.configuration];
  }

  /** Rooms the current configuration connects to this one. */
  get exits(): string[] {
    const here = this.progress.room;
    return this.config.edges.flatMap(([a, b]) => (a === here ? [b] : b === here ? [a] : []));
  }

  acquireDevice(): void {
    this.progress.device = true;
  }

  /** Turn the device to a configuration it has not shown yet. */
  shift(): boolean {
    const p = this.progress;
    if (!p.device || p.history.length === this.configurations.length) return false;
    p.configuration = p.history.length;
    p.history.push(p.configuration);
    return true;
  }

  /** Go back to a configuration the device has already shown. */
  restore(index: number): boolean {
    const p = this.progress;
    if (!p.device || index === p.configuration || !p.history.includes(index)) return false;
    p.configuration = index;
    p.restores++;
    return true;
  }

  travel(room: string): boolean {
    if (!this.exits.includes(room)) return false;
    const p = this.progress;
    p.room = room;
    if (!p.visited.includes(room)) p.visited.push(room);
    return true;
  }

  isKeyClue(id: string): boolean {
    return Object.values(this.site.keyClues).includes(id);
  }

  inspection(id: string, title: string, observation: string): Inspection {
    return {
      id,
      place: this.site.id,
      room: this.progress.room,
      title,
      observation,
      recall: this.site.memories[id] ?? VAGUE_MEMORY,
      key: this.isKeyClue(id),
    };
  }

  /** Write an inspection into the journal; recording it again with a memory adds the memory. */
  record(inspection: Inspection, recalled: boolean): void {
    const journal = this.story.journal;
    const existing = journal.find((e) => e.id === inspection.id);
    const { id, place, room, title, observation } = inspection;
    const entry: Evidence = { id, place, room, title, observation, memory: recalled ? inspection.recall : (existing?.memory ?? null) };
    if (existing) journal[journal.indexOf(existing)] = entry;
    else journal.push(entry);
  }

  get clueCount(): number {
    return Object.values(this.site.keyClues).filter((id) => this.story.journal.some((e) => e.id === id)).length;
  }

  get clueTotal(): number {
    return Object.keys(this.site.keyClues).length;
  }

  /** Every key clue is in the journal: any door can take Rowan back. */
  get complete(): boolean {
    return this.clueCount === this.clueTotal;
  }

  get objective(): string {
    if (this.complete) return "You have what you came for. Any door will take you back to Room 01.";
    if (!this.progress.device) return `Take ${this.site.device.name} from beside the door.`;
    const left = this.clueTotal - this.clueCount;
    return `Find the key evidence: ${left} of ${this.clueTotal} left. If a door leads nowhere, turn the device (P).`;
  }
}
