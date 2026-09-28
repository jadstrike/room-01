import * as THREE from "three";

/**
 * Re-dresses the chair character so it belongs in Room 01. The model ships with
 * flat, saturated colours and an unlit sign, and has no UVs apart from the sign,
 * so every surface is given a triplanar PBR texture instead: the room's own
 * wood, painted-metal, rust and paper sets where they fit, and procedural cloth,
 * rope, skin, leather and rubber built in the same grimy style where they do not.
 *
 * Keyed on the chair's material names, so any other character is left alone.
 */

type Kind = "cloth" | "rope" | "skin" | "leather" | "rubber" | "grime";

interface TexSet {
  color: THREE.Texture;
  orm: THREE.Texture;
  normal: THREE.Texture;
}

interface Look {
  /** A room material to borrow maps from, or a procedural kind. */
  from: string | Kind;
  /** Texture repeats per metre. */
  scale: number;
  tint: THREE.ColorRepresentation;
  /** Multiplies the tint, for borrowed maps darker than this surface should be. */
  gain?: number;
  roughness: number;
  metalness?: number;
  normalScale?: number;
  /** Printed text over the fabric, for stencilled clothing. */
  stencil?: string;
}

const LOOKS: Record<string, Look> = {
  "Prison | orange cotton": { from: "cloth", scale: 5, tint: 0x9a4a22, roughness: 1 },
  "Prison | rib trim": { from: "cloth", scale: 9, tint: 0x6e3216, roughness: 1 },
  "Prison | stencil": { from: "cloth", scale: 5, tint: 0x161412, roughness: 0.9, stencil: "INMATE" },
  "Skin | pallid": { from: "skin", scale: 16, tint: 0x9a7a68, roughness: 1 },
  "Skin | nails": { from: "skin", scale: 16, tint: 0x8c7a70, roughness: 0.6 },
  "Boots | charcoal rubber": { from: "rubber", scale: 6, tint: 0x2a2826, roughness: 1 },
  "Boots | oiled leather": { from: "leather", scale: 7, tint: 0x4a3a2e, roughness: 1 },
  "Chair | honey oak": { from: "M_WoodDark", scale: 1.6, tint: 0xffffff, gain: 1.8, roughness: 1 },
  "Chair | end grain": { from: "M_WoodDark", scale: 1.6, tint: 0xffe8d0, gain: 2.1, roughness: 0.95 },
  "Chair | grain and joints": { from: "M_WoodDark", scale: 1.6, tint: 0xffffff, gain: 1.1, roughness: 1 },
  "Bindings | golden hemp": { from: "rope", scale: 9, tint: 0xa08a60, roughness: 1 },
  "Sign | petrol enamel": { from: "M_PaintedWood", scale: 3, tint: 0xffffff, roughness: 1 },
  "Hardware | brass": { from: "M_RustedIron", scale: 12, tint: 0xd0b090, roughness: 0.8, metalness: 0.35 },
  "Sign | ivory backing": { from: "grime", scale: 3, tint: 0x8a8070, roughness: 1 },
  FaceImageMaterial: { from: "grime", scale: 2.2, tint: 0xb4ac9c, roughness: 0.95 },
};

export function dressChair(character: THREE.Object3D, room: THREE.Object3D): boolean {
  let dressed = false;
  character.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.Material;
    const look = LOOKS[src.name];
    if (!look) return;
    const set = roomSet(room, look.from) ?? proceduralSet(look.from as Kind);
    if (!set) return;

    const mat = new THREE.MeshStandardMaterial({
      name: src.name,
      color: new THREE.Color(look.tint).multiplyScalar(look.gain ?? 1),
      roughness: look.roughness,
      metalness: look.metalness ?? 0,
    });
    // The sign keeps its picture, but is now lit by the room like paper would be.
    const map = (src as THREE.MeshBasicMaterial).map;
    if (map) mat.map = map;
    if (look.stencil) {
      mat.map = stencilTexture(look.stencil);
      mat.transparent = true;
      mat.depthWrite = false;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -2;
      mat.polygonOffsetUnits = -2;
      // Ink sits on the fabric: a shadow from the decal quad would show as a dark box.
      mesh.castShadow = false;
    }
    triplanar(mat, set, look.scale, look.normalScale ?? 1);
    src.dispose();
    mesh.material = mat;
    dressed = true;
  });
  return dressed;
}

/** Worn black stencil lettering on a transparent background, as the ink wears off the weave. */
function stencilTexture(text: string): THREE.CanvasTexture {
  const w = 1024, h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${h * 0.8}px Impact, "Arial Black", "Helvetica Neue", sans-serif`;
  const fit = Math.min(1, (w * 0.94) / ctx.measureText(text).width);
  ctx.setTransform(fit, 0, 0, 1, w / 2, h / 2);
  ctx.fillText(text, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Seeded, so the wear pattern is the same every load.
  let seed = 7;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 2200; i++) {
    ctx.globalAlpha = 0.25 + rand() * 0.6;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, 0.6 + rand() * rand() * 7, 0, Math.PI * 2);
    ctx.fill();
  }
  // A few long scuffs where it has rubbed against the chair.
  ctx.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = 0.3 + rand() * 0.4;
    ctx.lineWidth = 2 + rand() * 6;
    const x = rand() * w, y = rand() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 260, y + (rand() - 0.5) * 60);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function roomSet(room: THREE.Object3D, name: string): TexSet | null {
  let found: THREE.MeshStandardMaterial | null = null;
  room.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (found || !mesh.isMesh) return;
    for (const m of ([] as THREE.Material[]).concat(mesh.material as THREE.Material)) {
      if (m.name === name) found = m as THREE.MeshStandardMaterial;
    }
  });
  const m = found as THREE.MeshStandardMaterial | null;
  if (!m?.map || !m.roughnessMap || !m.normalMap) return null;
  return { color: m.map, orm: m.roughnessMap, normal: m.normalMap };
}

// --- triplanar shading -----------------------------------------------------

/**
 * World-space triplanar colour, ORM and whiteout-blended normals, injected into
 * the standard material so lights, shadows and fog are untouched. World space
 * is fine because the character never moves once placed.
 */
function triplanar(mat: THREE.MeshStandardMaterial, set: TexSet, scale: number, normalScale: number): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.triColor = { value: set.color };
    shader.uniforms.triOrm = { value: set.orm };
    shader.uniforms.triNormal = { value: set.normal };
    shader.uniforms.triScale = { value: scale };
    shader.uniforms.triNormalScale = { value: normalScale };

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNormal;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vTriPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vTriNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D triColor;
        uniform sampler2D triOrm;
        uniform sampler2D triNormal;
        uniform float triScale;
        uniform float triNormalScale;
        varying vec3 vTriPos;
        varying vec3 vTriNormal;
        vec4 triSample(sampler2D t, vec3 p, vec3 w) {
          return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
        }`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec3 triN = normalize(vTriNormal);
        vec3 triW = pow(abs(triN), vec3(4.0));
        triW /= triW.x + triW.y + triW.z;
        vec3 triP = vTriPos * triScale;
        diffuseColor.rgb *= triSample(triColor, triP, triW).rgb;
        vec3 triM = triSample(triOrm, triP, triW).rgb;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * triM.g, 0.04, 1.0);",
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        {
          vec3 tnX = texture2D(triNormal, triP.zy).xyz * 2.0 - 1.0;
          vec3 tnY = texture2D(triNormal, triP.xz).xyz * 2.0 - 1.0;
          vec3 tnZ = texture2D(triNormal, triP.xy).xyz * 2.0 - 1.0;
          tnX.xy *= triNormalScale; tnY.xy *= triNormalScale; tnZ.xy *= triNormalScale;
          tnX = vec3(tnX.xy + triN.zy, abs(tnX.z) * triN.x);
          tnY = vec3(tnY.xy + triN.xz, abs(tnY.z) * triN.y);
          tnZ = vec3(tnZ.xy + triN.xy, abs(tnZ.z) * triN.z);
          vec3 triWorldN = normalize(tnX.zyx * triW.x + tnY.xzy * triW.y + tnZ.xyz * triW.z);
          normal = normalize((viewMatrix * vec4(triWorldN, 0.0)).xyz);
        }`,
      )
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        reflectedLight.indirectDiffuse *= triM.r;
        reflectedLight.indirectSpecular *= triM.r;`,
      );
  };
  mat.customProgramCacheKey = () => "chair-triplanar";
}

// --- procedural texture sets -------------------------------------------------

const cache = new Map<Kind, TexSet>();

function proceduralSet(kind: Kind): TexSet | null {
  if (!["cloth", "rope", "skin", "leather", "rubber", "grime"].includes(kind)) return null;
  let set = cache.get(kind);
  if (!set) {
    set = bake(kind);
    cache.set(kind, set);
  }
  return set;
}

/** Tileable value noise: the lattice wraps at `period`, so octaves tile too. */
function noise2(seed: number) {
  const hash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  return (u: number, v: number, period: number) => {
    const x = u * period;
    const y = v * period;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const w = (i: number) => ((i % period) + period) % period;
    const a = hash(w(xi), w(yi));
    const b = hash(w(xi + 1), w(yi));
    const c = hash(w(xi), w(yi + 1));
    const d = hash(w(xi + 1), w(yi + 1));
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function fbm(n: ReturnType<typeof noise2>, u: number, v: number, period: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += n(u, v, period) * amp;
    norm += amp;
    period *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

/** Distance to the nearest cell edge of a tileable Voronoi, for craquelure. */
function cellEdge(u: number, v: number, cells: number, seed: number): number {
  const rand = noise2(seed);
  const x = u * cells;
  const y = v * cells;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let d1 = 9;
  let d2 = 9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i;
      const cy = yi + j;
      const wx = ((cx % cells) + cells) % cells;
      const wy = ((cy % cells) + cells) % cells;
      const px = cx + rand((wx + 0.5) / cells, (wy + 0.5) / cells, cells);
      const py = cy + rand((wy + 0.5) / cells + 0.37, (wx + 0.5) / cells, cells);
      const d = Math.hypot(px - x, py - y);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) d2 = d;
    }
  }
  return d2 - d1;
}

interface Texel {
  h: number;
  r: number;
  g: number;
  b: number;
  rough: number;
  ao: number;
}

function bake(kind: Kind): TexSet {
  const size = kind === "cloth" ? 512 : 256;
  const n1 = noise2(11);
  const n2 = noise2(29);
  const n3 = noise2(47);
  const height = new Float32Array(size * size);
  const color = new Uint8Array(size * size * 4);
  const orm = new Uint8Array(size * size * 4);
  const t: Texel = { h: 0, r: 1, g: 1, b: 1, rough: 1, ao: 1 };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      t.h = 0;
      t.r = t.g = t.b = 1;
      t.rough = 0.9;
      t.ao = 1;
      const grime = fbm(n1, u, v, 3, 5);
      const stain = fbm(n2, u, v, 2, 4);

      if (kind === "cloth") {
        // Twill: threads over two, under two, stepping one per row.
        const N = 96;
        const ix = Math.floor(u * N);
        const iy = Math.floor(v * N);
        const fx = u * N - ix;
        const fy = v * N - iy;
        const warp = (ix + iy) % 4 < 2;
        const thread = warp ? Math.sin(Math.PI * fy) * (0.7 + 0.3 * Math.sin(Math.PI * fx)) : Math.sin(Math.PI * fx) * (0.7 + 0.3 * Math.sin(Math.PI * fy));
        const crease = 1 - Math.abs(fbm(n3, u, v, 4, 4) * 2 - 1);
        t.h = thread * 0.35 + crease * crease * 0.5;
        const shade = 0.78 + 0.22 * thread;
        const dirt = 0.55 + 0.45 * smooth(0.25, 0.7, grime);
        t.r = t.g = t.b = shade * dirt;
        stainTint(t, stain, 0.7, 0.8);
        t.rough = 0.92 - (stain > 0.58 ? 0.15 : 0);
        t.ao = 0.75 + 0.25 * thread - (1 - crease) * 0.1;
      } else if (kind === "rope") {
        const twist = 0.5 + 0.5 * Math.sin(2 * Math.PI * (u * 10 + v * 10));
        const fibre = fbm(n3, u * 1, v * 1, 64, 2);
        t.h = twist * 0.8 + fibre * 0.4;
        const dirt = 0.6 + 0.4 * smooth(0.3, 0.7, grime);
        const s = (0.7 + 0.3 * twist) * (0.85 + 0.3 * (fibre - 0.5)) * dirt;
        t.r = s;
        t.g = s * 0.97;
        t.b = s * 0.9;
        t.rough = 0.95;
        t.ao = 0.6 + 0.4 * twist;
      } else if (kind === "skin") {
        // Pores, fine criss-cross lines, blotchy blood under the surface, grime in the creases.
        const pore = smooth(0.7, 0.86, n3(u, v, 72));
        const lines = 1 - Math.abs(fbm(n2, u * 1, v * 1, 12, 3) * 2 - 1);
        const crease = smooth(0.82, 0.97, lines);
        t.h = -pore * 0.3 - crease * 0.25 + fbm(n1, u, v, 24, 2) * 0.15;
        const blotch = fbm(n2, u + 0.5, v, 4, 3);
        const dirt = 0.75 + 0.25 * smooth(0.25, 0.7, grime);
        const s = dirt * (1 - pore * 0.08 - crease * 0.1);
        t.r = s * (0.96 + blotch * 0.1);
        t.g = s * (0.93 - blotch * 0.08);
        t.b = s * (0.92 - blotch * 0.04);
        t.rough = 0.5 + pore * 0.15 + crease * 0.2 + (1 - dirt) * 0.6;
        t.ao = 1 - crease * 0.4;
      } else if (kind === "leather") {
        const grain = 1 - smooth(0, 0.06, cellEdge(u, v, 22, 13));
        const crease = smooth(0.8, 0.95, 1 - Math.abs(fbm(n3, u, v, 5, 3) * 2 - 1));
        const scuff = smooth(0.6, 0.68, fbm(n2, u, v, 6, 3));
        t.h = -grain * 0.15 - crease * 0.6;
        const dirt = 0.7 + 0.3 * smooth(0.25, 0.7, grime);
        const s = dirt * (1 - crease * 0.35 - grain * 0.08) * (1 + scuff * 0.5);
        t.r = s;
        t.g = s * 0.95;
        t.b = s * 0.9;
        t.rough = 0.5 + grain * 0.1 + scuff * 0.35 + crease * 0.1;
        t.ao = 1 - crease * 0.3;
      } else if (kind === "rubber") {
        const scuff = smooth(0.62, 0.7, fbm(n3, u * 1, v * 1, 6, 3));
        t.h = fbm(n3, u, v, 32, 3) * 0.3 - scuff * 0.2;
        const dirt = 0.7 + 0.3 * smooth(0.25, 0.7, grime);
        const s = dirt * (1 + scuff * 0.6);
        t.r = s;
        t.g = s * 0.98;
        t.b = s * 0.95;
        stainTint(t, stain, 0.6, 0.6);
        t.rough = 0.72 + scuff * 0.2;
        t.ao = 0.9;
      } else {
        // Old paper and painted board: water marks, foxing and a faint tooth.
        const tooth = fbm(n3, u, v, 48, 2);
        t.h = tooth * 0.25;
        const s = 0.72 + 0.28 * smooth(0.2, 0.7, grime);
        t.r = s;
        t.g = s * 0.96;
        t.b = s * 0.86;
        stainTint(t, stain, 0.66, 0.75);
        const fox = smooth(0.78, 0.82, fbm(n1, u + 0.3, v, 24, 2));
        t.r *= 1 - fox * 0.35;
        t.g *= 1 - fox * 0.45;
        t.b *= 1 - fox * 0.6;
        t.rough = 0.92;
        t.ao = 1;
      }

      const i = y * size + x;
      height[i] = t.h;
      color[i * 4] = toSRGB8(t.r);
      color[i * 4 + 1] = toSRGB8(t.g);
      color[i * 4 + 2] = toSRGB8(t.b);
      color[i * 4 + 3] = 255;
      orm[i * 4] = clamp8(t.ao);
      orm[i * 4 + 1] = clamp8(t.rough);
      orm[i * 4 + 2] = 0;
      orm[i * 4 + 3] = 255;
    }
  }

  return {
    color: texture(color, size, THREE.SRGBColorSpace),
    orm: texture(orm, size, THREE.NoColorSpace),
    normal: texture(normalFromHeight(height, size, kind === "cloth" ? 3 : 4), size, THREE.NoColorSpace),
  };
}

/** Brown tide-marked stains, like the ones on the room's fabric and paper. */
function stainTint(t: Texel, stain: number, threshold: number, depth: number): void {
  const inside = smooth(threshold, threshold + 0.02, stain);
  const ring = inside * (1 - smooth(threshold + 0.02, threshold + 0.05, stain));
  const k = 1 - inside * (1 - depth) - ring * 0.2;
  t.r *= k * 1.0;
  t.g *= k * 0.86;
  t.b *= k * 0.68;
}

function normalFromHeight(h: Float32Array, size: number, strength: number): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out[i] = clamp8((-dx / len) * 0.5 + 0.5);
      out[i + 1] = clamp8((-dy / len) * 0.5 + 0.5);
      out[i + 2] = clamp8((1 / len) * 0.5 + 0.5);
      out[i + 3] = 255;
    }
  }
  return out;
}

function texture(data: Uint8Array, size: number, colorSpace: THREE.ColorSpace): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = colorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function clamp8(x: number): number {
  return Math.max(0, Math.min(255, Math.round(x * 255)));
}

function toSRGB8(linear: number): number {
  const c = Math.max(0, Math.min(1, linear));
  return clamp8(c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
}
