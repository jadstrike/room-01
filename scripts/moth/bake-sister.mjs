/**
 * Bakes the sister's face through Moth's image engines, once, into
 * public/images/sister/, so play never waits on them:
 *
 * - Quantum Blur at three strengths: her face as Rowan's memory has it,
 *   never in focus (the prologue, and each memory he recalls).
 * - Quantum Teleblur, her face into a stranger's, in four steps: the
 *   reveal, when the entity admits it built her out of other people.
 *
 * The sources are painted, not photographed (scripts/moth/portraits.html,
 * painted by paint-portraits.mjs). Every run spends credits, so this is run
 * by hand: `node scripts/moth/bake-sister.mjs`. It writes a provenance file
 * with each job id, which the credits read.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { API, apiKey, run } from "./client.mjs";

const here = (p) => new URL(p, import.meta.url);
const out = new URL("../../public/images/sister/", import.meta.url);

export async function upload(file) {
  const bytes = await readFile(here(`./portraits/${file}`));
  const auth = { Authorization: `Bearer ${apiKey()}` };
  const reg = await fetch(`${API}/assets`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file, content_type: "image/png", size_bytes: bytes.length }),
  }).then((r) => (r.ok ? r.json() : r.text().then((t) => Promise.reject(new Error(`register ${r.status} ${t}`)))));
  const put = await fetch(reg.upload.url, { method: "PUT", headers: reg.upload.headers ?? { "Content-Type": "image/png" }, body: bytes });
  if (!put.ok) throw new Error(`upload ${put.status} ${await put.text()}`);
  const done = await fetch(`${API}/assets/${reg.asset_id}/complete`, { method: "POST", headers: auth });
  if (!done.ok) throw new Error(`complete ${done.status} ${await done.text()}`);
  console.log(`uploaded ${file}: ${reg.asset_id}`);
  return reg.asset_id;
}

/** Save a job's "result" file. Results are files with presigned URLs, in one of a few envelope shapes. */
export async function save(job, name) {
  const r = job.result;
  const files = r.files ?? r.outputs ?? r.result?.files ?? r.result;
  const entry = Array.isArray(files) ? (files.find((f) => (f.slot ?? f.name) === "result") ?? files[0]) : (files?.result ?? files);
  let url = entry?.download_url ?? entry?.url ?? entry?.presigned_url;
  if (!url && entry?.asset_id) {
    const dl = await fetch(`${API}/assets/${entry.asset_id}/download`, { headers: { Authorization: `Bearer ${apiKey()}` } }).then((x) => x.json());
    url = dl.download_url;
  }
  if (!url) throw new Error(`no result file in ${JSON.stringify(r).slice(0, 600)}`);
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(new URL(name, out), bytes);
  console.log(`  saved ${name} (${bytes.length} bytes)`);
}

/**
 * Settings found by calibration: ry or a wide reach pushes the image into
 * darkness, while a narrow rx rotation smears and warps the face without
 * losing it, which is what a memory of a face does.
 */
const BLUR = [0.2, 0.3, 0.4].map((strength) => ({ strength, style: "rx", reach: 0.1, size: 384, downscale: true }));
const MORPH = [0.25, 0.5, 0.75, 1].map((strength) => ({ strength, direction: "full", size: 384, downscale: true }));

// `node bake-sister.mjs` bakes both; `blur` or `morph` bakes one, keeping the other's files and provenance.
if (process.argv[1]?.endsWith("bake-sister.mjs")) {
  const only = process.argv[2];
  await mkdir(out, { recursive: true });
  let provenance = { blur: [], teleblur: [] };
  try {
    provenance = JSON.parse(await readFile(new URL("provenance.json", out), "utf8"));
  } catch {
    // First bake.
  }
  const her = await upload("her.png");
  if (only !== "morph") {
    provenance.blur = [];
    for (const [i, params] of BLUR.entries()) {
      const job = await run("blur-v1", params, { inputFiles: { image: her }, log: console.log });
      await save(job, `blur-${i}.png`);
      provenance.blur.push({ ...params, job: job.id });
    }
  }
  if (only !== "blur") {
    const stranger = await upload("stranger.png");
    provenance.teleblur = [];
    for (const [i, params] of MORPH.entries()) {
      const job = await run("telablur-v1", params, { inputFiles: { image1: her, image2: stranger }, log: console.log });
      await save(job, `morph-${i}.png`);
      provenance.teleblur.push({ ...params, job: job.id });
    }
  }
  await writeFile(new URL("provenance.json", out), JSON.stringify(provenance, null, 2) + "\n");
  console.log("done");
}
