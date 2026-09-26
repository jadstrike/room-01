/**
 * Offline check that the shipped room GLB still matches docs/ROOM01_SPEC.md and
 * the names src/engine/Room.ts looks up. Reads the glTF JSON chunk only - no
 * decoding, no three.js, no browser.
 *
 *   node scripts/verify-room.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED = {
  meshes: 60,
  triangles: 15488,
  nodes: [
    "Floor", "Ceiling", "Wall_Back", "Wall_Front", "Wall_Left", "Wall_Right",
    "CharacterSpawn", "CameraStart", "CameraTarget",
    "Door_Hinge", "Door", "Door_Frame",
    "Light_Bulb", "Light_Moon", "Light_Hall",
    "Bed", "Wardrobe", "Desk", "Desk_Items", "Chair", "Radiator", "Debris",
    "Mirror", "Frame_Portrait", "Frame_Fallen", "Window_Boards", "Rug", "Hanging_Bulb",
  ],
  materials: ["M_WindowGlass", "M_NightSky", "M_Void", "M_BulbGlass"],
  clip: "Door_Creak",
};

function readGltfJson(path) {
  const buf = readFileSync(path);
  const jsonLength = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));
}

function check(file) {
  const gltf = readGltfJson(join(root, "public/models", file));
  const problems = [];

  const nodeNames = new Set((gltf.nodes ?? []).map((n) => n.name));
  for (const name of EXPECTED.nodes) {
    if (!nodeNames.has(name)) problems.push(`missing node ${name}`);
  }

  const materialNames = new Set((gltf.materials ?? []).map((m) => m.name));
  for (const name of EXPECTED.materials) {
    if (!materialNames.has(name)) problems.push(`missing material ${name}`);
  }

  const clips = (gltf.animations ?? []).map((a) => a.name);
  if (!clips.includes(EXPECTED.clip)) problems.push(`missing clip ${EXPECTED.clip}, has [${clips}]`);

  // three.js creates one Mesh per glTF primitive, per node that references it.
  let meshes = 0;
  let triangles = 0;
  for (const node of gltf.nodes ?? []) {
    if (node.mesh === undefined) continue;
    for (const prim of gltf.meshes[node.mesh].primitives) {
      meshes++;
      const accessor = gltf.accessors[prim.indices ?? prim.attributes.POSITION];
      triangles += accessor.count / 3;
    }
  }
  triangles = Math.round(triangles);
  if (meshes !== EXPECTED.meshes) problems.push(`${meshes} meshes, spec says ${EXPECTED.meshes}`);
  if (triangles !== EXPECTED.triangles) problems.push(`${triangles} triangles, spec says ${EXPECTED.triangles}`);

  const label = problems.length ? "FAIL" : "ok";
  console.log(`${label}  ${file}  ${meshes} meshes, ${triangles.toLocaleString()} tris, ext [${gltf.extensionsUsed ?? []}]`);
  for (const p of problems) console.log(`      - ${p}`);
  return problems.length === 0;
}

const files = ["horror_room.web.glb", "horror_room.glb"];
const allOk = files.map(check).every(Boolean);
process.exit(allOk ? 0 : 1);
