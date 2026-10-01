import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';

const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
const saves = new Map();
globalThis.localStorage = { getItem: k => saves.get(k) ?? null, setItem: (k,v) => saves.set(k,v) };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { HouseRun, KEY_CLUES, CONFIGURATIONS, parseHouseSave, SAVE_KEY } = await server.ssrLoadModule('/src/engine/house/HouseRun.ts');
  const { Engine, INITIAL_STATE } = await server.ssrLoadModule('/src/engine/Engine.ts');
  const { Store } = await server.ssrLoadModule('/src/engine/store.ts');
  const { Interact } = await server.ssrLoadModule('/src/engine/Interact.ts');
  // Use the real house coordinator and real room meshes with a headless player.
  const engine = Object.create(Engine.prototype);
  Object.assign(engine, { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(75,1,.02,60),
    houseRun: new HouseRun(), houseSection: null, houseDevice: null, room: null,
    store: new Store(INITIAL_STATE), interact: new Interact(), unregister: [], debugGroup: new THREE.Group(),
    dust: { setBulbPosition() {} }, player: { position: new THREE.Vector3(), locked: true,
      setBounds() {}, setColliders() {}, setConfinement() {}, releaseLock() {},
      spawnAt(p) { this.position.copy(p); } } });
  engine.enterHouseRoom();
  assert.equal(engine.location, 'living-room');
  engine.travelHouse('study'); assert.equal(engine.location,'living-room');
  engine.openHousePanel('device'); assert.equal(engine.store.get().housePanel,null);

  function aimAndUse(id) {
    const section = engine.houseSection;
    section.root.updateMatrixWorld(true); engine.houseDevice.root.updateMatrixWorld(true);
    const target = id === 'house:device' ? engine.houseDevice.interactions[0] : section.interactions.find(e => e.id === id);
    assert(target, `Missing target ${id}`);
    const bounds = new THREE.Box3().setFromObject(target.object), centre = bounds.getCenter(new THREE.Vector3());
    const free = (x,z) => x > section.bounds.min.x+.3 && x < section.bounds.max.x-.3 && z > section.bounds.min.z+.3 && z < section.bounds.max.z-.3
      && !section.colliders.some(b => b.max.y > .18 && x >= b.min.x-.3 && x <= b.max.x+.3 && z >= b.min.z-.3 && z <= b.max.z+.3);
    const queue = [[0,0]], seen = new Set(['0,0']);
    for (let i=0;i<queue.length;i++) {
      const [gx,gz]=queue[i],x=section.spawn.x+gx*.15,z=section.spawn.z+gz*.15;
      for(const f of [.25,.5,.75]) {
        engine.camera.position.set(x,1.6,z);engine.camera.lookAt(centre.clone().setY(THREE.MathUtils.lerp(bounds.min.y,bounds.max.y,f)));engine.camera.updateMatrixWorld(true);
        engine.interact.update(engine.camera);
        if(engine.interact.focus?.id===id) { engine.player.position.set(x,0,z); assert(engine.interact.trigger()); return; }
      }
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {const nx=gx+dx,nz=gz+dz,key=`${nx},${nz}`;if(!seen.has(key)&&free(section.spawn.x+nx*.15,section.spawn.z+nz*.15)){seen.add(key);queue.push([nx,nz]);}}
    }
    assert.fail(`Cannot inspect ${id} from reachable floor`);
  }
  function clue() {
    const id=KEY_CLUES[engine.location]; aimAndUse(id);
    assert.equal(engine.store.get().housePanel,'inspection');
    assert(engine.store.get().inspection.observation.length>10);
    engine.recallEvidence();engine.collectEvidence();engine.collectEvidence();
    assert.equal(engine.houseRun.state.journal.filter(e=>e.id===id).length,1);
    assert(engine.houseRun.state.journal.find(e=>e.id===id).memory);
    engine.closeHousePanel();
  }
  function travel(to) {
    const door=engine.houseSection.interactions.find(e=>/door/i.test(e.object.name));aimAndUse(door.id);
    assert.equal(engine.store.get().housePanel,'passage');
    // Disposal is essential when revisiting configurations repeatedly.
    let disposed=0; const resources=new Set();
    for(const root of [engine.houseSection.root,engine.houseDevice.root]) root.traverse(o=>{if(o.isMesh){resources.add(o.geometry);for(const m of [].concat(o.material)){resources.add(m);if(m.map)resources.add(m.map);}}});
    for(const r of resources) r.addEventListener('dispose',()=>disposed++);
    engine.travelHouse(to); assert.equal(engine.location,to);assert.equal(disposed,resources.size);
  }
  clue(); aimAndUse('house:device'); assert(engine.houseRun.state.device);
  engine.closeHousePanel(); travel('kitchen');clue();travel('utility-room');clue();
  engine.openHousePanel('device');engine.shiftHouse();assert.equal(engine.houseRun.exits.length,0);
  engine.restoreHouse(0);engine.closeHousePanel();travel('kitchen');travel('living-room');
  engine.openHousePanel('device');engine.restoreHouse(1);engine.closeHousePanel();travel('bedroom');clue();travel('basement');clue();
  engine.openHousePanel('device');engine.shiftHouse();engine.closeHousePanel();travel('study');clue();
  assert.equal(engine.houseRun.clueCount,6);assert.equal(engine.houseRun.state.visited.length,6);assert(!engine.houseRun.complete);
  travel('utility-room');engine.openHousePanel('device');engine.restoreHouse(0);engine.closeHousePanel();travel('kitchen');travel('living-room');
  assert(engine.houseRun.complete);
  const persisted = parseHouseSave(saves.get(SAVE_KEY)); assert(new HouseRun(persisted).complete);
  engine.player.position.set(2,0,-2);engine.openHousePanel('passage');assert.equal(engine.store.get().housePanel,null);
  const run=new HouseRun();assert(!run.shift());assert(!run.restore(2));assert(!run.travel('study'));
  run.acquireDevice(); assert(run.shift());assert(run.shift());assert(!run.shift());assert(!run.restore(9));
  for(const cfg of CONFIGURATIONS) for(const [a,b] of cfg.edges){run.state={...run.state,configuration:CONFIGURATIONS.indexOf(cfg),room:a};assert(run.travel(b));assert(run.travel(a));assert(!run.travel('room01'));}
  for(const raw of ['bad','{}',JSON.stringify({...persisted,configuration:99}),JSON.stringify({...persisted,history:[0,2]})]) assert.equal(parseHouseSave(raw).room,'living-room');
  const first=engine.houseSection;engine.restartHouse();assert.notEqual(first,engine.houseSection);assert.equal(engine.houseRun.clueCount,0);assert(!engine.houseRun.state.device);
  engine.houseSection.dispose();engine.houseDevice.dispose();
  console.log('PASS: real-room raycast inspections, recall/journal deduplication, gated travel, isolation recovery, all six clues/rooms, saved resume, restart and disposal across the full playthrough.');
} finally { await server.close(); }
