import * as THREE from "three";
import { ProceduralSection } from "./ProceduralSection";

/** Suspicious household objects invite an accusation without confirming it. */
export class Basement extends ProceduralSection {
  readonly bounds = new THREE.Box3(new THREE.Vector3(-3.2, 0, -3), new THREE.Vector3(3.2, 2.8, 3));
  readonly dustOrigin = new THREE.Vector3(0, 2.3, -0.5);
  readonly spawn = new THREE.Vector3(0, 0, 2.25);
  readonly lookAt = new THREE.Vector3(-1.2, 1, -1.7);
  readonly ports = [{ id: "hall", position: new THREE.Vector3(0, 0, 3), outward: new THREE.Vector3(0, 0, 1), width: 1.2, height: 2.2 }];

  constructor(message: (text: string) => void) {
    super("basement", message);
    this.root.name = "House_Basement";
    const concrete = this.material(0x777b75, this.texture("plaster"));
    const wood = this.material(0x67503a, this.texture("wood"));
    const steel = this.material(0x444b4c, undefined, 0.65);
    const dark = this.material(0x202824);
    const cloth = this.material(0x53604b, this.texture("fabric"));
    const paper = this.material(0xcbbd95);
    const rust = this.material(0x734635);
    const box = this.box.bind(this);
    const group = this.group.bind(this);
    const inspect = this.inspect.bind(this);

    box("Concrete_Floor", 0, -0.06, 0, 6.6, 0.12, 6.2, concrete);
    box("Low_Ceiling", 0, 2.86, 0, 6.6, 0.12, 6.2, concrete);
    for (const x of [-3.3, 3.3]) box("Foundation_Wall", x, 1.4, 0, 0.2, 2.8, 6.2, concrete, true);
    box("Back_Wall", 0, 1.4, -3.1, 6.6, 2.8, 0.2, concrete, true);
    for (const x of [-1.9, 1.9]) box("Entry_Wall", x, 1.4, 3.1, 2.6, 2.8, 0.2, concrete, true);
    box("Entry_Lintel", 0, 2.5, 3.1, 1.2, 0.6, 0.2, concrete, true);
    const door = group("Cellar_Door");
    door.add(box("Door", 0, 1.1, 2.99, 1.18, 2.2, 0.08, wood, true));
    door.add(box("Handle", -0.43, 1, 2.9, 0.14, 0.04, 0.08, steel));
    inspect(door, "the cellar door", "A cold draught comes from the stairwell beyond. The latch catches against an old, uneven frame.");
    for (const z of [-2, 0, 2]) box("Ceiling_Joist", 0, 2.7, z, 6.4, 0.18, 0.16, wood);
    for (const x of [2.65, 2.87]) {
      const pipe = this.cylinder("Overhead_Pipe", x, 2.55, 0, 0.045, 5.8, steel); pipe.rotation.x = Math.PI / 2;
    }
    for (let row = 0; row < 6; row++) {
      box("Mortar_Line", 0, 0.2 + row * 0.43, -2.993, 6.4, 0.015, 0.008, dark);
      for (let col = 0; col < 7; col++) box("Mortar_Joint", -3 + col + (row % 2) * 0.4, 0.41 + row * 0.43, -2.992, 0.014, 0.42, 0.008, dark);
    }

    box("Workbench_Top", -1.65, 0.94, -2.35, 2.6, 0.13, 0.85, wood, true);
    for (const x of [-2.75, -0.55]) for (const z of [-2.65, -2.06]) box("Bench_Leg", x, 0.44, z, 0.12, 0.88, 0.12, steel, true);
    // Display prop only: authored and disposed with the room like other evidence.
    const rifle = group("Hunting_Rifle");
    rifle.add(box("Rifle_Stock", -2.32, 1.08, -2.25, 0.47, 0.16, 0.11, wood));
    rifle.add(box("Rifle_Grip", -2.03, 1.055, -2.25, 0.2, 0.09, 0.085, wood));
    rifle.add(box("Rifle_Receiver", -1.83, 1.1, -2.25, 0.28, 0.08, 0.09, steel));
    rifle.add(box("Rifle_Forestock", -1.57, 1.065, -2.25, 0.35, 0.08, 0.09, wood));
    const barrel = this.cylinder("Rifle_Barrel", -1.32, 1.12, -2.25, 0.025, 0.71, steel); barrel.rotation.z = Math.PI / 2; rifle.add(barrel);
    const scope = this.cylinder("Rifle_Scope", -1.82, 1.23, -2.25, 0.038, 0.3, dark); scope.rotation.z = Math.PI / 2; rifle.add(scope);
    rifle.add(box("Scope_Mount", -1.82, 1.17, -2.25, 0.12, 0.06, 0.04, steel));
    rifle.add(box("Trigger_Guard", -1.95, 1.015, -2.25, 0.14, 0.025, 0.06, steel));
    inspect(rifle, "the hunting rifle", "A hunting rifle rests on the bench. Rowan remembers her boyfriend carrying this case. A dusty hunting-club tag hangs from it; nothing here tells you when the rifle was last used.");
    box("Rifle_Case", -1.75, 0.17, -2.36, 1.9, 0.25, 0.38, cloth);
    box("Case_Tag", -1.15, 0.305, -2.3, 0.2, 0.012, 0.13, paper);

    const note = group("Torn_Note");
    note.add(box("Note_Paper", -0.63, 1.013, -2.27, 0.31, 0.016, 0.4, paper));
    for (let i = 0; i < 5; i++) note.add(box("Note_Ink", -0.63, 1.023, -2.4 + i * 0.055, 0.22 - (i % 2) * 0.04, 0.003, 0.009, dark));
    inspect(note, "the torn note", "“We need to finish this tonight.” Rowan thinks he recognises the boyfriend's handwriting. The rest is torn away. Beneath it, a repair list mentions the cellar latch and a leaking pipe.");

    const coat = group("Stained_Coat");
    box("Coat_Hook", -3.08, 1.94, -0.4, 0.16, 0.05, 0.05, steel);
    coat.add(box("Coat_Body", -3.03, 1.37, -0.4, 0.17, 0.94, 0.55, cloth));
    for (const z of [-0.76, -0.04]) coat.add(box("Coat_Sleeve", -3.01, 1.43, z, 0.17, 0.7, 0.2, cloth));
    for (let i = 0; i < 4; i++) coat.add(box("Coat_Stain", -2.935, 1.05 + i * 0.12, -0.56 + (i % 2) * 0.17, 0.015, 0.11, 0.13, rust));
    inspect(coat, "the stained coat", "His work coat. The reddish-brown marks look alarming in this light, but they are dry and flaky. An open tin of wood stain sits nearby. Colour alone proves nothing.");
    const tin = this.cylinder("Wood_Stain_Tin", -2.8, 0.17, 0.25, 0.14, 0.34, rust);
    box("Tin_Label", -2.652, 0.18, 0.25, 0.008, 0.15, 0.16, paper);
    inspect(tin, "the wood-stain tin", "The label reads ‘Walnut wood stain’. Dried drips run down the tin, the same rusty colour as the marks on the coat.");

    const tools = group("Repair_Tools");
    tools.add(box("Toolbox", 2.43, 0.3, 1.2, 0.85, 0.6, 0.5, rust, true));
    tools.add(box("Toolbox_Handle", 2.43, 0.65, 1.2, 0.28, 0.1, 0.04, steel));
    tools.add(box("Hammer_Handle", 2.34, 0.055, 0.65, 0.49, 0.055, 0.055, wood));
    tools.add(box("Hammer_Head", 2.08, 0.06, 0.65, 0.12, 0.1, 0.22, steel));
    inspect(tools, "the toolbox and hammer", "A heavy hammer lies beside his toolbox. Fine wood shavings cling to its handle. The replacement latch inside matches the repair list on the bench.");

    const shelf = group("Storage_Shelves");
    for (const x of [1.42, 2.9]) for (const z of [-2.75, -2.1]) shelf.add(box("Shelf_Upright", x, 1.02, z, 0.08, 2.04, 0.08, steel));
    for (const y of [0.18, 0.88, 1.58]) shelf.add(box("Shelf", 2.16, y, -2.43, 1.6, 0.08, 0.76, wood));
    this.colliders.push(new THREE.Box3(new THREE.Vector3(1.36, 0, -2.82), new THREE.Vector3(2.96, 2.06, -2.02)));
    for (let i = 0; i < 5; i++) shelf.add(box("Storage_Box", 1.78 + (i % 2) * 0.72, 0.4 + Math.floor(i / 2) * 0.7, -2.42, 0.55, 0.35, 0.51, wood));
    inspect(shelf, "the storage shelves", "Old camping supplies and repair materials share the shelves. A faded photograph shows several people on a hunting trip. The rifle belongs to a life outside this room, too.");
    const boots = group("Muddy_Boots");
    for (const x of [1.28, 1.61]) {
      boots.add(box("Boot_Foot", x, 0.1, -0.7, 0.23, 0.2, 0.46, dark));
      boots.add(box("Boot_Ankle", x, 0.27, -0.84, 0.21, 0.28, 0.2, dark));
    }
    inspect(boots, "the muddy boots", "Mud cakes the boyfriend's boots. Rowan remembers rain that evening. The soil could have come from the garden or the path outside; it cannot place him in the bedroom.");

    const warm = new THREE.PointLight(0xffcf92, 17, 10, 2); warm.position.copy(this.dustOrigin); warm.castShadow = true;
    warm.shadow.mapSize.set(1024, 1024); warm.shadow.bias = -0.001; warm.shadow.normalBias = 0.035; this.root.add(warm);
    this.cylinder("Lamp_Cord", 0, 2.59, -0.5, 0.012, 0.36, dark);
    this.cylinder("Lamp_Shade", 0, 2.43, -0.5, 0.18, 0.12, steel);
    box("High_Window", 0.6, 2.25, -2.97, 1.2, 0.43, 0.035, this.material(0x596c79));
    for (const x of [0, 0.6, 1.2]) box("Window_Bar", x, 2.25, -2.92, 0.035, 0.48, 0.05, steel);
    const cool = new THREE.PointLight(0x8daabd, 5, 5, 2); cool.position.set(0.6, 2.15, -2.7); this.root.add(cool);
  }
}
