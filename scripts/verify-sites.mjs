/**
 * Offline checks for every site in src/story/sites.ts and the rooms that
 * build it: the data and the geometry have to agree, every room must be
 * reachable through the device's arrangements, and every examinable object
 * must be reachable on foot and actually hit by the centre-screen ray.
 * Geometry and interaction only; it is no substitute for walking the rooms.
 */
import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

// Canvas textures need a drawing surface; these checks inspect geometry only.
const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", optimizeDeps: { noDiscovery: true }, logLevel: "error" });
try {
  const { SITES } = await server.ssrLoadModule("/src/story/sites.ts");
  const { ROOMS } = await server.ssrLoadModule("/src/engine/levels/rooms.ts");
  const { SiteLevel } = await server.ssrLoadModule("/src/engine/levels/SiteLevel.ts");
  const { Interact } = await server.ssrLoadModule("/src/engine/Interact.ts");

  for (const site of Object.values(SITES)) {
    // --- the data -------------------------------------------------------------
    for (const room of site.rooms) assert(ROOMS[room], `${site.id}: no builder for room ${room}`);
    assert(site.rooms.includes(site.start), `${site.id}: start room ${site.start} is not one of its rooms`);
    for (const config of site.configurations) {
      for (const [a, b] of config.edges) assert(site.rooms.includes(a) && site.rooms.includes(b), `${site.id}/${config.id}: unknown room in ${a} ↔ ${b}`);
    }
    // The device can show every arrangement, so the union of them must reach every room from the start.
    const reached = new Set([site.start]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const config of site.configurations) {
        for (const [a, b] of config.edges) {
          if (reached.has(a) !== reached.has(b)) {
            reached.add(a).add(b);
            grew = true;
          }
        }
      }
    }
    assert.equal(reached.size, site.rooms.length, `${site.id}: rooms unreachable through any arrangement: ${site.rooms.filter((r) => !reached.has(r))}`);
    for (const id of Object.keys(site.memories)) assert(Object.values(site.keyClues).includes(id), `${site.id}: a memory for ${id}, which is not a key clue`);

    // --- the rooms ------------------------------------------------------------
    for (const room of site.rooms) {
      const level = SiteLevel.create(room, room === site.start ? { label: site.device.name, style: site.device.style } : null);
      const section = level.section;
      level.root.updateMatrixWorld(true);
      const name = `${site.id}/${room}`;
      const key = site.keyClues[room];
      assert(section.examinables.some((e) => e.id === key), `${name}: key clue ${key} is not examinable here`);
      assert(section.exit, `${name}: no exit door`);

      // Walkable floor: flood fill from the spawn with the player's radius.
      const radius = 0.3;
      const step = 0.15;
      const free = (x, z) =>
        x > section.bounds.min.x + radius &&
        x < section.bounds.max.x - radius &&
        z > section.bounds.min.z + radius &&
        z < section.bounds.max.z - radius &&
        !section.colliders.some((b) => b.max.y > 0.18 && x >= b.min.x - radius && x <= b.max.x + radius && z >= b.min.z - radius && z <= b.max.z + radius);
      assert(free(section.spawn.x, section.spawn.z), `${name}: blocked spawn`);
      const queue = [[0, 0]];
      const seen = new Set(["0,0"]);
      const positions = [];
      for (let i = 0; i < queue.length; i++) {
        const [gx, gz] = queue[i];
        positions.push(new THREE.Vector3(section.spawn.x + gx * step, 1.6, section.spawn.z + gz * step));
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = gx + dx;
          const nz = gz + dz;
          const k = `${nx},${nz}`;
          if (!seen.has(k) && free(section.spawn.x + nx * step, section.spawn.z + nz * step)) {
            seen.add(k);
            queue.push([nx, nz]);
          }
        }
      }

      // Every target, the door and the device, through the same raycast the game uses.
      const targets = [...section.examinables, section.exit, ...(level.device ? level.device.examinables : [])];
      const interact = new Interact();
      interact.setRoots(level.raycastRoots());
      for (const t of targets) interact.register({ id: t.id, object: t.object, verb: "Examine", label: t.label, range: 2.6 });
      const camera = new THREE.PerspectiveCamera(75, 1, 0.02, 60);
      const ids = new Set();
      for (const t of targets) {
        assert(!ids.has(t.id), `${name}: duplicate examinable ${t.id}`);
        ids.add(t.id);
        assert(t === section.exit || t.text !== undefined, `${name}: ${t.id} has no text`);
        const box = new THREE.Box3().setFromObject(t.object);
        const aims = [0.25, 0.5, 0.75].map((f) => box.getCenter(new THREE.Vector3()).setY(THREE.MathUtils.lerp(box.min.y, box.max.y, f)));
        const reachable = aims.some((aim) =>
          positions.some((p) => {
            if (p.distanceTo(aim) > 3.4) return false;
            camera.position.copy(p);
            camera.lookAt(aim);
            camera.updateMatrixWorld(true);
            interact.update(camera);
            return interact.focus?.id === t.id;
          }),
        );
        assert(reachable, `${name}: cannot reach and examine ${t.id}`);
      }

      for (const port of section.ports) {
        assert(port.width >= radius * 2 + 0.1 && port.height >= 1.75, `${name}: port ${port.id} too small`);
        const approach = port.position.clone().addScaledVector(port.outward, -0.6);
        assert(positions.some((p) => Math.hypot(p.x - approach.x, p.z - approach.z) < 0.3), `${name}: cannot walk to port ${port.id}`);
      }

      let meshes = 0;
      const owned = new Set();
      level.root.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        owned.add(o.geometry);
        // Canvas textures are shared by every room for the life of the page; geometry and materials are owned.
        for (const material of [].concat(o.material)) owned.add(material);
      });
      let disposed = 0;
      for (const resource of owned) resource.addEventListener("dispose", () => disposed++);
      level.dispose();
      assert.equal(disposed, owned.size, `${name}: ${owned.size - disposed} resources not disposed`);
      console.log(`ok ${name}: ${positions.length} floor samples, ${ids.size} targets reachable, ${meshes} meshes, ${disposed} resources disposed`);
    }
    console.log(`ok ${site.id}: ${site.rooms.length} rooms, all reachable through ${site.configurations.length} arrangements`);
  }
} finally {
  await server.close();
}
