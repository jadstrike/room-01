export type Coin = "heads" | "tails";

/** A toss and where it came from: Moth's Coin Toss engine, or the local stand-in. */
export type CoinMeasurement = {
  coin: Coin;
  source: "moth" | "local";
  heads: number;
  tails: number;
  shots: number;
  /** Moth's job id, as proof the measurement happened. */
  jobId?: string;
  backend?: string;
};

const ENDPOINT = "/api/coin";
const POLL_MS = 1200;
const GIVE_UP_MS = 25_000;

let measured: CoinMeasurement | null = null;
let inFlight = false;

/**
 * Start measuring the entity's coin on Moth's Coin Toss engine: one qubit in
 * superposition, measured eleven times on the server (api/coin.js), which holds
 * the API key. Called when the entity starts talking, so the result has
 * usually arrived by the time it flips. Safe to call more than once.
 */
export function prepareCoin(): void {
  if (measured || inFlight || typeof window === "undefined") return;
  inFlight = true;
  void measure()
    .then((m) => {
      if (m) measured = m;
    })
    .catch((error) => console.warn("[quantum] Moth coin toss unavailable, the local coin will be used", error))
    .finally(() => {
      inFlight = false;
    });
}

async function measure(): Promise<CoinMeasurement | null> {
  const start = await fetch(ENDPOINT, { method: "POST" });
  if (!start.ok) throw new Error(`start ${start.status}`);
  const { jobId } = (await start.json()) as { jobId?: string };
  if (!jobId) return null;
  const deadline = Date.now() + GIVE_UP_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const res = await fetch(`${ENDPOINT}?job=${encodeURIComponent(jobId)}`);
    if (!res.ok) throw new Error(`poll ${res.status}`);
    const r = (await res.json()) as { status: string; coin?: Coin; heads?: number; tails?: number; shots?: number; backend?: string };
    if (r.status === "failed" || r.status === "cancelled") return null;
    if (r.status === "completed" && (r.coin === "heads" || r.coin === "tails")) {
      return { coin: r.coin, source: "moth", heads: r.heads ?? 0, tails: r.tails ?? 0, shots: r.shots ?? 0, jobId, backend: r.backend };
    }
  }
  return null;
}

/** Wait, up to `ms`, for a measurement already on its way. */
export async function waitForCoin(ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (inFlight && Date.now() < until) await new Promise((r) => setTimeout(r, 150));
}

/**
 * The entity's coin. Moth's measurement if it has arrived, used once;
 * otherwise a local coin from the browser's secure random source, which the
 * story says plainly. The story never waits on the network.
 */
export function tossCoin(): CoinMeasurement {
  const m = measured;
  if (m) {
    measured = null;
    return m;
  }
  // Eleven shots, like Moth's: an odd count cannot tie.
  const bits = new Uint8Array(11);
  crypto.getRandomValues(bits);
  const heads = bits.filter((b) => b & 1).length;
  return { coin: heads > 5 ? "heads" : "tails", source: "local", heads, tails: 11 - heads, shots: 11 };
}

/** Moth's Quantum Labyrinth measurements of one site, as the server returns them. */
export type SiteMeasurement = { jobId: string; measurements: { bitstring: string; probability: number }[] };

const sites = new Map<string, Promise<SiteMeasurement | null>>();

/**
 * Start measuring a site's door layouts on Moth's Quantum Labyrinth engine
 * (api/labyrinth.js). Called the moment the coin decides where Rowan goes,
 * so the eight-second job runs while the entity is still talking.
 */
export function prepareSite(place: string): void {
  if (sites.has(place) || typeof window === "undefined") return;
  const job = measureSite(place).catch((error) => {
    console.warn("[quantum] Moth Labyrinth unavailable, the authored layouts will be used", error);
    return null;
  });
  sites.set(place, job);
}

/** The site's measurement, waiting at most `ms` for it; null if Moth did not answer in time. */
export async function siteMeasurement(place: string, ms: number): Promise<SiteMeasurement | null> {
  prepareSite(place);
  const job = sites.get(place);
  if (!job) return null;
  const result = await Promise.race([job, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
  // Used once: a later round at the same site measures afresh.
  if (result) sites.delete(place);
  return result;
}

async function measureSite(place: string): Promise<SiteMeasurement | null> {
  const start = await fetch("/api/labyrinth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site: place }) });
  if (!start.ok) throw new Error(`start ${start.status}`);
  const { jobId } = (await start.json()) as { jobId?: string };
  if (!jobId) return null;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(`/api/labyrinth?job=${encodeURIComponent(jobId)}`);
    if (!res.ok) throw new Error(`poll ${res.status}`);
    const r = (await res.json()) as { status: string; measurements?: SiteMeasurement["measurements"] };
    if (r.status === "failed" || r.status === "cancelled") return null;
    if (r.status === "completed" && r.measurements?.length) return { jobId, measurements: r.measurements };
  }
  return null;
}
