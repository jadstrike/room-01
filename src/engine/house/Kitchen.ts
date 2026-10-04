import * as THREE from "three";
import { ProceduralSection } from "./ProceduralSection";

/** All measurements are local metres. Instantiate once per placed house section. */
export class Kitchen extends ProceduralSection {
  readonly bounds = new THREE.Box3(new THREE.Vector3(-3, 0, -2.5), new THREE.Vector3(3, 3, 2.5));
  readonly dustOrigin = new THREE.Vector3(0, 2.35, -0.4);
  readonly spawn = new THREE.Vector3(0, 0, 1.8);
  readonly lookAt = new THREE.Vector3(-0.6, 1.2, -1.8);
  readonly ports = [{ id: "hall", position: new THREE.Vector3(0, 0, 2.5), outward: new THREE.Vector3(0, 0, 1), width: 1.2, height: 2.2 }];
  constructor() {
    super("kitchen");
    this.root.name = "House_Kitchen";
    const plaster = this.material(0x8c8370, this.texture("plaster"));
    const green = this.material(0x465850, this.texture("plaster"));
    const wood = this.material(0x65503a, this.texture("wood"));
    const dark = this.material(0x222421);
    const cream = this.material(0xbab29b);
    const metal = this.material(0x788281, undefined, 0.7);
    const tile = this.material(0xb1ac91, this.texture("tile"));
    const floor = this.material(0x858372, this.texture("floor"));
    const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, solid = false) => this.box(name, x, y, z, w, h, d, mat, solid);
    box("Floor", 0, -0.06, 0, 6.2, 0.12, 5.2, floor);
    box("Ceiling", 0, 3.06, 0, 6.2, 0.12, 5.2, plaster);
    box("Wall_Left", -3.1, 1.5, 0, 0.2, 3, 5.2, plaster, true);
    box("Wall_Right", 3.1, 1.5, 0, 0.2, 3, 5.2, plaster, true);
    box("Wall_Back", 0, 1.5, -2.6, 6.2, 3, 0.2, plaster, true);
    for (const x of [-1.8, 1.8]) box("Entry_Wall", x, 1.5, 2.6, 2.4, 3, 0.2, plaster, true);
    box("Entry_Lintel", 0, 2.6, 2.6, 1.2, 0.8, 0.2, plaster, true);
    const door = box("Hall_Door", 0, 1.1, 2.49, 1.18, 2.2, 0.08, green, true);
    for (const x of [-0.67, 0.67]) box("Door_Trim", x, 1.13, 2.4, 0.1, 2.26, 0.1, wood);
    box("Door_Trim", 0, 2.26, 2.4, 1.44, 0.1, 0.1, wood);
    box("Door_Handle", -0.43, 1.02, 2.4, 0.12, 0.04, 0.06, metal);
    for (const x of [-2.98, 2.98]) box("Skirting", x, 0.09, 0, 0.045, 0.18, 5, wood);
    box("Skirting", 0, 0.09, -2.48, 6, 0.18, 0.045, wood);
    box("Splashback", -0.55, 1.32, -2.47, 4.5, 0.78, 0.04, tile);
    // Cabinet carcasses share one geometry and a small material palette.
    for (const x of [-2.3, -1.4, -0.5, 0.4]) {
      box("Base_Cabinet", x, 0.46, -2.06, 0.86, 0.84, 0.8, green, true);
      box("Cabinet_Door", x, 0.48, -1.645, 0.8, 0.72, 0.04, green);
      box("Cabinet_Inset", x, 0.48, -1.62, 0.64, 0.55, 0.02, wood);
      box("Cabinet_Handle", x + 0.28, 0.68, -1.58, 0.035, 0.15, 0.045, metal);
    }
    box("Counter_Left", -2.02, 0.92, -2.05, 1.47, 0.08, 0.9, cream);
    box("Counter_Right", 0.15, 0.92, -2.05, 1.4, 0.08, 0.9, cream);
    // Recessed sink, with counter strips around its opening.
    box("Sink_Back_Rim", -0.94, 0.92, -2.39, 0.72, 0.08, 0.22, metal);
    box("Sink_Front_Rim", -0.94, 0.92, -1.7, 0.72, 0.08, 0.2, metal);
    box("Sink_Basin", -0.94, 0.82, -2.05, 0.7, 0.06, 0.5, metal);
    for (const x of [-1.27, -0.61]) box("Sink_Side", x, 0.88, -2.05, 0.04, 0.15, 0.5, metal);
    this.cylinder("Tap", -0.94, 1.1, -2.34, 0.025, 0.35, metal);
    box("Tap_Spout", -0.94, 1.26, -2.23, 0.05, 0.045, 0.25, metal);
    for (const x of [-2.3, 0.4]) {
      box("Wall_Cupboard", x, 2.12, -2.28, 0.86, 0.8, 0.42, green);
      box("Upper_Panel", x, 2.12, -2.05, 0.7, 0.64, 0.025, wood);
      box("Upper_Handle", x + 0.28, 1.9, -2.01, 0.035, 0.13, 0.04, metal);
    }
    const stove = box("Cooker", 1.36, 0.47, -2.05, 0.86, 0.94, 0.84, cream, true);
    box("Oven_Glass", 1.36, 0.4, -1.615, 0.66, 0.46, 0.025, dark);
    box("Oven_Handle", 1.36, 0.72, -1.55, 0.62, 0.045, 0.06, metal);
    for (const x of [1.13, 1.58]) for (const z of [-2.28, -1.87]) this.cylinder("Burner", x, 0.95, z, 0.14, 0.018, dark);
    for (let i = 0; i < 4; i++) this.cylinder("Cooker_Dial", 1.1 + i * 0.17, 0.86, -1.6, 0.04, 0.045, dark).rotation.x = Math.PI / 2;
    // The fridge opens: a body, a lit inside just behind the door, and the door on a hinge at the wall side.
    const fridge = this.group("Fridge");
    fridge.add(box("Fridge_Body", 2.43, 1.02, -2.0, 0.91, 2.04, 0.89, cream, true));
    const glow = this.own(new THREE.MeshStandardMaterial({ color: 0xb9c4c0, emissive: 0xc9dcd6, emissiveIntensity: 0.18 }));
    fridge.add(box("Fridge_Inside", 2.43, 1.02, -1.553, 0.8, 1.92, 0.01, glow));
    for (const y of [0.55, 0.95, 1.5]) fridge.add(box("Fridge_Shelf", 2.43, y, -1.53, 0.78, 0.015, 0.05, glow));
    fridge.add(box("Milk", 2.2, 1.06, -1.53, 0.09, 0.2, 0.05, this.material(0xe9e4d4)));
    fridge.add(box("Cake", 2.55, 0.62, -1.53, 0.3, 0.12, 0.05, this.material(0x6b3a2c)));
    fridge.add(this.cylinder("Jar", 2.68, 1.03, -1.53, 0.04, 0.14, this.material(0x8a6a3a)));
    const fridgeDoor = [
      box("Fridge_Door", 2.43, 1.02, -1.51, 0.91, 2.04, 0.06, cream),
      box("Freezer_Seam", 2.43, 1.5, -1.476, 0.85, 0.018, 0.012, dark),
      box("Fridge_Handle", 2.1, 1.15, -1.43, 0.045, 0.4, 0.08, metal),
      box("Fridge_Note", 2.45, 1.67, -1.472, 0.22, 0.28, 0.008, this.material(0xd4c894)),
    ];
    const magnet = this.cylinder("Magnet", 2.45, 1.78, -1.465, 0.022, 0.015, green);
    magnet.rotation.x = Math.PI / 2;
    for (const part of [...fridgeDoor, magnet]) fridge.add(part);
    this.swing(fridge, [...fridgeDoor, magnet], new THREE.Vector3(2.885, 0, -1.51), 1.9, "fridge");
    // Moonlit window on the left wall; the backing is intentionally opaque.
    const glass = new THREE.MeshStandardMaterial({ color: 0x172c37, emissive: 0x496579, emissiveIntensity: 0.45, roughness: 0.3 });
    this.materials.add(glass);
    box("Window", -2.97, 1.95, -0.2, 0.04, 1.2, 1.5, glass);
    for (const z of [-0.98, -0.2, 0.58]) box("Window_Frame", -2.91, 1.95, z, 0.09, 1.32, 0.06, wood);
    for (const y of [1.3, 1.95, 2.6]) box("Window_Frame", -2.91, y, -0.2, 0.09, 0.06, 1.62, wood);
    box("Window_Sill", -2.82, 1.28, -0.2, 0.32, 0.08, 1.7, cream);
    box("Table", -1.48, 0.76, 0.62, 1.35, 0.09, 0.94, wood, true);
    for (const x of [-2.02, -0.94]) for (const z of [0.27, 0.97]) box("Table_Leg", x, 0.36, z, 0.08, 0.72, 0.08, wood);
    box("Chair_Seat", -1.48, 0.43, 1.45, 0.48, 0.08, 0.48, wood, true);
    box("Chair_Back", -1.48, 0.76, 1.66, 0.48, 0.65, 0.06, wood);
    for (const x of [-1.67, -1.29]) for (const z of [1.26, 1.64]) box("Chair_Leg", x, 0.21, z, 0.055, 0.42, 0.055, wood);
    const mug = this.cylinder("Forgotten_Mug", -1.3, 0.9, 0.52, 0.085, 0.19, cream);
    this.cylinder("Tea", -1.3, 0.997, 0.52, 0.069, 0.003, dark);
    const handleGeometry = new THREE.TorusGeometry(0.06, 0.014, 6, 12);
    this.geometries.add(handleGeometry);
    const handle = new THREE.Mesh(handleGeometry, cream);
    handle.position.set(-1.2, 0.9, 0.52); this.root.add(handle);
    box("Teaspoon", -1.55, 0.817, 0.57, 0.025, 0.008, 0.19, metal);
    this.cylinder("Plate", -1.85, 0.82, 0.44, 0.18, 0.02, cream);
    box("Bread", -1.85, 0.86, 0.44, 0.18, 0.06, 0.15, this.material(0x957144));
    const clothMaterial = this.material(0x827b68, this.texture("tile"));
    box("Tea_Towel", -2.42, 0.976, -1.96, 0.4, 0.02, 0.4, clothMaterial);
    box("Hanging_Towel", -2.42, 0.79, -1.58, 0.4, 0.38, 0.02, clothMaterial);
    const bulb = new THREE.MeshStandardMaterial({ color: 0xffdc99, emissive: 0xffbf68, emissiveIntensity: 3 });
    this.materials.add(bulb);
    this.cylinder("Light_Cord", 0, 2.8, -0.4, 0.012, 0.4, dark);
    this.cylinder("Pendant_Shade", 0, 2.54, -0.4, 0.24, 0.16, green);
    this.cylinder("Bulb", 0, 2.44, -0.4, 0.06, 0.09, bulb);
    const light = new THREE.PointLight(0xffcf8c, 17, 9, 2);
    light.position.set(0, 2.35, -0.4); light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -0.001; light.shadow.normalBias = 0.035;
    this.root.add(light);
    const moon = new THREE.PointLight(0x8eb5d2, 5, 6, 2);
    moon.position.set(-2.65, 1.95, -0.2); this.root.add(moon);
    const inspect = this.inspect.bind(this);
    inspect(mug, "the forgotten cup", "A skin has formed over the tea. A teaspoon lies beside the cup. Someone left in a hurry—or meant to come back.");
    inspect(fridge, "the refrigerator", "Milk two weeks past its date, and a cake with one slice gone. The note on the door is too faded to read. There is no date on anything.");
    inspect(stove, "the cooker", "All four rings are cold. Grease has settled around the controls. Nothing here tells you when it was last used.");
    this.exitDoor(door, "the hall door", "The rest of the house lies beyond this door, wherever the device has put it.");
  }

}
