/**
 * HorrorRoom.jsx - React Three Fiber components for horror_room.glb
 *
 *   <Canvas shadows="percentage" camera={{ position: [0.55, 1.55, 2.35], fov: 50 }}>
 *     <HorrorAtmosphere />
 *     <Suspense fallback={null}>
 *       <HorrorRoom flicker doorOpen={open}>
 *         <Character url="/models/your_character.glb" />
 *       </HorrorRoom>
 *     </Suspense>
 *     <HorrorEffects />
 *   </Canvas>
 *
 * Anything you put inside <HorrorRoom> is placed on the room's CharacterSpawn node
 * (centre of the rug, feet on the floor, facing the default camera).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { EffectComposer, N8AO, Bloom, Noise, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

const NO_SHADOW_MATS = new Set(["M_WindowGlass", "M_NightSky", "M_Void", "M_BulbGlass"]);

function findLight(root, name) {
  const o = root.getObjectByName(name);
  if (!o) return null;
  if (o.isLight) return o;
  let l = null;
  o.traverse((c) => { if (!l && c.isLight) l = c; });
  return l;
}

/** Flicker pattern: steady mains buzz, random stutters, occasional blackouts. */
function useFlicker(enabled) {
  const s = useRef({ next: 3, end: 0, kind: "" });
  return (t) => {
    if (!enabled) return 1;
    const f = s.current;
    if (t > f.next) {
      f.kind = Math.random() < 0.22 ? "out" : "stutter";
      f.end = t + (f.kind === "out" ? 0.8 + Math.random() * 1.2 : 0.35 + Math.random() * 0.5);
      f.next = f.end + 3 + Math.random() * 7;
    }
    if (t < f.end) return f.kind === "out" ? 0.02 : Math.sin(t * 90) > 0.2 ? 1 : 0.08;
    return 0.94 + 0.06 * Math.sin(t * 50) * Math.sin(t * 13.7);
  };
}

export function HorrorRoom({ url = "/models/horror_room.glb", flicker = true, doorOpen = false, shadowMapSize = 1024, children, ...props }) {
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, scene);
  const level = useFlicker(flicker);

  const rig = useMemo(() => {
    let bulbMat = null;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = [].concat(o.material);
      mats.forEach((m) => { m.shadowSide = THREE.DoubleSide; if (m.name === "M_BulbGlass") bulbMat = m; });
      o.receiveShadow = true;
      o.castShadow = !mats.some((m) => NO_SHADOW_MATS.has(m.name)) && !/Hanging_Bulb/.test(o.name + (o.parent?.name || ""));
    });
    const bulb = findLight(scene, "Light_Bulb");
    const moon = findLight(scene, "Light_Moon");
    for (const [l, bias] of [[bulb, -0.002], [moon, -0.0008]]) {
      if (!l) continue;
      l.castShadow = true;
      l.shadow.mapSize.set(shadowMapSize, shadowMapSize);
      l.shadow.bias = bias;
      l.shadow.normalBias = 0.02;
    }
    const spawn = scene.getObjectByName("CharacterSpawn");
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    if (spawn) { spawn.updateWorldMatrix(true, false); spawn.getWorldPosition(pos); spawn.getWorldQuaternion(quat); }
    return { bulb, bulbBase: bulb?.intensity ?? 1, bulbMat, bulbEmissive: bulbMat?.emissiveIntensity ?? 1, pos, quat };
  }, [scene, shadowMapSize]);

  useFrame(({ clock }) => {
    const lvl = level(clock.elapsedTime);
    if (rig.bulb) rig.bulb.intensity = rig.bulbBase * lvl;
    if (rig.bulbMat) rig.bulbMat.emissiveIntensity = rig.bulbEmissive * lvl;
  });

  useEffect(() => {
    const a = actions.Door_Creak;
    if (!a) return;
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.paused = false;
    a.timeScale = doorOpen ? 1 : -1.6;
    if (doorOpen && a.time >= a.getClip().duration) a.time = 0;
    a.play();
  }, [doorOpen, actions]);

  return (
    <group {...props}>
      <primitive object={scene} />
      <group position={rig.pos} quaternion={rig.quat}>{children}</group>
    </group>
  );
}

/**
 * Character: loads any glTF/GLB, puts its feet on the floor, centres it, and plays a clip.
 * clip: name or index. Defaults to the first clip whose name looks like an idle.
 * targetHeight: auto-scales models that are far off real-world size (e.g. cm-unit FBX exports).
 */
export function Character({ url, clip, targetHeight = 1.75, rotationY = 0, onLoaded }) {
  const gltf = useGLTF(url);
  const model = useMemo(() => cloneSkinned(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, model);
  const [fit, setFit] = useState({ scale: 1, offset: [0, 0, 0] });

  useEffect(() => {
    model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      if (o.isSkinnedMesh) o.frustumCulled = false;
    });
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const s = targetHeight && (size.y < 1.2 || size.y > 2.6) ? targetHeight / size.y : 1;
    setFit({ scale: s, offset: [-c.x * s, -box.min.y * s, -c.z * s] });
    onLoaded?.({ height: size.y, scale: s, clips: names });
  }, [model, targetHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!names.length) return;
    const name = typeof clip === "number" ? names[clip] : clip ?? names.find((n) => /idle|breath|stand/i.test(n)) ?? names[0];
    const a = actions[name];
    a?.reset().fadeIn(0.3).play();
    return () => { a?.fadeOut(0.3); };
  }, [clip, names, actions]);

  return (
    <group rotation-y={rotationY}>
      <primitive object={model} position={fit.offset} scale={fit.scale} />
    </group>
  );
}

/** Background, fog, a faint cold fill, and drifting dust lit by the bulb. */
export function HorrorAtmosphere({ fogDensity = 0.075, dust = 900 }) {
  return (
    <>
      <color attach="background" args={["#030304"]} />
      <fogExp2 attach="fog" args={["#040406", fogDensity]} />
      <hemisphereLight args={["#3a4866", "#1a110a", 1.3]} />
      {dust > 0 && <Dust count={dust} />}
    </>
  );
}

function Dust({ count }) {
  const mat = useRef();
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos.set([(Math.random() - 0.5) * 5.4, Math.random() * 2.9, (Math.random() - 0.5) * 5.4], i * 3);
      seed[i] = Math.random() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);
  useFrame(({ clock }) => { if (mat.current) mat.current.uniforms.t.value = clock.elapsedTime; });
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ t: { value: 0 }, bulb: { value: new THREE.Vector3(0, 2.1, 0.3) } }}
        vertexShader={`attribute float seed; uniform float t; uniform vec3 bulb; varying float a;
          void main(){ vec3 p = position;
            p.x += sin(t*0.13 + seed)*0.25; p.z += cos(t*0.11 + seed*1.3)*0.25; p.y = mod(p.y + t*0.02 + sin(seed)*0.1, 2.9);
            vec4 mv = modelViewMatrix * vec4(p,1.0); a = smoothstep(2.4, 0.2, distance(p, bulb));
            gl_PointSize = min(5.0, (1.0 + fract(seed)*1.6) * (3.0 / -mv.z) * 1.5); gl_Position = projectionMatrix * mv; }`}
        fragmentShader={`varying float a; void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
          gl_FragColor = vec4(vec3(1.0, 0.8, 0.6) * a * 0.5 * smoothstep(0.5, 0.1, r), 1.0); }`}
      />
    </points>
  );
}

/** Ambient occlusion, bulb bloom, film grain, vignette, filmic tone mapping. */
export function HorrorEffects({ ao = true }) {
  return (
    <EffectComposer multisampling={0}>
      {ao ? <N8AO aoRadius={0.35} intensity={2.2} distanceFalloff={0.6} halfRes /> : <></>}
      <Bloom intensity={0.35} luminanceThreshold={0.9} luminanceSmoothing={0.2} mipmapBlur />
      <Noise opacity={0.05} />
      <Vignette offset={0.25} darkness={0.85} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

useGLTF.preload("/models/horror_room.glb");
