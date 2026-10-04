/**
 * The game's side of the Moth Quantum API, shared by the Vercel function
 * (api/coin.js) and the Vite dev server (vite.config.ts), so the key stays on
 * the server in both. Moth sends no CORS headers, so the browser could not
 * call it directly anyway.
 *
 * Only what the game needs is exposed, with fixed parameters: an
 * eleven-shot coin toss, a Labyrinth run over one of the two sites' fixed
 * lattices, and reading back a job. Nothing else, so the endpoints cannot be
 * used to spend credits on arbitrary work.
 *
 * Plain Node request/response, no framework helpers, so it runs unchanged
 * under both.
 */
const API = "https://api.mothquantum.com/api/v1";
const JOB_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Each site's rooms as qubits on a lattice whose edges are the doors that
 * could exist. Must match LATTICES in src/story/labyrinth.ts, which decodes
 * the result (verify-story checks they agree). The start room radiates.
 */
export const LABYRINTHS = {
  house: { rows: 2, cols: 3, edges: [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [1, 4], [2, 5]], start: 0 },
  lab: { rows: 1, cols: 5, edges: [[0, 1], [1, 2], [2, 3], [3, 4]], start: 1 },
};

function labyrinthParams(site) {
  const l = LABYRINTHS[site];
  const n = l.rows * l.cols;
  const initial_states = Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), { radiating: i === l.start }]));
  return {
    shots: 1024, k: 3, top_n: 16, mode: "emu", fraction: 1 / 3, steps: 3,
    level_data: { name: `Room 01 ${site}`, grid_size: { rows: l.rows, cols: l.cols }, num_qubits: n, coupling_map: l.edges, initial_states },
  };
}

/** Eleven shots: an odd number cannot tie, enough to show a real split, quick on the simulator. */
export const COIN = { engine: "coin-toss-v1", params: { mode: "emu", shots: 11 } };

async function moth(path, init = {}) {
  const key = process.env.MOTH_API_KEY;
  if (!key) throw Object.assign(new Error("MOTH_API_KEY is not set on the server"), { status: 503 });
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(`Moth ${res.status}`), { status: 502 });
  return body;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/**
 * Requests from the game's own pages only. Every current browser sends
 * Sec-Fetch-Site on fetch(), so a request without it is a script, not the
 * game. Headers can be forged, so this deters rather than secures; the fixed
 * parameters are what bound the cost.
 */
function sameSite(req) {
  if (req.headers["sec-fetch-site"] !== "same-origin") return false;
  const origin = req.headers.origin;
  return !origin || new URL(origin).host === req.headers.host;
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1000) break;
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

/**
 * POST /api/labyrinth { site }  -> { jobId }    measure a site's door layouts
 * GET  /api/labyrinth?job=<id>  -> { status, measurements? }
 */
export async function labyrinth(req, res) {
  try {
    if (!sameSite(req)) return send(res, 403, { error: "forbidden" });
    if (req.method === "POST") {
      const { site } = await readJson(req);
      if (!Object.hasOwn(LABYRINTHS, site)) return send(res, 400, { error: "unknown site" });
      const job = await moth("/engines/labyrinth-v1/process", { method: "POST", body: JSON.stringify({ params: labyrinthParams(site) }) });
      return send(res, 202, { jobId: job.job_id });
    }
    if (req.method === "GET") {
      const id = new URL(req.url, "http://local").searchParams.get("job") ?? "";
      if (!JOB_ID.test(id)) return send(res, 400, { error: "bad job id" });
      const status = await moth(`/jobs/${id}/status`);
      if (status.status !== "completed") return send(res, 200, { status: status.status });
      const out = (await moth(`/jobs/${id}/result`)).result?.output ?? {};
      const measurements = (out.results?.measurements ?? []).map(({ bitstring, probability }) => ({ bitstring, probability }));
      return send(res, 200, { status: "completed", jobId: id, measurements });
    }
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "method not allowed" });
  } catch (error) {
    return send(res, error.status ?? 500, { error: error.message });
  }
}

/**
 * POST /api/coin           -> { jobId }                  start a toss
 * GET  /api/coin?job=<id>  -> { status, coin?, heads?, tails?, shots?, backend? }
 */
export async function coin(req, res) {
  try {
    if (!sameSite(req)) return send(res, 403, { error: "forbidden" });
    if (req.method === "POST") {
      const job = await moth(`/engines/${COIN.engine}/process`, { method: "POST", body: JSON.stringify({ params: COIN.params }) });
      return send(res, 202, { jobId: job.job_id });
    }
    if (req.method === "GET") {
      const id = new URL(req.url, "http://local").searchParams.get("job") ?? "";
      if (!JOB_ID.test(id)) return send(res, 400, { error: "bad job id" });
      const status = await moth(`/jobs/${id}/status`);
      if (status.status !== "completed") return send(res, 200, { status: status.status });
      const out = (await moth(`/jobs/${id}/result`)).result ?? {};
      return send(res, 200, { status: "completed", coin: out.output, heads: out.heads, tails: out.tails, shots: out.shots, backend: out.backend, jobId: id });
    }
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "method not allowed" });
  } catch (error) {
    return send(res, error.status ?? 500, { error: error.message });
  }
}
