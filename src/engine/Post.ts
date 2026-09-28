import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ViewmodelPass } from "./Viewmodel";

/**
 * Render -> GTAO -> viewmodel -> bloom -> film -> output. Order matters:
 * OutputPass must stay last (it does the tone-map / colour-space conversion),
 * and the viewmodel goes after GTAO so the world's ambient occlusion is not
 * smeared onto the gun. The "quality" toggle disables GTAO + film only, so
 * keep expensive passes behind it.
 */
export class Post {
  readonly composer: EffectComposer;
  private gtao: GTAOPass;
  private film: ShaderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.gtao = new GTAOPass(scene, camera, 1, 1);
    this.gtao.blendIntensity = 0.85;
    this.gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 1.2, scale: 1.0 });
    this.composer.addPass(this.gtao);

    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.5, 0.9));

    this.film = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, t: { value: 0 }, amount: { value: 1 }, hurt: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D tDiffuse; uniform float t, amount, hurt; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + t*7.0) * 43758.5453); }
        void main(){
          vec2 c = vUv - 0.5; float d = dot(c,c);
          vec2 off = c * d * (0.012 + hurt * 0.05) * amount;                 // slight lens fringe at edges
          vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
          col *= mix(1.0, smoothstep(0.85, 0.12, d), 0.85);                  // vignette
          col = mix(col, col * vec3(1.4, 0.35, 0.3), hurt * smoothstep(0.1, 0.5, d));
          col += (h(vUv*vec2(1920.0,1080.0)) - 0.5) * 0.035 * amount;        // film grain
          gl_FragColor = vec4(col, 1.0); }`,
    });
    this.composer.addPass(this.film);
    this.composer.addPass(new OutputPass());
  }

  /** Draws the first-person gun over the world, before bloom and grain. */
  addViewmodel(scene: THREE.Scene, camera: THREE.Camera): void {
    this.composer.insertPass(new ViewmodelPass(scene, camera), 2);
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  /** false drops GTAO + the film pass: the performance escape hatch. */
  setQuality(on: boolean): void {
    this.gtao.enabled = on;
    this.film.enabled = on;
  }

  /** 0..1 red-out, for the game layer to use on damage / anomaly events. */
  setHurt(v: number): void {
    this.film.uniforms.hurt.value = v;
  }

  render(t: number, dt: number): void {
    this.film.uniforms.t.value = t;
    this.composer.render(dt);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
