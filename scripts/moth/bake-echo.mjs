/**
 * Bakes the entity's voice reverb with Moth's Retrocausal Echo engine, once,
 * into public/audio/entity-echo.wav: a multi-tap echo measured on a qubit
 * chain, where negative returns play reversed, so the voice answers itself
 * out of order. Audio.ts uses it as the convolution reverb on the entity's
 * voice. Spends credits: run by hand, `node scripts/moth/bake-echo.mjs`.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { run } from "./client.mjs";
import { save } from "./bake-sister.mjs";

const out = new URL("../../public/audio/", import.meta.url);
await mkdir(out, { recursive: true });

const params = { depth: 12, master_ms: 2200, theta_x: 1.1, negative_mode: "reverse", decay: 0.25, mix: 1, lattice: "chain", via: "direct" };
const job = await run("retrocausal-echo-v1", params, { log: console.log, timeoutMs: 600_000 });
console.log("result envelope:", JSON.stringify(job.result).slice(0, 500));
await save(job, "../../audio/entity-echo.wav");
await writeFile(new URL("entity-echo.json", out), JSON.stringify({ engine: "retrocausal-echo-v1", ...params, job: job.id }, null, 2) + "\n");
console.log("done");
