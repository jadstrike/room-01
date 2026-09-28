/**
 * Builds public/models/chair_character.glb: a human-proportioned figure tied to
 * the chair in prison issue - an untucked orange V-neck top and trousers,
 * stencilled INMATE - to sit in Room 01's realistic style rather than the
 * original pack's toy-like one. The chair, neck stick and sign are carried over
 * unchanged from chair_source.glb (the pack's export); the body and the ropes
 * are rebuilt here from lofted cross-sections.
 *
 *   node scripts/chair-character/build.mjs
 *
 * Geometry only: surfaces come from src/engine/ChairDressing.ts, keyed on the
 * material names below, so renaming one changes how it looks in game.
 * Metres, +Y up, the figure faces +Z; its left hand is on the +X side.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "chair_source.glb");
const OUT = join(here, "../../public/models/chair_character.glb");

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

const M = {
  orange: "Prison | orange cotton",
  trim: "Prison | rib trim",
  stencil: "Prison | stencil",
  skin: "Skin | pallid",
  nails: "Skin | nails",
  sole: "Boots | charcoal rubber",
  boot: "Boots | oiled leather",
  rope: "Bindings | golden hemp",
};
const NEW_MATERIALS = {
  [M.orange]: [196, 92, 34, 0.9],
  [M.trim]: [150, 64, 26, 0.9],
  [M.stencil]: [20, 20, 20, 0.9],
  [M.skin]: [184, 156, 138, 0.55],
  [M.nails]: [196, 172, 156, 0.4],
  [M.sole]: [30, 30, 28, 0.85],
  [M.boot]: [58, 44, 34, 0.65],
  [M.rope]: [168, 142, 98, 0.95],
};
const KEEP = ["Chair", "NeckStick", "SignFrame", "SignImage"];
/** The sign and its stick rise from the collar, which sits back against the chair. */
const SIGN_SHIFT_Z = -0.178;

// --- noise ---------------------------------------------------------------------

function hash3(x, y, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const s = (t) => t * t * (3 - 2 * t);
  const fx = s(x - xi), fy = s(y - yi), fz = s(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k, seed);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
    l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy),
    fz,
  );
}

const n3 = (p, f, seed) => noise3(p.x * f, p.y * f, p.z * f, seed);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Smooth 1D interpolation through evenly spaced keys. */
function keyed(keys, t) {
  const x = Math.min(1, Math.max(0, t)) * (keys.length - 1);
  const i = Math.min(keys.length - 2, Math.floor(x));
  const f = x - i;
  const k = (j) => keys[Math.max(0, Math.min(keys.length - 1, j))];
  const p0 = k(i - 1), p1 = k(i), p2 = k(i + 1), p3 = k(i + 2);
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
}

// --- geometry ----------------------------------------------------------------

const groups = new Map();
function add(node, mat, geo) {
  if (!groups.has(node)) groups.set(node, new Map());
  const byMat = groups.get(node);
  if (!byMat.has(mat)) byMat.set(mat, []);
  byMat.get(mat).push(geo);
}

/**
 * Skins a series of cross-sections. Each row is a superellipse around `c` in
 * the plane of `x` and `y`, with separate half-heights on the +y and -y sides.
 * `disp` pushes each vertex along its radial direction, for folds and lumps.
 */
function sweep(rows, segs, { startPole, endPole, closed = false, disp } = {}) {
  const pos = [];
  const rings = [];
  rows.forEach((r, i) => {
    const ring = [];
    const e = r.e ?? 2;
    for (let j = 0; j < segs; j++) {
      const th = (j / segs) * TAU;
      const cs = Math.cos(th), sn = Math.sin(th);
      const C = Math.sign(cs) * Math.abs(cs) ** (2 / e);
      const S = Math.sign(sn) * Math.abs(sn) ** (2 / e);
      const local = r.x.clone().multiplyScalar(r.rx * C).addScaledVector(r.y, (sn >= 0 ? r.ryP : r.ryN) * S);
      const p = r.c.clone().add(local);
      if (disp && local.lengthSq() > 1e-12) {
        const d = disp(p, r, th, i) * (r.fade ?? 1);
        if (d) p.addScaledVector(local.normalize(), d);
      }
      ring.push(p);
      pos.push(p.x, p.y, p.z);
    }
    rings.push(ring);
  });

  const idx = [];
  const R = rows.length;
  const last = closed ? R : R - 1;
  for (let i = 0; i < last; i++) {
    const i2 = (i + 1) % R;
    for (let j = 0; j < segs; j++) {
      const a = i * segs + j, b = i * segs + ((j + 1) % segs);
      const c = i2 * segs + j, d = i2 * segs + ((j + 1) % segs);
      idx.push(a, c, b, b, c, d);
    }
  }
  // Wind outwards whichever way the frames turned out.
  const P = (k) => V(pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]);
  let score = 0;
  for (let t = 0; t < idx.length; t += 6) {
    const pa = P(idx[t]);
    const n = P(idx[t + 1]).sub(pa).cross(P(idx[t + 2]).sub(pa));
    score += n.dot(pa.clone().sub(rows[Math.floor(idx[t] / segs)].c));
  }
  if (startPole) {
    const k = pos.length / 3;
    pos.push(startPole.x, startPole.y, startPole.z);
    for (let j = 0; j < segs; j++) idx.push(k, j, (j + 1) % segs);
  }
  if (endPole) {
    const k = pos.length / 3;
    const base = (R - 1) * segs;
    pos.push(endPole.x, endPole.y, endPole.z);
    for (let j = 0; j < segs; j++) idx.push(k, base + ((j + 1) % segs), base + j);
  }
  if (score < 0) for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, rings };
}

/**
 * A tapered, rounded tube along a Catmull-Rom spine: limbs, fingers, boots.
 * `sec(t)` may override the cross-section; `cap` scales each rounded end.
 */
function limb({ pts, radii, up = V(0, 1, 0), flat = 1, e = 2, segs = 16, rows = 24, cap = [1, 1], sec, disp }) {
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const len = curve.getLength();
  const frame = (t) => {
    const T = curve.getTangentAt(t);
    const y = up.clone().addScaledVector(T, -up.dot(T)).normalize();
    const x = new THREE.Vector3().crossVectors(y, T).normalize();
    return { T, x, y };
  };
  const section = (t) => {
    if (sec) return sec(t);
    const r = keyed(radii, t);
    const f = Array.isArray(flat) ? keyed(flat, t) : flat;
    return { rx: r, ryP: r * f, ryN: r * f };
  };
  const row = (c, f, s, k, t, fade) => ({ c, x: f.x, y: f.y, rx: s.rx * k, ryP: s.ryP * k, ryN: s.ryN * k, e, s: t * len, fade });

  const out = [];
  const K = 4;
  const f0 = frame(0), c0 = curve.getPointAt(0), s0 = section(0);
  const f1 = frame(1), c1 = curve.getPointAt(1), s1 = section(1);
  const reach0 = Math.max(s0.rx, s0.ryP) * cap[0];
  const reach1 = Math.max(s1.rx, s1.ryP) * cap[1];
  for (let k = K; k >= 1; k--) {
    const phi = (k / (K + 1)) * (Math.PI / 2);
    out.push(row(c0.clone().addScaledVector(f0.T, -reach0 * Math.sin(phi)), f0, s0, Math.cos(phi), 0, Math.cos(phi)));
  }
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    out.push(row(curve.getPointAt(t), frame(t), section(t), 1, t, 1));
  }
  for (let k = 1; k <= K; k++) {
    const phi = (k / (K + 1)) * (Math.PI / 2);
    out.push(row(c1.clone().addScaledVector(f1.T, reach1 * Math.sin(phi)), f1, s1, Math.cos(phi), 1, Math.cos(phi)));
  }
  const res = sweep(out, segs, {
    startPole: c0.clone().addScaledVector(f0.T, -reach0),
    endPole: c1.clone().addScaledVector(f1.T, reach1),
    disp: disp ? (p, r, th) => disp(p, r.s, len, th) : undefined,
  });
  return { ...res, bodyRings: res.rings.slice(K, K + rows + 1), curve, len };
}

function ellipsoid(center, scale, { dir = V(0, 0, 1), up = V(0, 1, 0), w = 10, h = 6 } = {}) {
  const geo = new THREE.SphereGeometry(1, w, h);
  geo.deleteAttribute("uv");
  geo.scale(scale.x, scale.y, scale.z);
  const z = dir.clone().normalize();
  const x = new THREE.Vector3().crossVectors(up, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  geo.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).setPosition(center));
  return geo;
}

/** Loose cloth: slack lumps everywhere, and compression folds near bent joints. */
function clothDisp({ folds = [], seed = 1, amp = 0.006, lambda = 0.032 }) {
  return (p, s, len, th) => {
    let d = (n3(p, 22, seed) - 0.5) * 0.004 + (n3(p, 8, seed + 3) - 0.5) * 0.007;
    for (const f of folds) {
      const dist = f.at === "start" ? s : len - s;
      const w = 1 - smoothstep(0, f.span, dist);
      if (w <= 0) continue;
      const wave = Math.sin((s / lambda) * TAU + n3(p, 12, seed + 7) * 5 + Math.cos(th) * 1.4);
      d += (wave > 0 ? wave : wave * 0.35) * amp * w * (f.k ?? 1);
    }
    return d;
  };
}

// --- rope ------------------------------------------------------------------------

/** 2D convex hull (monotone chain) of [a, b] points. */
function hull(points) {
  const p = points.slice().sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

const ellipsePts = (cx, cy, rx, ry, n = 24) =>
  Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * TAU) * rx, cy + Math.sin((i / n) * TAU) * ry]);
const rectPts = (cx, cy, hx, hy, r) =>
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([sx, sy]) => ellipsePts(cx + sx * hx, cy + sy * hy, r, r, 8));

/** A closed rope path hugging everything in `shapes` (2D), resampled evenly. */
function wrapPath(shapes2d, toWorld, spacing, seed) {
  const h = hull(shapes2d.flat());
  const curve = new THREE.CatmullRomCurve3(h.map(([a, b]) => V(a, b, 0)), true, "centripetal");
  const n = Math.max(24, Math.round(curve.getLength() / spacing));
  return curve.getSpacedPoints(n).slice(0, -1).map((p, i) => {
    const wob = (noise3(i * 0.08, seed, 0, 5) - 0.5) * 0.006;
    return toWorld(p.x, p.y, wob);
  });
}

/** Three-strand laid rope: a tube whose radius dips between strands that twist along it. */
function rope(path, { r = 0.0075, closed = true, ref = V(0, 1, 0), segs = 9, pitch = 0.036, taper = false }) {
  const n = path.length;
  let s = 0;
  const rows = path.map((c, i) => {
    const prev = path[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = path[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const T = next.clone().sub(prev).normalize();
    const y = ref.clone().addScaledVector(T, -ref.dot(T)).normalize();
    const x = new THREE.Vector3().crossVectors(y, T).normalize();
    if (i > 0) s += c.distanceTo(path[i - 1]);
    const k = taper ? 1 - 0.45 * smoothstep(0.7, 1, i / (n - 1)) : 1;
    return { c, x, y, rx: r * k, ryP: r * k, ryN: r * k, s };
  });
  const disp = (p, row, th) => {
    const phase = (row.s / pitch) * TAU;
    return row.rx * (0.22 * Math.sqrt(0.5 + 0.5 * Math.cos(3 * (th - phase))) - 0.22);
  };
  const ends = closed ? {} : { startPole: path[0], endPole: path[n - 1] };
  return sweep(rows, segs, { closed, disp, ...ends }).geo;
}

/** A knot lump with two frayed tails falling under gravity. */
function knot(at, out, { r = 0.0075, tail = 0.1, seed = 1 } = {}) {
  const side = new THREE.Vector3().crossVectors(out, V(0, 1, 0)).normalize();
  for (const [k, tilt] of [[1, 0.5], [-1, -0.4]]) {
    const c = at.clone().addScaledVector(side, k * 0.009);
    const ringPts = Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * TAU;
      return c.clone()
        .addScaledVector(side, Math.cos(a) * 0.012)
        .addScaledVector(V(0, 1, 0), Math.sin(a) * 0.011 * Math.cos(tilt))
        .addScaledVector(out, Math.sin(a) * 0.011 * Math.sin(tilt) + 0.004);
    });
    add("Bindings", M.rope, rope(ringPts, { r: r * 0.9, ref: out, pitch: 0.02 }));
  }
  for (const k of [-1, 1]) {
    const len = tail * (k > 0 ? 1 : 0.75);
    const pts = Array.from({ length: 5 }, (_, i) => {
      const t = i / 4;
      return at.clone()
        .addScaledVector(side, k * (0.01 + 0.012 * t) + (noise3(t * 3, seed, k, 9) - 0.5) * 0.02)
        .addScaledVector(out, 0.012 * Math.sin(t * Math.PI) + 0.006)
        .add(V(0, -len * t * t * 0.3 - len * t * 0.7, 0));
    });
    const smooth = new THREE.CatmullRomCurve3(pts).getSpacedPoints(Math.max(10, Math.round(len / 0.009)));
    add("Bindings", M.rope, rope(smooth, { r, closed: false, ref: out, taper: true }));
  }
}

// --- body ------------------------------------------------------------------------

const TORSO = [
  // y, centre z, half width, front depth, back depth, squareness
  [0.64, -0.15, 0.13, 0.09, 0.11, 2.2],
  [0.68, -0.15, 0.17, 0.115, 0.135, 2.4],
  [0.74, -0.155, 0.175, 0.12, 0.13, 2.4],
  [0.82, -0.165, 0.16, 0.125, 0.11, 2.3],
  [0.9, -0.17, 0.15, 0.115, 0.105, 2.3],
  [0.99, -0.175, 0.158, 0.11, 0.105, 2.4],
  [1.08, -0.178, 0.17, 0.118, 0.105, 2.5],
  [1.16, -0.18, 0.18, 0.105, 0.1, 2.6],
  [1.22, -0.182, 0.17, 0.085, 0.09, 2.6],
  [1.265, -0.18, 0.12, 0.07, 0.075, 2.2],
  [1.3, -0.178, 0.07, 0.058, 0.06, 2.0],
];
/** The top is worn untucked: its hem hangs over the trousers' waistband. */
const HEM_Y = 0.737;
const hang = (y) => 0.011 * (1 - smoothstep(HEM_Y + 0.04, HEM_Y + 0.12, y));

/** The torso cross-section at height y, optionally inflated by a garment's thickness. */
function torsoRow(y, grow = 0) {
  const t = (y - 0.64) / 0.66;
  const col = (j) => TORSO.map((r) => r[j]);
  return {
    c: V(0, y, keyed(col(1), t)),
    x: V(1, 0, 0),
    y: V(0, 0, 1),
    rx: keyed(col(2), t) + grow,
    ryP: keyed(col(3), t) + grow,
    ryN: keyed(col(4), t) + grow,
    e: keyed(col(5), t),
    fade: 1 - smoothstep(0.9, 1, t),
  };
}

function rowsBetween(y0, y1, n, grow) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const y = y0 + ((y1 - y0) * i) / n;
    return torsoRow(y, grow(y));
  });
}

function torso() {
  const slack = (p) => (n3(p, 20, 2) - 0.5) * 0.004 + (n3(p, 7, 3) - 0.5) * 0.006;

  // Trousers from the seat up under the top.
  const trousers = sweep(rowsBetween(0.64, 0.8, 10, () => 0), 36, {
    startPole: V(0, 0.632, -0.15),
    disp: (p, row, th) => {
      const lap = Math.max(0, Math.sin(th)) ** 2 * (1 - smoothstep(0.72, 0.76, p.y));
      return slack(p) * 0.7 + lap * Math.sin((Math.cos(th) / 0.1) * TAU + n3(p, 10, 6) * 4) * 0.003;
    },
  });
  add("Body", M.orange, trousers.geo);

  // The top, hanging loose over the lap and pulled in by the arms.
  const top = sweep(rowsBetween(HEM_Y, 1.3, 40, hang), 36, {
    endPole: V(0, 1.284, -0.178),
    disp: (p, row, th) => {
      let d = slack(p);
      // Drape folds falling to the hem.
      const drape = 1 - smoothstep(HEM_Y + 0.02, HEM_Y + 0.12, p.y);
      d += drape * (0.004 + 0.004 * Math.sin(th * 9 + n3(p, 12, 7) * 4));
      const front = Math.max(0, Math.sin(th)) ** 2;
      const belly = smoothstep(0.8, 0.84, p.y) * (1 - smoothstep(0.92, 0.97, p.y));
      const w1 = Math.sin((p.y / 0.026) * TAU + n3(p, 9, 4) * 4 + Math.cos(th) * 1.5);
      d += belly * front * (w1 > 0 ? w1 : w1 * 0.35) * 0.004;
      // Drag lines from the armpits where the arms pull the top forward.
      const side = Math.abs(Math.cos(th)) ** 3;
      const pit = smoothstep(0.98, 1.03, p.y) * (1 - smoothstep(1.12, 1.17, p.y));
      const w2 = Math.sin(((p.y + Math.abs(p.z - row.c.z) * 0.8) / 0.03) * TAU + n3(p, 11, 5) * 3);
      d += pit * side * (w2 > 0 ? w2 : w2 * 0.3) * 0.0035;
      return d;
    },
  });
  add("Body", M.orange, top.geo);

  // Double-stitched hem round the bottom of the top.
  const r = torsoRow(HEM_Y + 0.004, hang(HEM_Y) + 0.004);
  const hem = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * TAU;
    const cs = Math.cos(a), sn = Math.sin(a);
    const C = Math.sign(cs) * Math.abs(cs) ** (2 / r.e);
    const S = Math.sign(sn) * Math.abs(sn) ** (2 / r.e);
    return V(r.rx * C, r.c.y, r.c.z + (sn >= 0 ? r.ryP : r.ryN) * S);
  });
  band(hem, V(0, 1, 0), 0.004, 0.018, M.orange);
  return { top: top.rings, all: trousers.rings.concat(top.rings) };
}

function surfacePoint(ring, j, lift = 0) {
  const centre = ring.reduce((a, q) => a.add(q), V(0, 0, 0)).multiplyScalar(1 / ring.length);
  const n = ring[j].clone().sub(centre).setY(0).normalize();
  return { p: ring[j].clone().addScaledVector(n, lift), n };
}

function surfaceLine(rings, j, from, to, lift) {
  return rings.slice(from, to).map((ring) => surfacePoint(ring, j, lift).p);
}

/** A solid band round a closed loop: neckbands, hems, sleeve ends. */
function band(loop, axis, thick, width, mat) {
  const centre = loop.reduce((a, p) => a.add(p), V(0, 0, 0)).multiplyScalar(1 / loop.length);
  const rows = loop.map((c) => {
    const d = c.clone().sub(centre);
    const out = d.addScaledVector(axis, -d.dot(axis)).normalize();
    return { c, x: out, y: axis, rx: thick, ryP: width / 2, ryN: width / 2, e: 3 };
  });
  add("Body", mat, sweep(rows, 8, { closed: true }).geo);
}

/** One side of a ring (front, side = 1, or back, side = -1) sampled at a given x. */
function sideAt(ring, x, side) {
  const centreZ = ring.reduce((a, p) => a + p.z, 0) / ring.length;
  let best = null;
  for (let j = 0; j < ring.length; j++) {
    const a = ring[j], b = ring[(j + 1) % ring.length];
    if ((a.x - x) * (b.x - x) > 0 || (a.z - centreZ) * side < 0 || (b.z - centreZ) * side < 0) continue;
    const t = a.x === b.x ? 0 : (x - a.x) / (b.x - a.x);
    const p = a.clone().lerp(b, t);
    if (!best || p.z * side > best.z * side) best = p;
  }
  return best;
}

/** A surface grid lifted along its own normals, as a mesh: panels, trims and printed stencils. */
function liftedGrid(grid, lift, facing, mat, { edge = true, uv = false } = {}) {
  const NV = grid.length - 1, NU = grid[0].length - 1;
  const lifted = grid.map((row, iv) => row.map((p, iu) => {
    const du = row[Math.min(NU, iu + 1)].clone().sub(row[Math.max(0, iu - 1)]);
    const dv = grid[Math.min(NV, iv + 1)][iu].clone().sub(grid[Math.max(0, iv - 1)][iu]);
    const n = du.cross(dv).normalize();
    if (n.dot(facing(p)) < 0) n.negate();
    return p.clone().addScaledVector(n, lift);
  }));
  const pos = [], uvs = [], idx = [];
  lifted.forEach((row, iv) => row.forEach((p, iu) => {
    pos.push(p.x, p.y, p.z);
    uvs.push(iu / NU, iv / NV);
  }));
  for (let iv = 0; iv < NV; iv++) {
    for (let iu = 0; iu < NU; iu++) {
      const a = iv * (NU + 1) + iu, b = a + 1, c = a + NU + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  if (uv) geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const c = NU / 2 | 0, m = NV / 2 | 0;
  const probe = new THREE.Vector3().fromBufferAttribute(geo.attributes.normal, m * (NU + 1) + c);
  if (probe.dot(facing(lifted[m][c])) < 0) {
    for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  add("Body", mat, geo);
  if (edge) {
    const ring = [
      ...lifted[0],
      ...lifted.slice(1).map((r) => r[NU]),
      ...lifted[NV].slice(0, NU).reverse(),
      ...lifted.slice(1, NV).reverse().map((r) => r[0]),
    ];
    add("Body", mat, rope(ring, { r: lift * 0.6, ref: facing(ring[0]), segs: 5, pitch: 1e9 }));
  }
}

/**
 * A panel lying on the torso between two heights, with `span(v)` giving its
 * x range at each height (v = 0 at the bottom). Sampled from the rings so it
 * follows every curve. On the back, pass the span right to left so the u
 * direction still reads left to right from behind.
 */
function torsoPanel(rings, y0, y1, span, lift, mat, { side = 1, edge = true, uv = false, nu = 8, nv = 8 } = {}) {
  const ringAt = (y) => {
    const i = rings.findIndex((r) => r[0].y >= y);
    const a = rings[Math.max(0, i - 1)], b = rings[Math.max(0, i)];
    const t = b[0].y === a[0].y ? 0 : (y - a[0].y) / (b[0].y - a[0].y);
    return a.map((p, j) => p.clone().lerp(b[j], t));
  };
  const grid = [];
  for (let iv = 0; iv <= nv; iv++) {
    const v = iv / nv;
    const ring = ringAt(y0 + (y1 - y0) * v);
    const [xa, xb] = span(v);
    grid.push(Array.from({ length: nu + 1 }, (_, iu) => sideAt(ring, xa + ((xb - xa) * iu) / nu, side)));
  }
  liftedGrid(grid, lift, () => V(0, 0, side), mat, { edge, uv });
}

function topDetails(rings) {
  // Chest pocket, stitched on.
  torsoPanel(rings, 1.02, 1.12, () => [0.04, 0.128], 0.0028, M.orange);

  // V-neck: bare skin inside the V, ribbed trim along its edges and round the back.
  const vy = 1.17;
  const half = (v) => 0.058 * v;
  torsoPanel(rings, vy, 1.29, (v) => [-half(v), half(v)], 0.0022, M.skin, { edge: false, nv: 10 });
  for (const k of [-1, 1]) {
    torsoPanel(rings, vy - 0.006, 1.29, (v) => {
      const a = half(v) - 0.003, b = half(v) + 0.011;
      return k > 0 ? [a, b] : [-b, -a];
    }, 0.0035, M.trim, { edge: false, nu: 3, nv: 10 });
  }
  const neck = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * TAU;
    return V(Math.cos(a) * 0.072, 1.294, -0.178 + Math.sin(a) * 0.061);
  });
  band(neck, V(0, 1, 0), 0.0045, 0.016, M.trim);
  add("Body", M.trim, ellipsoid(V(0, 1.289, -0.178), V(0.058, 0.008, 0.05)));

  // Printed across the back.
  torsoPanel(rings, 1.085, 1.155, () => [0.13, -0.13], 0.0012, M.stencil, { side: -1, edge: false, uv: true, nu: 16, nv: 4 });
}

function arm(s) {
  // Short sleeve.
  const sleeve = limb({
    pts: [V(s * 0.155, 1.215, -0.18), V(s * 0.205, 1.19, -0.178), V(s * 0.25, 1.125, -0.16)],
    radii: [0.06, 0.063, 0.058],
    up: V(0, 0, 1),
    segs: 18,
    rows: 12,
    cap: [1, 0.25],
    disp: clothDisp({ seed: 10 + s, folds: [{ at: "end", span: 0.04, k: 0.5 }] }),
  });
  add("Body", M.orange, sleeve.geo);
  const end = sleeve.curve.getPointAt(1);
  const axis = sleeve.curve.getTangentAt(1);
  const u = new THREE.Vector3().crossVectors(axis, V(0, 0, 1)).normalize();
  const w = new THREE.Vector3().crossVectors(axis, u).normalize();
  const cuff = Array.from({ length: 30 }, (_, i) => {
    const a = (i / 30) * TAU;
    return end.clone().addScaledVector(u, Math.cos(a) * 0.058).addScaledVector(w, Math.sin(a) * 0.058).addScaledVector(axis, -0.006);
  });
  band(cuff, axis, 0.005, 0.018, M.orange);

  // Bare arm from inside the sleeve to the wrist.
  add("Body", M.skin, limb({
    pts: [V(s * 0.215, 1.17, -0.172), V(s * 0.27, 1.09, -0.15), V(s * 0.325, 0.99, -0.115)],
    radii: [0.045, 0.042, 0.038],
    up: V(0, 0, 1),
    segs: 16,
    rows: 12,
    disp: (p) => (n3(p, 25, 32 + s) - 0.5) * 0.0015,
  }).geo);
  add("Body", M.skin, limb({
    pts: [V(s * 0.328, 0.984, -0.125), V(s * 0.34, 0.976, -0.06), V(s * 0.354, 0.968, 0.05), V(s * 0.36, 0.962, 0.14)],
    radii: [0.038, 0.037, 0.035, 0.031, 0.028],
    flat: 0.9,
    segs: 16,
    rows: 16,
    disp: (p) => (n3(p, 25, 30 + s) - 0.5) * 0.0015,
  }).geo);
}

function hand(s) {
  const wrist = V(s * 0.36, 0.95, 0.15);
  const med = V(-s, 0, 0);
  const at = (lat, fwd, y) => V(wrist.x + med.x * lat, y, wrist.z + fwd);

  add("Body", M.skin, limb({ pts: [at(0, -0.05, 0.958), at(0, 0.01, 0.952)], radii: [0.027, 0.027], flat: 0.8, segs: 12, rows: 4 }).geo);
  add("Body", M.skin, limb({
    pts: [at(0, 0, 0.95), at(-0.002, 0.05, 0.946), at(-0.001, 0.095, 0.944)],
    radii: [0.03, 0.04, 0.043],
    flat: [0.72, 0.36, 0.3],
    e: 2.6,
    segs: 16,
    rows: 10,
    cap: [0.4, 0.3],
  }).geo);

  // lateral (towards the thumb = medial), forward, yaw, phalanx lengths, radius
  const fingers = [
    [0.028, 0.095, 0.07, [0.04, 0.025, 0.02], 0.0092],
    [0.009, 0.1, 0.0, [0.045, 0.028, 0.022], 0.0096],
    [-0.01, 0.096, -0.05, [0.042, 0.026, 0.021], 0.0089],
    [-0.028, 0.086, -0.12, [0.032, 0.019, 0.017], 0.0078],
  ];
  const pitches = [-0.05, 0.09, 0.31];
  fingers.forEach(([lat, fwd, yaw, lens, r0], fi) => {
    let p = at(lat, fwd, 0.945 - (fi === 3 ? 0.002 : 0));
    let pitch = 0;
    lens.forEach((len, k) => {
      pitch += pitches[k];
      const dir = V(med.x * Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(Math.cos(pitch)).add(V(0, -Math.sin(pitch), 0)).normalize();
      const q = p.clone().addScaledVector(dir, len);
      const ra = r0 * (1 - k * 0.1), rb = r0 * (0.94 - k * 0.1);
      add("Body", M.skin, limb({ pts: [p, p.clone().lerp(q, 0.5), q], radii: [ra, (ra + rb) / 2 + 0.0004, rb], flat: 0.88, segs: 8, rows: 3, cap: [0.9, 1] }).geo);
      if (k === 0) add("Body", M.skin, ellipsoid(p.clone().add(V(0, 0.004, 0)), V(r0 * 1.05, r0 * 0.8, r0 * 1.1), { dir, w: 8, h: 5 }));
      if (k === 2) {
        const up = new THREE.Vector3().crossVectors(dir, new THREE.Vector3().crossVectors(V(0, 1, 0), dir)).normalize();
        const nail = p.clone().lerp(q, 0.62).addScaledVector(up, rb * 0.82);
        add("Body", M.nails, ellipsoid(nail, V(rb * 0.78, rb * 0.22, len * 0.42), { dir, up, w: 8, h: 4 }));
      }
      p = q;
    });
  });

  const thumb = [at(0.024, 0.015, 0.944), at(0.046, 0.055, 0.936), at(0.054, 0.085, 0.93), at(0.057, 0.108, 0.925)];
  const tr = [[0.015, 0.013], [0.0115, 0.0105], [0.0105, 0.0085]];
  for (let k = 0; k < 3; k++) {
    const a = thumb[k], b = thumb[k + 1];
    add("Body", M.skin, limb({ pts: [a, a.clone().lerp(b, 0.5), b], radii: [tr[k][0], (tr[k][0] + tr[k][1]) / 2, tr[k][1]], flat: 0.85, segs: 8, rows: 3 }).geo);
  }
  const dir = thumb[3].clone().sub(thumb[2]).normalize();
  const up = V(med.x * 0.6, 0.8, 0).normalize();
  add("Body", M.nails, ellipsoid(thumb[2].clone().lerp(thumb[3], 0.62).addScaledVector(up, 0.0072), V(0.0068, 0.002, 0.0105), { dir, up, w: 8, h: 4 }));
}

function leg(s) {
  const thigh = limb({
    pts: [V(s * 0.085, 0.715, -0.14), V(s * 0.1, 0.712, 0.0), V(s * 0.12, 0.708, 0.17), V(s * 0.135, 0.7, 0.31)],
    radii: [0.092, 0.088, 0.075, 0.06],
    flat: 0.86,
    segs: 20,
    rows: 24,
    disp: clothDisp({ seed: 30 + s, folds: [{ at: "start", span: 0.08, k: 0.6 }, { at: "end", span: 0.1, k: 0.8 }] }),
  });
  add("Body", M.orange, thigh.geo);
  // INMATE printed down the right leg.
  if (s < 0) {
    const j0 = thigh.bodyRings[0].length / 4;
    const grid = [-1, 0, 1].map((k) => thigh.bodyRings.slice(5, 18).map((ring) => ring[j0 + k].clone()));
    liftedGrid(grid, 0.0012, () => V(0, 1, 0), M.stencil, { edge: false, uv: true });
  }
  const shin = limb({
    pts: [V(s * 0.14, 0.7, 0.325), V(s * 0.16, 0.55, 0.33), V(s * 0.19, 0.36, 0.315), V(s * 0.215, 0.16, 0.295)],
    radii: [0.058, 0.062, 0.059, 0.056],
    up: V(0, 0, 1),
    segs: 20,
    rows: 22,
    cap: [0.7, 0.5],
    disp: clothDisp({ seed: 40 + s, folds: [{ at: "start", span: 0.12 }, { at: "end", span: 0.07, k: 0.8 }] }),
  });
  add("Body", M.orange, shin.geo);

  // Outer trouser seam.
  const j = s > 0 ? 0 : 10;
  for (const part of [thigh, shin]) {
    const line = surfaceLine(part.bodyRings, j, 2, part.bodyRings.length - 2, 0.0012);
    add("Body", M.trim, rope(line, { r: 0.0022, closed: false, ref: V(0, 1, 0), segs: 5, pitch: 1e9 }));
  }
  return shin;
}

function boot(s) {
  const ax = s * 0.215, az = 0.295;
  const parts = [];
  parts.push([M.boot, limb({
    pts: [V(ax, 0.2, az), V(ax, 0.13, az + 0.004), V(ax, 0.07, az + 0.008)],
    radii: [0.056, 0.052, 0.054],
    up: V(0, 0, 1),
    flat: 1.12,
    segs: 18,
    rows: 10,
    cap: [0.25, 0.5],
    disp: (p) => (n3(p, 30, 50 + s) - 0.5) * 0.003,
  }).geo]);

  const foot = [V(ax, 0.075, az - 0.07), V(ax, 0.072, az - 0.02), V(ax, 0.066, az + 0.06), V(ax, 0.054, az + 0.14), V(ax, 0.047, az + 0.2)];
  const widths = [0.043, 0.047, 0.05, 0.049, 0.041];
  const heights = [0.05, 0.058, 0.045, 0.031, 0.022];
  const curve = new THREE.CatmullRomCurve3(foot);
  const footLimb = limb({
    pts: foot,
    segs: 20,
    rows: 22,
    e: 2.6,
    cap: [0.55, 0.9],
    sec: (t) => ({ rx: keyed(widths, t), ryP: keyed(heights, t), ryN: curve.getPointAt(t).y - 0.024 }),
    disp: (p) => {
      // Flex creases across the toe box, and scuffed leather everywhere.
      const flex = smoothstep(az + 0.05, az + 0.09, p.z) * (1 - smoothstep(az + 0.12, az + 0.15, p.z));
      return Math.sin((p.z / 0.011) * TAU + n3(p, 40, 60) * 3) * 0.0012 * flex + (n3(p, 35, 61 + s) - 0.5) * 0.002;
    },
  });
  parts.push([M.boot, footLimb.geo]);

  const solePts = foot.map((p) => V(p.x, 0.013, p.z));
  parts.push([M.sole, limb({
    pts: solePts,
    segs: 18,
    rows: 18,
    e: 4,
    cap: [0.7, 0.95],
    sec: (t) => ({ rx: keyed(widths, t) + 0.006, ryP: t < 0.3 ? 0.014 : 0.011, ryN: 0.013 }),
  }).geo]);

  for (let i = 0; i < 4; i++) {
    const t = 0.36 + i * 0.075;
    const c = curve.getPointAt(t);
    const top = c.y + keyed(heights, t);
    const w = keyed(widths, t);
    const pts = [-1, -0.5, 0, 0.5, 1].map((k) => V(ax + k * w * 0.55, top - 0.006 * k * k + 0.0015, c.z + (k > 0 ? 0.006 : -0.006) * (i % 2 ? 1 : -1)));
    parts.push([M.sole, rope(new THREE.CatmullRomCurve3(pts).getSpacedPoints(10), { r: 0.0024, closed: false, ref: V(0, 1, 0), segs: 5, pitch: 1e9 })]);
  }

  // Toes turned out a little, as feet rest when the ankles are tied apart.
  const turn = new THREE.Matrix4().makeTranslation(ax, 0, az)
    .multiply(new THREE.Matrix4().makeRotationY(s * 0.14))
    .multiply(new THREE.Matrix4().makeTranslation(-ax, 0, -az));
  for (const [mat, geo] of parts) add("Body", mat, geo.applyMatrix4(turn));
}

// --- bindings ----------------------------------------------------------------

function bindings(torsoRings) {
  const R = 0.0075;
  for (const s of [-1, 1]) {
    // Wrists: round the sleeve and the armrest together.
    for (const [i, z] of [0.088, 0.108, 0.128].entries()) {
      const shapes = [ellipsePts(s * 0.358, 0.965, 0.031 + R, 0.028 + R), rectPts(s * 0.361, 0.894, 0.0425, 0.0375, R + 0.001)];
      const path = wrapPath(shapes, (a, b, w) => V(a, b, z + w), 1 / 95, 3 * i + (s > 0 ? 1 : 2));
      add("Bindings", M.rope, rope(path, { r: R, ref: V(0, 0, 1) }));
    }
    knot(V(s * 0.405, 1.0, 0.108), V(s, 0.45, 0).normalize(), { tail: 0.12, seed: 1 + s });

    // Ankles: lashed to the front chair legs.
    for (const [i, y] of [0.19, 0.212, 0.234].entries()) {
      const t = (y - 0.045) / 0.515;
      const legX = s * (0.337 - 0.042 * t), legZ = 0.282 - 0.057 * t;
      const shinX = s * (0.215 - 0.012 * ((y - 0.16) / 0.2)), shinZ = 0.295 + 0.03 * ((y - 0.16) / 0.2);
      const shapes = [ellipsePts(shinX, shinZ, 0.061 + R, 0.061 + R), rectPts(legX, legZ, 0.0355, 0.0355, R + 0.001)];
      const path = wrapPath(shapes, (a, b, w) => V(a, y + w, b), 1 / 95, 7 * i + (s > 0 ? 3 : 4));
      add("Bindings", M.rope, rope(path, { r: R, ref: V(0, 1, 0) }));
    }
    knot(V(s * 0.37, 0.212, 0.268), V(s, 0, 0.3).normalize(), { tail: 0.1, seed: 5 + s });
  }

  // Waist: tight round the belly, then straight back to the rear posts.
  for (const [i, y] of [0.862, 0.888, 0.914].entries()) {
    const ring = torsoRings.reduce((best, r) => (Math.abs(r[0].y - y) < Math.abs(best[0].y - y) ? r : best));
    const body = ring.map((p) => {
      const c = V(0, 0, p.z > -0.17 ? -0.17 : p.z);
      const d = V(p.x, 0, p.z).sub(c).normalize();
      return [p.x + d.x * (R + 0.002), p.z + d.z * (R + 0.002)];
    });
    const t = (y - 0.57) / 0.84;
    const postX = 0.298 + 0.007 * t, postZ = -0.28 - 0.065 * t;
    const shapes = [body, rectPts(postX, postZ, 0.034, 0.034, R + 0.003), rectPts(-postX, postZ, 0.034, 0.034, R + 0.003)];
    const path = wrapPath(shapes, (a, b, w) => V(a, y + w, b), 1 / 90, 11 * i + 9);
    add("Bindings", M.rope, rope(path, { r: 0.0085, ref: V(0, 1, 0) }));
  }
  knot(V(0.01, 0.888, -0.352), V(0, 0, -1), { r: 0.0085, tail: 0.16, seed: 9 });
}

// --- assemble --------------------------------------------------------------------

const torsoRings = torso();
topDetails(torsoRings.top);
for (const s of [-1, 1]) {
  arm(s);
  hand(s);
  leg(s);
  boot(s);
}
bindings(torsoRings.all);

// --- carry over the chair and sign, then write the GLB ---------------------------

function readGlb(path) {
  const buf = readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const binLen = buf.readUInt32LE(20 + jsonLen);
  const bin = buf.subarray(28 + jsonLen, 28 + jsonLen + binLen);
  return { json, bin };
}

const src = readGlb(SRC);
function accessor(i) {
  const a = src.json.accessors[i];
  const view = src.json.bufferViews[a.bufferView];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const Ctor = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[a.componentType];
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const bytes = src.bin.subarray(start, start + a.count * comps * Ctor.BYTES_PER_ELEMENT);
  return new Ctor(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

const srcNodes = new Map(src.json.nodes.map((n) => [n.name, n]));
for (const name of KEEP) {
  const node = srcNodes.get(name);
  for (const prim of src.json.meshes[node.mesh].primitives) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(accessor(prim.attributes.POSITION), 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(accessor(prim.attributes.NORMAL), 3));
    if (prim.attributes.TEXCOORD_0 !== undefined) geo.setAttribute("uv", new THREE.BufferAttribute(accessor(prim.attributes.TEXCOORD_0), 2));
    geo.setIndex(new THREE.BufferAttribute(accessor(prim.indices), 1));
    add(name, src.json.materials[prim.material].name, geo);
  }
}

const chunks = [];
let byteLength = 0;
const bufferViews = [];
const accessors = [];
function view(bytes, target) {
  const pad = (4 - (byteLength % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    byteLength += pad;
  }
  bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.byteLength, ...(target ? { target } : {}) });
  chunks.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  byteLength += bytes.byteLength;
  return bufferViews.length - 1;
}
function addAccessor(array, type, componentType, target, minmax) {
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type];
  const item = { bufferView: view(array, target), componentType, count: array.length / comps, type };
  if (minmax) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < array.length; i += 3) for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], array[i + k]);
      max[k] = Math.max(max[k], array[i + k]);
    }
    Object.assign(item, { min, max });
  }
  accessors.push(item);
  return accessors.length - 1;
}

const materials = [];
const matIndex = new Map();
function material(name) {
  if (matIndex.has(name)) return matIndex.get(name);
  let def = src.json.materials.find((m) => m.name === name);
  if (!def) {
    const [r, g, b, rough] = NEW_MATERIALS[name];
    const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    def = { name, pbrMetallicRoughness: { baseColorFactor: [lin(r), lin(g), lin(b), 1], metallicFactor: 0, roughnessFactor: rough } };
  }
  materials.push(def);
  matIndex.set(name, materials.length - 1);
  return materials.length - 1;
}

const ORDER = ["Chair", "Body", "NeckStick", "Bindings", "SignFrame", "SignImage"];
const meshes = [];
const nodes = [];
const stats = {};
for (const name of ORDER) {
  const primitives = [];
  let tris = 0;
  for (const [mat, geos] of groups.get(name)) {
    const merged = mergeGeometries(geos.map((g) => (g.index ? g : g.toNonIndexed())), false);
    const index = merged.index.array;
    const count = merged.attributes.position.count;
    const attributes = {
      POSITION: addAccessor(new Float32Array(merged.attributes.position.array), "VEC3", 5126, 34962, true),
      NORMAL: addAccessor(new Float32Array(merged.attributes.normal.array), "VEC3", 5126, 34962),
    };
    if (merged.attributes.uv) attributes.TEXCOORD_0 = addAccessor(new Float32Array(merged.attributes.uv.array), "VEC2", 5126, 34962);
    const small = count < 65536;
    const indices = addAccessor(small ? new Uint16Array(index) : new Uint32Array(index), "SCALAR", small ? 5123 : 5125, 34963);
    primitives.push({ attributes, indices, material: material(mat) });
    tris += index.length / 3;
  }
  meshes.push({ name, primitives });
  const node = { name, mesh: meshes.length - 1 };
  const old = srcNodes.get(name);
  if (old?.extras) node.extras = old.extras;
  if (name === "SignImage") node.translation = [old.translation[0], old.translation[1], old.translation[2] + SIGN_SHIFT_Z];
  else if (name === "NeckStick" || name === "SignFrame") node.translation = [0, 0, SIGN_SHIFT_Z];
  nodes.push(node);
  stats[name] = tris;
}

const imageBytes = (() => {
  const img = src.json.images[0];
  const v = src.json.bufferViews[img.bufferView];
  return src.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
})();
const images = [{ ...src.json.images[0], bufferView: view(new Uint8Array(imageBytes)) }];

const gltf = {
  asset: { version: "2.0", generator: "scripts/chair-character/build.mjs", copyright: "Original procedural asset" },
  scene: 0,
  scenes: [{ name: "ChairCharacter", nodes: nodes.map((_, i) => i) }],
  nodes,
  meshes,
  materials,
  textures: src.json.textures,
  samplers: src.json.samplers,
  images,
  accessors,
  bufferViews,
  buffers: [{ byteLength }],
  extensionsUsed: src.json.extensionsUsed,
  extras: { ...src.json.extras, pose: "static seated, human proportions, no skeleton" },
};
gltf.extras.triangleCount = Object.values(stats).reduce((a, b) => a + b, 0);

let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
let bin = Buffer.concat(chunks);
bin = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
const header = Buffer.alloc(12);
header.write("glTF", 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const chunkHeader = (len, type) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(len, 0);
  b.write(type, 4);
  return b;
};
const glb = Buffer.concat([header, chunkHeader(json.length, "JSON"), json, chunkHeader(bin.length, "BIN\0"), bin]);
writeFileSync(OUT, glb);
console.log(stats, `${gltf.extras.triangleCount} triangles`, `${(glb.length / 1024).toFixed(0)} KB`);
