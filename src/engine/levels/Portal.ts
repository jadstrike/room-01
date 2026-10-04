import * as THREE from "three";

/**
 * What is behind a site's exit door: not a hallway but the fold the entity
 * makes, a slow swirl of dark red that brightens as the door opens. It sits
 * in the doorway behind the shut door from the start, so its shader is
 * compiled with the room behind the loading screen rather than on first use.
 */
export class Portal {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(width: number, height: number) {
    this.material = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, open: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float t, open; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec2 c = (vUv - 0.5) * vec2(1.0, 1.9);
          float r = length(c), a = atan(c.y, c.x);
          // A spiral pulled inward, with noise riding it so it never repeats.
          float swirl = a * 2.0 + r * 9.0 - t * 1.6;
          float v = n(vec2(cos(swirl), sin(swirl)) * 2.2 + r * 3.0 - t * 0.4) * (0.6 + 0.4 * sin(swirl * 3.0));
          float core = smoothstep(0.9, 0.0, r);
          vec3 deep = vec3(0.02, 0.0, 0.03);
          vec3 blood = vec3(0.55, 0.05, 0.07);
          vec3 pale = vec3(1.0, 0.75, 0.7);
          vec3 col = mix(deep, blood, v * core);
          col += pale * pow(v * core, 3.0) * 1.6 * open;
          col *= 0.35 + 0.65 * open;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.material);
    this.mesh.name = "Portal";
  }

  update(t: number, open: number): void {
    this.material.uniforms.t.value = t;
    this.material.uniforms.open.value = open;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}
