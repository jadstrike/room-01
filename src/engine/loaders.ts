import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

/**
 * The room GLB uses EXT_meshopt_compression + EXT_texture_webp +
 * KHR_mesh_quantization, so the meshopt decoder is mandatory - a plain
 * GLTFLoader cannot open it. DRACO is wired up for dropped-in user models.
 */
const DRACO_PATH = "https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/libs/draco/gltf/";
const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);

export function makeLoader(manager?: THREE.LoadingManager): GLTFLoader {
  const loader = new GLTFLoader(manager);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

export function loadGLB(url: string): Promise<GLTF> {
  return makeLoader().loadAsync(url);
}

/**
 * Loads a .gltf together with the sibling .bin / texture files the user picked,
 * by resolving every relative request against a bare-filename to blob-URL map.
 */
export function loadFromFileMap(mainUrl: string, files: Map<string, string>): Promise<GLTF> {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    const name = decodeURIComponent(url.split("/").pop()!.split("?")[0]);
    return files.get(name) ?? url;
  });
  return makeLoader(manager).loadAsync(mainUrl);
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    for (const m of ([] as THREE.Material[]).concat(mesh.material as THREE.Material)) m?.dispose();
  });
}
