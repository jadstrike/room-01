import * as THREE from "three";
import { Pass } from "three/addons/postprocessing/Pass.js";

/**
 * The first-person gun and hands, Counter-Strike style: drawn by their own
 * camera on their own layer after the world, with the depth buffer cleared,
 * so they never clip into walls and keep one field of view whatever the
 * player's FOV is. They still live in the world scene, so the bulb, its
 * shadows and the muzzle flash light them like everything else.
 */
export const VIEWMODEL_LAYER = 1;

/** Renders only the viewmodel layer over the finished world image. */
export class ViewmodelPass extends Pass {
  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
  ) {
    super();
    this.needsSwap = false;
  }

  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    const autoClear = renderer.autoClear;
    // The world pass already drew the shadow maps this frame.
    const autoShadows = renderer.shadowMap.autoUpdate;
    // A colour background forces a clear even with autoClear off, which would wipe the world.
    const background = this.scene.background;
    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false;
    this.scene.background = null;
    renderer.setRenderTarget(this.renderToScreen ? null : read);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    this.scene.background = background;
    renderer.autoClear = autoClear;
    renderer.shadowMap.autoUpdate = autoShadows;
  }
}

// --- materials -------------------------------------------------------------------

function noiseTexture(size: number, draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  let seed = 11;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  draw(ctx, rand);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function speckle(size: number, dots: number, radius: number): THREE.CanvasTexture {
  return noiseTexture(size, (ctx, rand) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < dots; i++) {
      const v = Math.floor(90 + rand() * 120);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath();
      ctx.arc(rand() * size, rand() * size, radius * (0.5 + rand()), 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function weave(size: number): THREE.CanvasTexture {
  return noiseTexture(size, (ctx, rand) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = 110 + ((x + y) % 4 < 2 ? 40 : 0) + rand() * 30;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
}

function makeMaterials() {
  const stipple = speckle(256, 2600, 1.4);
  stipple.repeat.set(40, 40);
  const finish = speckle(256, 900, 0.8);
  finish.repeat.set(20, 20);
  const cloth = weave(64);
  cloth.repeat.set(30, 30);
  return {
    slide: new THREE.MeshStandardMaterial({ color: 0x232426, metalness: 0.55, roughness: 0.42, bumpMap: finish, bumpScale: 0.3 }),
    slideDark: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, metalness: 0.4, roughness: 0.6 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x1b1b1c, metalness: 0.05, roughness: 0.62, bumpMap: finish, bumpScale: 0.2 }),
    grip: new THREE.MeshStandardMaterial({ color: 0x1a1a1b, metalness: 0.05, roughness: 0.85, bumpMap: stipple, bumpScale: 1.2 }),
    barrel: new THREE.MeshStandardMaterial({ color: 0x3a3a3c, metalness: 0.8, roughness: 0.35 }),
    bore: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb08a45, metalness: 0.9, roughness: 0.3 }),
    // Tritium night sights glow faintly on their own - they matter in this room.
    tritium: new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x5dff8a, emissiveIntensity: 0.9, roughness: 0.4 }),
    glove: new THREE.MeshStandardMaterial({ color: 0x171615, metalness: 0, roughness: 0.72, bumpMap: finish, bumpScale: 0.4 }),
    knit: new THREE.MeshStandardMaterial({ color: 0x1f1f20, roughness: 0.95, bumpMap: cloth, bumpScale: 0.8 }),
    sleeve: new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.92, bumpMap: cloth, bumpScale: 0.6 }),
    textures: [stipple, finish, cloth],
  };
}

// --- geometry helpers ------------------------------------------------------------

/**
 * A side-profile shape (points as [z, y], forward is -z) extruded across x and
 * centred on it: pistols are basically profiles with thickness.
 */
function profile(points: [number, number][], width: number, bevel = 0.0012, holes: [number, number][][] = []): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y))));
  const depth = Math.max(0.0005, width - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 2,
    curveSegments: 6,
  });
  // (shape x, shape y, extrusion) -> (x across, y, z along), a proper rotation.
  geo.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, depth / 2, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  return geo;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

/** A finger or limb: a tube along a smooth path with rounded ends. */
function digit(points: THREE.Vector3[], r0: number, r1 = r0): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const segs = 12;
  const tube = new THREE.TubeGeometry(curve, segs, 1, 10, false);
  // Taper the radius along the length.
  const pos = tube.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const c = curve.getPointAt(i / segs);
    const r = r0 + (r1 - r0) * (i / segs);
    for (let j = 0; j <= 10; j++) {
      const k = i * 11 + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  tube.computeVertexNormals();
  const a = new THREE.SphereGeometry(r0, 10, 8).translate(points[0].x, points[0].y, points[0].z);
  const last = points[points.length - 1];
  const b = new THREE.SphereGeometry(r1, 10, 8).translate(last.x, last.y, last.z);
  const merged = mergeAll([tube, a, b]);
  return merged;
}

function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Keep it dependency-free: concatenate position/normal/uv of non-indexed copies.
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array as Float32Array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}

function blob(r: THREE.Vector3, at: THREE.Vector3, rotX = 0): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, 16, 12).scale(r.x, r.y, r.z).rotateX(rotX).translate(at.x, at.y, at.z);
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** z of the grip's front strap at height y; the grip rakes back about 20 degrees. */
const gripFront = (y: number) => -0.016 + (-0.03 - y) * 0.368;

// --- the viewmodel -----------------------------------------------------------------

type Shell = { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; life: number };

export class Viewmodel {
  readonly camera = new THREE.PerspectiveCamera(54, 1, 0.01, 10);
  /** Lights the room and the gun for a couple of frames per shot. */
  readonly flashLight = new THREE.PointLight(0xffb266, 0, 4.5, 2);

  private rig = new THREE.Group();
  private slide = new THREE.Group();
  private mag = new THREE.Group();
  private trigger = new THREE.Group();
  private flash: THREE.Mesh;
  private shells: Shell[] = [];
  private mats = makeMaterials();
  private muzzle = V(0, 0.028, -0.165);
  private port = V(0.01, 0.043, -0.02);

  private restPos = V(0.104, -0.098, -0.255);
  private restRot = new THREE.Euler(0.025, 0.2, 0.12);

  // Animation state.
  private drawT = 0;
  private kick = 0;
  private slideBack = 0;
  private slideLocked = false;
  private flashT = 0;
  private flashScale = 1;
  private triggerT = 0;
  private reloadT = -1;
  private reloadLen = 1;
  private reloadEmpty = false;
  private sway = new THREE.Vector2();
  private lastYaw = 0;
  private lastPitch = 0;
  private bobPhase = 0;
  private time = 0;

  constructor() {
    this.camera.layers.set(VIEWMODEL_LAYER);
    this.flashLight.layers.enableAll();
    this.flashLight.castShadow = false;
    this.flashLight.position.copy(this.muzzle).add(this.restPos).add(V(0, 0, -0.1));
    this.camera.add(this.flashLight);

    this.buildGun();
    this.buildHands();
    this.flash = this.buildFlash();
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.019, 10).rotateZ(Math.PI / 2), this.mats.brass);
      mesh.visible = false;
      this.camera.add(mesh);
      this.shells.push({ mesh, vel: V(0, 0, 0), spin: V(0, 0, 0), life: 0 });
    }
    this.camera.add(this.rig);
    this.rig.position.copy(this.restPos);

    this.camera.traverse((o) => {
      if (o === this.flashLight) return;
      o.layers.set(VIEWMODEL_LAYER);
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = mesh !== this.flash;
        mesh.frustumCulled = false;
      }
    });
  }

  private buildGun(): void {
    const m = this.mats;
    const gun = new THREE.Group();

    // Slide: flat top, chamfered nose, serrations at the back, ejection port on the right.
    this.slide.add(new THREE.Mesh(profile([[0.03, 0.012], [0.03, 0.04], [0.027, 0.043], [-0.141, 0.043], [-0.156, 0.036], [-0.156, 0.012]], 0.0255, 0.0028), m.slide));
    const serr: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const z = 0.0045 + i * 0.0029;
      for (const x of [-0.0131, 0.0131]) serr.push(box(0.0008, 0.024, 0.0013, x, 0.0275, z));
    }
    this.slide.add(new THREE.Mesh(mergeAll(serr), m.slideDark));
    this.slide.add(new THREE.Mesh(box(0.0105, 0.004, 0.036, 0.0035, 0.0418, -0.02), m.slideDark));
    this.slide.add(new THREE.Mesh(box(0.0085, 0.0035, 0.03, 0.0035, 0.0405, -0.021), m.barrel));
    // Sights, with tritium inserts.
    this.slide.add(new THREE.Mesh(mergeAll([
      box(0.0075, 0.0065, 0.0075, -0.0063, 0.0465, 0.021),
      box(0.0075, 0.0065, 0.0075, 0.0063, 0.0465, 0.021),
      box(0.0036, 0.0062, 0.006, 0, 0.0462, -0.145),
    ]), m.slideDark));
    for (const [x, z] of [[-0.0063, 0.0248], [0.0063, 0.0248], [0, -0.1418]]) {
      this.slide.add(new THREE.Mesh(new THREE.SphereGeometry(0.00115, 8, 6).translate(x, 0.0475, z), m.tritium));
    }
    // Muzzle: barrel crown and the bore.
    this.slide.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0058, 0.0058, 0.006, 16).rotateX(Math.PI / 2).translate(0, 0.028, -0.155), m.barrel));
    this.slide.add(new THREE.Mesh(new THREE.CircleGeometry(0.0043, 16).rotateY(Math.PI).translate(0, 0.028, -0.1582), m.bore));
    gun.add(this.slide);

    // Frame: dust cover, trigger guard (a real hole), raked grip with finger grooves.
    const frame = profile(
      [
        [0.036, 0.012], [-0.145, 0.012], [-0.149, 0.004], [-0.147, -0.004], [-0.078, -0.006], [-0.08, -0.03],
        [-0.072, -0.046], [-0.03, -0.048], [-0.02, -0.036], [-0.016, -0.03], [-0.012, -0.045], [-0.014, -0.052],
        [-0.006, -0.06], [-0.008, -0.07], [0.0, -0.078], [-0.002, -0.088], [0.008, -0.1], [0.012, -0.106],
        [0.058, -0.103], [0.05, -0.06], [0.038, -0.01], [0.048, 0.002], [0.046, 0.008],
      ],
      0.029,
      0.0015,
      [[[-0.07, -0.009], [-0.072, -0.03], [-0.066, -0.04], [-0.032, -0.041], [-0.024, -0.03], [-0.022, -0.009]]],
    );
    gun.add(new THREE.Mesh(frame, m.grip));
    // Smoother polymer over the top half of the frame, and the rail slots.
    gun.add(new THREE.Mesh(profile([[0.036, 0.012], [-0.145, 0.012], [-0.149, 0.004], [-0.147, -0.004], [-0.02, -0.006], [0.04, -0.004]], 0.0296, 0.0015), m.frame));
    gun.add(new THREE.Mesh(mergeAll([0, 1, 2].map((i) => box(0.031, 0.0022, 0.004, 0, -0.0045, -0.12 + i * 0.012))), m.slideDark));
    // Controls: slide stop, takedown lever.
    gun.add(new THREE.Mesh(mergeAll([
      box(0.0032, 0.0042, 0.016, -0.0158, 0.0095, -0.03),
      box(0.0025, 0.0035, 0.008, -0.0156, 0.0055, -0.058),
      box(0.0025, 0.0035, 0.008, 0.0156, 0.0055, -0.058),
    ]), m.slideDark));

    this.trigger.add(new THREE.Mesh(profile([[-0.047, -0.011], [-0.043, -0.011], [-0.041, -0.022], [-0.044, -0.034], [-0.048, -0.035], [-0.046, -0.022]], 0.0062, 0.0008), m.frame));
    gun.add(this.trigger);

    // Magazine: base plate below the grip, body and top round shown when it comes out.
    this.mag.add(new THREE.Mesh(profile([[0.011, -0.102], [0.06, -0.099], [0.063, -0.111], [0.009, -0.114]], 0.032, 0.0015), m.frame));
    this.mag.add(new THREE.Mesh(profile([[-0.004, -0.004], [0.033, -0.004], [0.054, -0.102], [0.014, -0.102]], 0.021, 0.0006), m.slideDark));
    this.mag.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.02, 10).rotateX(Math.PI / 2).translate(0, -0.001, 0.008), m.brass));
    gun.add(this.mag);

    this.rig.add(gun);
  }

  private buildHands(): void {
    const m = this.mats;
    const glove: THREE.BufferGeometry[] = [];

    // Shooting hand: back of the hand round the backstrap, fingers wrapping the
    // front strap, index finger through the guard onto the trigger, thumb high
    // on the left side.
    glove.push(blob(V(0.026, 0.046, 0.019), V(0.009, -0.05, 0.066), -0.21));
    glove.push(blob(V(0.022, 0.022, 0.024), V(0.017, -0.012, 0.05), -0.2));
    for (let k = 0; k < 3; k++) {
      const y = -0.05 - 0.017 * k;
      const zf = gripFront(y);
      glove.push(digit([V(0.017, y, zf + 0.03), V(0.018, y, zf + 0.004), V(0.005, y - 0.002, zf - 0.011), V(-0.012, y - 0.004, zf - 0.006), V(-0.019, y - 0.004, zf + 0.008)], 0.0078, 0.0068));
    }
    glove.push(digit([V(0.017, -0.022, -0.006), V(0.015, -0.02, -0.03), V(0.006, -0.022, -0.043), V(0.001, -0.027, -0.046)], 0.0085, 0.0075));
    glove.push(digit([V(-0.006, -0.01, 0.05), V(-0.018, -0.001, 0.022), V(-0.021, 0.004, -0.008)], 0.0098, 0.0085));

    // Support hand: palm on the left of the grip, fingers over the shooting
    // hand's, thumb pointing forward under the slide.
    glove.push(blob(V(0.014, 0.042, 0.036), V(-0.029, -0.068, 0.02), -0.2));
    for (let k = 0; k < 4; k++) {
      const y = -0.057 - 0.013 * k;
      const zf = gripFront(y);
      glove.push(digit([V(-0.03, y, zf + 0.004), V(-0.019, y, zf - 0.021), V(0.0, y - 0.002, zf - 0.027), V(0.019, y - 0.003, zf - 0.016), V(0.026, y - 0.003, zf + 0.002)], 0.0074, 0.0064));
    }
    glove.push(digit([V(-0.032, -0.042, 0.012), V(-0.029, -0.013, -0.02), V(-0.0245, -0.004, -0.058)], 0.0105, 0.0088));
    this.rig.add(new THREE.Mesh(mergeAll(glove), m.glove));

    // Wrists, knit cuffs and sleeves running back out of view.
    this.rig.add(new THREE.Mesh(mergeAll([
      digit([V(0.012, -0.07, 0.078), V(0.04, -0.13, 0.19), V(0.07, -0.19, 0.3)], 0.027, 0.034),
      digit([V(-0.038, -0.085, 0.045), V(-0.09, -0.14, 0.15), V(-0.14, -0.2, 0.26)], 0.026, 0.033),
    ]), m.glove));
    this.rig.add(new THREE.Mesh(mergeAll([
      digit([V(0.033, -0.117, 0.165), V(0.045, -0.14, 0.21)], 0.034, 0.036),
      digit([V(-0.075, -0.128, 0.122), V(-0.095, -0.15, 0.165)], 0.033, 0.035),
    ]), m.knit));
    this.rig.add(new THREE.Mesh(mergeAll([
      digit([V(0.043, -0.137, 0.2), V(0.1, -0.25, 0.4), V(0.16, -0.34, 0.6)], 0.042, 0.052),
      digit([V(-0.092, -0.147, 0.158), V(-0.2, -0.26, 0.36), V(-0.3, -0.35, 0.55)], 0.041, 0.05),
    ]), m.sleeve));
  }

  private buildFlash(): THREE.Mesh {
    const tex = noiseTexture(128, (ctx, rand) => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,250,230,1)");
      g.addColorStop(0.25, "rgba(255,190,90,0.9)");
      g.addColorStop(1, "rgba(255,120,30,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + rand() * 0.4;
        const len = 40 + rand() * 24;
        ctx.strokeStyle = "rgba(255,200,120,0.55)";
        ctx.lineWidth = 3 + rand() * 4;
        ctx.beginPath();
        ctx.moveTo(64, 64);
        ctx.lineTo(64 + Math.cos(a) * len, 64 + Math.sin(a) * len);
        ctx.stroke();
      }
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.055), mat);
    flash.position.copy(this.muzzle).add(V(0, 0, -0.01));
    // Always drawn, scaled to nothing between shots, so its shader compiles at load, not on the first shot.
    flash.scale.setScalar(1e-4);
    this.slide.parent!.add(flash);
    return flash;
  }

  // --- actions --------------------------------------------------------------------

  equip(): void {
    this.drawT = 0;
    this.reloadT = -1;
  }

  fire(emptyAfter: boolean): void {
    this.kick = Math.min(1.4, this.kick + 1);
    this.slideBack = 1;
    this.slideLocked = emptyAfter;
    this.flashT = 0.05;
    this.triggerT = 0.08;
    this.flash.rotation.z = Math.random() * Math.PI * 2;
    this.flashScale = 0.8 + Math.random() * 0.5;
    this.ejectShell();
  }

  dryFire(): void {
    this.triggerT = 0.08;
    this.kick = Math.max(this.kick, 0.12);
  }

  reload(duration: number, empty: boolean): void {
    this.reloadT = 0;
    this.reloadLen = duration;
    this.reloadEmpty = empty;
  }

  get reloading(): boolean {
    return this.reloadT >= 0;
  }

  private ejectShell(): void {
    const s = this.shells.find((x) => x.life <= 0) ?? this.shells[0];
    s.mesh.position.copy(this.port).applyEuler(this.rig.rotation).add(this.rig.position);
    s.mesh.rotation.set(Math.random(), Math.random(), Math.random());
    s.vel.set(0.9 + Math.random() * 0.4, 0.9 + Math.random() * 0.5, 0.15 + Math.random() * 0.2);
    s.spin.set(Math.random() * 30, Math.random() * 30, Math.random() * 30);
    s.life = 0.7;
    s.mesh.visible = true;
  }

  // --- per frame -------------------------------------------------------------------

  /** Follows the world camera, then poses the rig: draw, sway, bob, recoil, reload. */
  update(dt: number, world: THREE.Camera, look: { yaw: number; pitch: number }, speed01: number): void {
    this.time += dt;
    world.getWorldPosition(this.camera.position);
    world.getWorldQuaternion(this.camera.quaternion);
    this.camera.updateMatrixWorld();

    // Sway: the gun lags behind the look direction, then springs back.
    let dyaw = look.yaw - this.lastYaw;
    if (dyaw > Math.PI) dyaw -= Math.PI * 2;
    if (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const dpitch = look.pitch - this.lastPitch;
    this.lastYaw = look.yaw;
    this.lastPitch = look.pitch;
    const k = Math.min(1, dt * 10);
    this.sway.x += (THREE.MathUtils.clamp(dyaw * 2.2, -0.08, 0.08) - this.sway.x) * k;
    this.sway.y += (THREE.MathUtils.clamp(dpitch * 2.2, -0.08, 0.08) - this.sway.y) * k;

    this.bobPhase += dt * (5 + speed01 * 7) * Math.max(0.2, speed01);
    const bobX = Math.sin(this.bobPhase) * 0.0065 * speed01;
    const bobY = -Math.abs(Math.cos(this.bobPhase)) * 0.005 * speed01 + Math.sin(this.time * 1.6) * 0.0009;

    this.kick *= Math.exp(-dt * 13);
    this.drawT = Math.min(1, this.drawT + dt / 0.55);
    const draw = 1 - (1 - this.drawT) ** 3;

    const pos = this.rig.position.copy(this.restPos);
    const rot = this.rig.rotation.copy(this.restRot);
    pos.x += bobX - this.sway.x * 0.06;
    pos.y += bobY + this.sway.y * 0.05 - (1 - draw) * 0.16;
    pos.z += this.kick * 0.032;
    rot.x += this.kick * 0.13 + this.sway.y * 0.6 - (1 - draw) * 0.7;
    rot.y += this.sway.x * 0.6;
    rot.z += -this.sway.x * 0.4 + bobX * 1.5;

    // Reload: tilt the gun in, drop the magazine, seat a new one, release the slide.
    this.mag.position.set(0, 0, 0);
    this.mag.visible = true;
    if (this.reloadT >= 0) {
      this.reloadT += dt;
      const t = this.reloadT / this.reloadLen;
      const e = (a: number, b: number) => THREE.MathUtils.smoothstep(t, a, b);
      const tilt = e(0.02, 0.18) * (1 - e(0.78, 0.96));
      rot.z += tilt * 0.55;
      rot.x += tilt * 0.22;
      rot.y -= tilt * 0.15;
      pos.x -= tilt * 0.035;
      pos.y -= tilt * 0.02;
      if (t < 0.45) {
        const drop = e(0.16, 0.42);
        this.mag.position.set(0, -drop * drop * 0.25, drop * drop * 0.05);
        this.mag.visible = drop < 0.98;
      } else {
        const rise = 1 - e(0.5, 0.68);
        this.mag.position.set(0, -rise * 0.09, rise * 0.018);
        pos.y += e(0.66, 0.7) * (1 - e(0.7, 0.76)) * 0.006;
      }
      if (this.reloadEmpty && t > 0.8) this.slideLocked = false;
      if (t >= 1) this.reloadT = -1;
    }

    // Slide cycles back and forward, or stays locked back on an empty magazine.
    this.slideBack = Math.max(0, this.slideBack - dt / 0.07);
    const back = this.slideLocked ? 1 : Math.sin(this.slideBack * Math.PI * 0.5);
    this.slide.position.z = back * 0.024;

    this.triggerT = Math.max(0, this.triggerT - dt);
    this.trigger.position.z = this.triggerT > 0 ? 0.0035 : 0;

    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.scale.setScalar(this.flashT > 0 ? this.flashScale : 1e-4);
    this.flashLight.intensity = this.flashT > 0 ? 4 * (this.flashT / 0.05) : 0;

    for (const s of this.shells) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.vel.y -= 5.5 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.spin.x * dt;
      s.mesh.rotation.y += s.spin.y * dt;
      s.mesh.rotation.z += s.spin.z * dt;
      if (s.life <= 0) s.mesh.visible = false;
    }
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.camera.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
    for (const t of this.mats.textures) t.dispose();
    this.camera.removeFromParent();
  }
}
