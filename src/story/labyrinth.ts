import type { Configuration, Place, SiteDef } from "./sites";

/**
 * Turning Moth's Quantum Labyrinth measurements into the device's
 * arrangements. Each room of a site is a qubit on a small lattice; the
 * lattice's edges are the doors that could exist. A measured bitstring opens
 * a door where the two rooms' qubits came out the same, so one shot is one
 * whole layout of the house. (A bitstring and its complement open the same
 * doors, so they are one layout.)
 *
 * The device offers the three most often measured layouts, skipping the two
 * that say nothing (every door open, every door shut). Rowan can only switch
 * between those, so if together they cannot reach every room, the
 * all-doors-open layout, which Moth measures often anyway, takes the last
 * place: no measurement can strand him.
 */

/** Which room each qubit is, and the lattice of possible doors. Shared with the server, which builds the request. */
export const LATTICES: Readonly<Record<Place, { rows: number; cols: number; rooms: readonly string[]; edges: readonly (readonly [number, number])[] }>> = {
  // living, kitchen, utility / bedroom, basement, study
  house: {
    rows: 2,
    cols: 3,
    rooms: ["living-room", "kitchen", "utility-room", "bedroom", "basement", "study"],
    edges: [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [1, 4], [2, 5]],
  },
  // office - reception - Lab 2 - server room - break room
  lab: {
    rows: 1,
    cols: 5,
    rooms: ["office", "reception", "cryostat", "server-room", "break-room"],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
};

export type Measurement = { bitstring: string; probability: number };

/** The device's arrangements, as measured: what Investigation uses instead of the authored ones. */
export type MeasuredLayouts = {
  jobId: string;
  configurations: Configuration[];
  /** Share of all shots each arrangement was measured in, 0..1, by index. */
  shares: number[];
};

const NAMES: Record<Place, string[]> = {
  house: ["Hearth", "Echo", "Paper", "Open house"],
  lab: ["Day shift", "Night shift", "Lockdown", "Open doors"],
};

/** The doors a bitstring opens: lattice edges whose two qubits measured the same. */
export function doorsOf(place: Place, bitstring: string): [string, string][] {
  const lattice = LATTICES[place];
  if (bitstring.length !== lattice.rooms.length || !/^[01]+$/.test(bitstring)) return [];
  return lattice.edges.filter(([a, b]) => bitstring[a] === bitstring[b]).map(([a, b]) => [lattice.rooms[a], lattice.rooms[b]]);
}

/** Rooms reachable from the start using any of these arrangements' doors. */
export function reachable(site: SiteDef, configurations: readonly Configuration[]): Set<string> {
  const seen = new Set([site.start]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of configurations) {
      for (const [a, b] of c.edges) {
        if (seen.has(a) !== seen.has(b)) {
          seen.add(a).add(b);
          grew = true;
        }
      }
    }
  }
  return seen;
}

/** Pick the device's arrangements from a Labyrinth result. Null if the result cannot be used. */
export function layoutsFrom(site: SiteDef, jobId: string, measurements: readonly Measurement[]): MeasuredLayouts | null {
  const lattice = LATTICES[site.id];
  const all = lattice.edges.length;
  // Merge each bitstring with its complement: same doors.
  const layouts = new Map<string, { doors: [string, string][]; share: number }>();
  for (const m of [...measurements].sort((x, y) => y.probability - x.probability)) {
    if (m.bitstring.length !== lattice.rooms.length || !/^[01]+$/.test(m.bitstring)) continue;
    const doors = doorsOf(site.id, m.bitstring);
    const key = doors.map((d) => d.join("|")).join(",");
    const known = layouts.get(key);
    if (known) known.share += m.probability;
    else layouts.set(key, { doors, share: m.probability });
  }
  const ranked = [...layouts.values()].sort((a, b) => b.share - a.share);
  const telling = ranked.filter((l) => l.doors.length > 0 && l.doors.length < all);
  const open = ranked.find((l) => l.doors.length === all);
  if (!telling.length) return null;

  const names = NAMES[site.id];
  const make = (l: { doors: [string, string][]; share: number }, i: number): Configuration => ({
    id: `measured-${i}`,
    name: `0${i + 1} · ${names[i]}`,
    hint: `Measured in ${Math.max(1, Math.round(l.share * 100))}% of the shots.`,
    edges: l.doors,
  });
  let chosen = telling.slice(0, 3);
  let configs = chosen.map(make);
  if (reachable(site, configs).size < site.rooms.length) {
    // The last place goes to every door open: Rowan can always get everywhere from there.
    const fallback = open ?? { doors: lattice.edges.map(([a, b]) => [lattice.rooms[a], lattice.rooms[b]] as [string, string]), share: 0 };
    chosen = [...telling.slice(0, 2), fallback];
    configs = chosen.map((l, i) => (l === fallback ? { ...make(l, i), name: `0${i + 1} · ${names[3]}`, hint: open ? make(l, i).hint : "Every door at once." } : make(l, i)));
  }
  return { jobId, configurations: configs, shares: chosen.map((l) => l.share) };
}
