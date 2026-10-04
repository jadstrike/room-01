/**
 * Minimal Moth Quantum API client for Node: submit a job, poll it, fetch the
 * result. The key comes from MOTH_API_KEY in the environment or from the
 * project's git-ignored .env, and is never logged.
 */
import { readFileSync } from "node:fs";

export const API = "https://api.mothquantum.com/api/v1";

export function apiKey() {
  if (process.env.MOTH_API_KEY) return process.env.MOTH_API_KEY.trim();
  for (const file of [".env", ".env.moth.local"]) {
    try {
      const line = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8")
        .split(/\r?\n/)
        .find((l) => l.startsWith("MOTH_API_KEY="));
      if (line) return line.slice("MOTH_API_KEY=".length).trim();
    } catch {
      // Not there; try the next.
    }
  }
  throw new Error("Set MOTH_API_KEY, or put it in .env");
}

async function call(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", ...init.headers },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
  return body;
}

/** Submit once. Never retried: a lost response may still have spent credits. */
export function submit(engine, params, inputFiles) {
  return call(`/engines/${engine}/process`, { method: "POST", body: JSON.stringify({ params, ...(inputFiles ? { input_files: inputFiles } : {}) }) });
}

export const status = (id) => call(`/jobs/${id}/status`);
export const result = (id) => call(`/jobs/${id}/result`);

/** Poll until a terminal state, then fetch the result. */
export async function run(engine, params, { inputFiles, timeoutMs = 330_000, every = 2500, log = () => {} } = {}) {
  const job = await submit(engine, params, inputFiles);
  const id = job.job_id ?? job.id;
  log(`submitted ${engine}: ${id}`);
  const deadline = Date.now() + timeoutMs;
  let last = "";
  for (;;) {
    const s = await status(id);
    if (s.status !== last) log(`  ${s.status}`);
    last = s.status;
    if (s.status === "completed") return { id, job, status: s, result: await result(id) };
    if (s.status === "failed" || s.status === "cancelled") throw new Error(`${engine} job ${id} ${s.status}: ${JSON.stringify(s).slice(0, 400)}`);
    if (Date.now() > deadline) throw new Error(`${engine} job ${id} timed out as ${s.status}`);
    await new Promise((r) => setTimeout(r, every));
  }
}
