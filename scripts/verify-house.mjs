/** Geometry/interaction checks, not a substitute for a rendered walkthrough. */
import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

// Canvas textures need a drawing surface; these tests inspect geometry only.
const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const { Kitchen } = await server.ssrLoadModule("/src/engine/house/Kitchen.ts");
  const { LivingRoom } = await server.ssrLoadModule("/src/engine/house/LivingRoom.ts");
  const { Bedroom } = await server.ssrLoadModule("/src/engine/house/Bedroom.ts");
  const { Basement } = await server.ssrLoadModule("/src/engine/house/Basement.ts");
  const { Interact } = await server.ssrLoadModule("/src/engine/Interact.ts");
  const { locationFromSearch } = await server.ssrLoadModule("/src/engine/house/locations.ts");
  assert.equal(locationFromSearch("?section=living-room"), "living-room");
  assert.equal(locationFromSearch("?section=kitchen"), "kitchen");
  assert.equal(locationFromSearch("?section=basement"), "basement");
  assert.equal(locationFromSearch("?section=unknown"), "room01");
  for (const Section of [Kitchen, LivingRoom, Bedroom, Basement]) {
    let message = "";
    const section = new Section(text => { message = text; });
    section.root.updateMatrixWorld(true);
    const radius = 0.3, step = 0.15;
    const free = (x, z) => x > section.bounds.min.x + radius && x < section.bounds.max.x - radius
      && z > section.bounds.min.z + radius && z < section.bounds.max.z - radius
      && !section.colliders.some(b => b.max.y > 0.18 && x >= b.min.x - radius && x <= b.max.x + radius && z >= b.min.z - radius && z <= b.max.z + radius);
    assert(free(section.spawn.x, section.spawn.z), `${Section.name}: blocked spawn`);
    const queue = [[0, 0]], seen = new Set(["0,0"]), positions = [];
    for (let i = 0; i < queue.length; i++) {
      const [gx, gz] = queue[i];
      const x = section.spawn.x + gx * step, z = section.spawn.z + gz * step;
      positions.push(new THREE.Vector3(x, 1.6, z));
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = gx + dx, nz = gz + dz, key = `${nx},${nz}`;
        if (!seen.has(key) && free(section.spawn.x + nx * step, section.spawn.z + nz * step)) { seen.add(key); queue.push([nx, nz]); }
      }
    }
    const interact = new Interact();
    interact.setRoots([section.root]);
    section.interactions.forEach(item => interact.register(item));
    const camera = new THREE.PerspectiveCamera(75, 1, 0.02, 60);
    const ids = new Set();
    for (const item of section.interactions) {
      assert(!ids.has(item.id), `Duplicate interaction ${item.id}`); ids.add(item.id);
      const box = new THREE.Box3().setFromObject(item.object);
      const targets = [0.25, 0.5, 0.75].map(y => box.getCenter(new THREE.Vector3()).setY(THREE.MathUtils.lerp(box.min.y, box.max.y, y)));
      const reachable = targets.some(target => positions.some(position => {
        if (position.distanceTo(target) > (item.range ?? 2.4) + 0.8) return false;
        camera.position.copy(position); camera.lookAt(target); camera.updateMatrixWorld(true);
        interact.update(camera);
        return interact.focus?.id === item.id;
      }));
      assert(reachable, `${Section.name}: cannot reach and inspect ${item.id}`);
      message = ""; assert(interact.trigger()); assert(message.length > 0);
    }
    for (const port of section.ports) {
      assert(port.width >= radius * 2 + 0.1 && port.height >= 1.75);
      const approach = port.position.clone().addScaledVector(port.outward, -0.6);
      assert(positions.some(p => Math.hypot(p.x - approach.x, p.z - approach.z) < 0.3), `${Section.name}: inaccessible port ${port.id}`);
    }
    const resources = new Set();
    section.root.traverse(o => {
      if (!o.isMesh) return;
      resources.add(o.geometry);
      for (const mat of [].concat(o.material)) { resources.add(mat); if (mat.map) resources.add(mat.map); }
    });
    let disposed = 0;
    for (const resource of resources) resource.addEventListener("dispose", () => disposed++);
    section.dispose();
    assert.equal(disposed, resources.size, `${Section.name}: resource disposal mismatch`);
    console.log(`ok ${Section.name}: ${positions.length} reachable floor samples, ${ids.size} inspectable targets, ports accessible, ${disposed} resources disposed`);
  }
} finally { await server.close(); }
