import * as THREE from "three";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";

const MAX_DECALS = 40;
const MAX_SPARKS = 96;
const PUFFS = 6;

/**
 * Bullet holes projected onto whatever was hit, plus a burst of sparks and a
 * dust puff. Everything is pooled: the oldest hole is recycled once there are
 * MAX_DECALS, so a long firefight costs no more than a short one.
 */
export class Impacts {
  readonly group = new THREE.Group();
  private decals: THREE.Mesh[] = [];
  private decalMat: THREE.MeshStandardMaterial;
  private sparks: THREE.Points;
  private sparkPos = new Float32Array(MAX_SPARKS * 3);
  private sparkCol = new Float32Array(MAX_SPARKS * 3);
  private sparkVel: THREE.Vector3[] = [];
  private sparkLife = new Float32Array(MAX_SPARKS);
  private nextSpark = 0;
  private puffs: { sprite: THREE.Sprite; life: number; dir: THREE.Vector3 }[] = [];
  private nextPuff = 0;

  constructor() {
    this.group.name = "Impacts";
    this.decalMat = new THREE.MeshStandardMaterial({
      map: holeTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      roughness: 0.9,
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.sparkPos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.sparkCol, 3));
    this.sparks = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.012, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
    );
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks);

    // Drawn once at load (a zero-area triangle) so the hole material compiles
    // then rather than stalling the first shot. Sparks and puffs start drawn,
    // black and transparent, for the same reason.
    const warm = new THREE.BufferGeometry();
    warm.setAttribute("position", new THREE.Float32BufferAttribute([0, -50, 0, 0, -50, 0, 0, -50, 0], 3));
    warm.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    warm.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    const warmMesh = new THREE.Mesh(warm, this.decalMat);
    warmMesh.frustumCulled = false;
    this.group.add(warmMesh);
    for (let i = 0; i < MAX_SPARKS; i++) this.sparkVel.push(new THREE.Vector3());

    const puffTex = puffTexture();
    for (let i = 0; i < PUFFS; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0x6e6860, transparent: true, depthWrite: false, opacity: 0 }));
      sprite.scale.setScalar(1e-4);
      this.group.add(sprite);
      this.puffs.push({ sprite, life: 0, dir: new THREE.Vector3() });
    }
  }

  /** A hit from the weapon's raycast. */
  add(hit: THREE.Intersection): void {
    const mesh = hit.object as THREE.Mesh;
    if (!mesh.isMesh || !hit.face) return;
    const normal = hit.face.normal.clone().transformDirection(mesh.matrixWorld);

    this.addDecal(mesh, hit.point, normal);

    for (let i = 0; i < 9; i++) {
      const k = this.nextSpark;
      this.nextSpark = (this.nextSpark + 1) % MAX_SPARKS;
      this.sparkPos.set([hit.point.x, hit.point.y, hit.point.z], k * 3);
      this.sparkVel[k].copy(normal).multiplyScalar(0.8 + Math.random() * 1.6).add(
        new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(1.6),
      );
      this.sparkLife[k] = 0.18 + Math.random() * 0.2;
    }

    const p = this.puffs[this.nextPuff];
    this.nextPuff = (this.nextPuff + 1) % PUFFS;
    p.life = 1;
    p.dir.copy(normal);
    p.sprite.position.copy(hit.point).addScaledVector(normal, 0.02);
  }

  private addDecal(mesh: THREE.Mesh, point: THREE.Vector3, normal: THREE.Vector3): void {
    const orient = new THREE.Euler().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(point, point.clone().add(normal), Math.abs(normal.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)),
    );
    orient.z = Math.random() * Math.PI * 2;
    const size = 0.028 + Math.random() * 0.008;
    let geo: THREE.BufferGeometry;
    try {
      geo = new DecalGeometry(mesh, point, orient, new THREE.Vector3(size, size, 0.06));
    } catch {
      return;
    }
    if (!geo.attributes.position || geo.attributes.position.count === 0) {
      geo.dispose();
      return;
    }
    const decal = new THREE.Mesh(geo, this.decalMat);
    decal.receiveShadow = true;
    this.group.add(decal);
    this.decals.push(decal);
    if (this.decals.length > MAX_DECALS) {
      const old = this.decals.shift()!;
      old.geometry.dispose();
      old.removeFromParent();
    }
  }

  /** Holes belong to the level they were shot into. */
  clear(): void {
    for (const d of this.decals) {
      d.geometry.dispose();
      d.removeFromParent();
    }
    this.decals = [];
  }

  update(dt: number): void {
    let live = false;
    for (let k = 0; k < MAX_SPARKS; k++) {
      if (this.sparkLife[k] <= 0) {
        this.sparkCol[k * 3] = this.sparkCol[k * 3 + 1] = this.sparkCol[k * 3 + 2] = 0;
        continue;
      }
      live = true;
      this.sparkLife[k] -= dt;
      const v = this.sparkVel[k];
      v.y -= 9.8 * dt;
      this.sparkPos[k * 3] += v.x * dt;
      this.sparkPos[k * 3 + 1] += v.y * dt;
      this.sparkPos[k * 3 + 2] += v.z * dt;
      const heat = Math.max(0, this.sparkLife[k]) / 0.35;
      this.sparkCol[k * 3] = 1.6 * heat;
      this.sparkCol[k * 3 + 1] = 0.9 * heat;
      this.sparkCol[k * 3 + 2] = 0.35 * heat;
    }
    if (live) {
      this.sparks.geometry.attributes.position.needsUpdate = true;
      this.sparks.geometry.attributes.color.needsUpdate = true;
    }

    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt / 0.9;
      const t = 1 - Math.max(0, p.life);
      p.sprite.position.addScaledVector(p.dir, dt * 0.12);
      p.sprite.scale.setScalar(0.04 + t * 0.16);
      (p.sprite.material as THREE.SpriteMaterial).opacity = 0.55 * (1 - t) * Math.min(1, t * 8);
      if (p.life <= 0) p.sprite.scale.setScalar(1e-4);
    }
  }

  dispose(): void {
    for (const d of this.decals) d.geometry.dispose();
    this.decalMat.map?.dispose();
    this.decalMat.dispose();
    this.sparks.geometry.dispose();
    (this.sparks.material as THREE.Material).dispose();
    for (const p of this.puffs) {
      p.sprite.material.map?.dispose();
      p.sprite.material.dispose();
    }
    this.group.removeFromParent();
  }
}

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d")!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A dark hole with a scorched, cracked ring, on transparency. */
function holeTexture(): THREE.CanvasTexture {
  return canvasTexture(128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.16, "rgba(5,4,3,1)");
    g.addColorStop(0.24, "rgba(40,32,26,0.9)");
    g.addColorStop(0.5, "rgba(30,24,20,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "rgba(10,8,6,0.7)";
    let seed = 3;
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2;
      ctx.lineWidth = 1 + rand() * 1.5;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(a) * 12, 64 + Math.sin(a) * 12);
      ctx.lineTo(64 + Math.cos(a + (rand() - 0.5) * 0.4) * (26 + rand() * 20), 64 + Math.sin(a + (rand() - 0.5) * 0.4) * (26 + rand() * 20));
      ctx.stroke();
    }
  });
}

function puffTexture(): THREE.CanvasTexture {
  return canvasTexture(64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.5, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}
