/**
 * The game's side of the Moth Quantum API, shared by the Vercel function
 * (api/coin.js) and the Vite dev server (vite.config.ts), so the key stays on
 * the server in both. Moth sends no CORS headers, so the browser could not
 * call it directly anyway.
 *
 * Only what the game needs is exposed, with fixed parameters: a caller can
 * start an eleven-shot coin toss and read back a job, nothing else, so the
 * endpoint cannot be used to spend credits on arbitrary work.
 *
 * Plain Node request/response, no framework helpers, so it runs unchanged
 * under both.
 */
const API = "https://api.mothquantum.com/api/v1";
const JOB_ID = /^[A-Za-z0-9-]{8,64}$/;

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
