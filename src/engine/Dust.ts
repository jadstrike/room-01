import * as THREE from "three";

/** Additive point motes that catch the bulb light. Ported from the Room 01 viewer. */
export class Dust {
  readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;

  constructor(count = 900, spread = 5.4, height = 2.9) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = Math.random() * height;
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread;
      seed[i] = Math.random() * 100;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("seed", new THREE.BufferAttribute(seed, 1));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        t: { value: 0 },
        bulb: { value: new THREE.Vector3(0, 2.1, 0.3) },
        glow: { value: 1 },
        ceil: { value: height },
      },
      vertexShader: `attribute float seed; uniform float t, ceil; uniform vec3 bulb; varying float a;
        void main(){ vec3 p = position;
          p.x += sin(t*0.13 + seed)*0.25; p.z += cos(t*0.11 + seed*1.3)*0.25; p.y = mod(p.y + t*0.02 + sin(seed)*0.1, ceil);
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          float d = distance(p, bulb); a = smoothstep(2.4, 0.2, d);
          gl_PointSize = min(5.0, (1.0 + fract(seed)*1.6) * (3.0 / -mv.z) * 1.5); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float a; uniform float glow;
        void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
          gl_FragColor = vec4(vec3(1.0, 0.8, 0.6) * a * glow * 0.5 * smoothstep(0.5, 0.1, r), 1.0); }`,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  /** Anchor the motes' glow on the real bulb position once the room is loaded. */
  setBulbPosition(p: THREE.Vector3): void {
    (this.material.uniforms.bulb.value as THREE.Vector3).copy(p);
  }

  update(t: number, glow: number): void {
    this.material.uniforms.t.value = t;
    this.material.uniforms.glow.value = glow;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
