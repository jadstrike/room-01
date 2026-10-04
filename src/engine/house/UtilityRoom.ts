import * as THREE from "three";
import { ProceduralSection } from "./ProceduralSection";

export class UtilityRoom extends ProceduralSection {
  readonly bounds = new THREE.Box3(new THREE.Vector3(-2.5, 0, -2.5), new THREE.Vector3(2.5, 2.8, 2.5));
  readonly dustOrigin = new THREE.Vector3(0, 2.35, -0.3);
  readonly spawn = new THREE.Vector3(0, 0, 1.8);
  readonly lookAt = new THREE.Vector3(-0.6, 1, -1.7);
  readonly ports = [{ id: "hall", position: new THREE.Vector3(0, 0, 2.5), outward: new THREE.Vector3(0, 0, 1), width: 1.2, height: 2.2 }];

  constructor() {
    super("utility-room");
    this.root.name = "House_UtilityRoom";
    const plaster = this.material(0x91978a, this.texture("plaster"));
    const tile = this.material(0x8c9488, this.texture("tile"));
    const enamel = this.material(0xbdbdaf);
    const steel = this.material(0x6e7778, undefined, 0.65);
    const wood = this.material(0x66533e, this.texture("wood"));
    const dark = this.material(0x242f30);
    const cloth = this.material(0x687f78, this.texture("fabric"));
    const paper = this.material(0xd1c5a3);
    const box = this.box.bind(this);
    const group = this.group.bind(this);
    const inspect = this.inspect.bind(this);
    box("Floor", 0, -0.06, 0, 5.2, 0.12, 5.2, tile);
    box("Ceiling", 0, 2.86, 0, 5.2, 0.12, 5.2, plaster);
    for (const x of [-2.6, 2.6]) box("Side_Wall", x, 1.4, 0, 0.2, 2.8, 5.2, plaster, true);
    box("Back_Wall", 0, 1.4, -2.6, 5.2, 2.8, 0.2, plaster, true);
    for (const x of [-1.55, 1.55]) box("Entry_Wall", x, 1.4, 2.6, 1.9, 2.8, 0.2, plaster, true);
    box("Entry_Lintel", 0, 2.5, 2.6, 1.2, 0.6, 0.2, plaster, true);
    for (const x of [-2.48, 2.48]) box("Skirting", x, 0.08, 0, 0.04, 0.16, 5, wood);
    box("Back_Skirting", 0, 0.08, -2.48, 5, 0.16, 0.04, wood);
    const door = group("Hall_Door");
    door.add(box("Door_Slab", 0, 1.1, 2.49, 1.18, 2.2, 0.08, wood, true));
    door.add(box("Handle", -0.43, 1, 2.4, 0.14, 0.04, 0.08, steel));
    this.exitDoor(door, "the utility room door", "A draught slips beneath the door. The smell of detergent fades as you turn toward the hall.");

    // Front-facing drums share the same construction and resource ownership.
    for (const [index, x] of [-1.73, -0.62].entries()) {
      const appliance = group(index === 0 ? "Washing_Machine" : "Dryer");
      appliance.add(box("Appliance_Body", x, 0.5, -1.94, 0.98, 1, 0.92, enamel, true));
      appliance.add(box("Control_Strip", x, 0.9, -1.467, 0.87, 0.13, 0.035, steel));
      const ring = this.cylinder("Drum_Rim", x, 0.47, -1.44, 0.32, 0.055, steel); ring.rotation.x = Math.PI / 2; appliance.add(ring);
      const glass = this.cylinder("Drum_Window", x, 0.47, -1.405, 0.26, 0.03, dark); glass.rotation.x = Math.PI / 2; appliance.add(glass);
      appliance.add(box("Drum_Handle", x + 0.25, 0.48, -1.365, 0.05, 0.16, 0.04, enamel));
      const dial = this.cylinder("Program_Dial", x + 0.27, 0.9, -1.425, 0.047, 0.035, dark); dial.rotation.x = Math.PI / 2; appliance.add(dial);
      inspect(appliance, index === 0 ? "the washing machine" : "the dryer", index === 0
        ? "The washing machine has stopped mid-cycle. A damp towel presses against the glass. There is no way to tell who last used it."
        : "The dryer is cold. A thin layer of lint clings to the seal; clean towels sit folded above it.");
    }
    box("Worktop", -1.17, 1.065, -1.94, 2.18, 0.1, 1, wood);
    for (let i = 0; i < 3; i++) box("Folded_Towel", -0.65, 1.15 + i * 0.07, -1.98, 0.64, 0.065, 0.46, cloth);
    const detergent = group("Detergent");
    detergent.add(box("Bottle", -1.8, 1.31, -2.02, 0.21, 0.39, 0.18, cloth));
    detergent.add(box("Bottle_Cap", -1.8, 1.53, -2.02, 0.1, 0.06, 0.1, enamel));
    detergent.add(box("Bottle_Label", -1.8, 1.32, -1.923, 0.16, 0.2, 0.01, paper));
    inspect(detergent, "the detergent bottle", "Ordinary laundry detergent. A pale ring on the worktop shows where the bottle usually stands.");

    const sink = group("Deep_Sink");
    sink.add(box("Sink_Cabinet", 1.18, 0.43, -1.94, 1.2, 0.86, 0.85, wood, true));
    sink.add(box("Basin_Interior", 1.18, 0.9, -1.94, 1.06, 0.08, 0.73, dark));
    for (const x of [0.61, 1.75]) sink.add(box("Basin_Side", x, 1.02, -1.94, 0.08, 0.24, 0.86, enamel));
    for (const z of [-2.33, -1.55]) sink.add(box("Basin_Rim", 1.18, 1.02, z, 1.2, 0.24, 0.08, enamel));
    sink.add(this.cylinder("Tap_Stem", 1.18, 1.28, -2.3, 0.03, 0.3, steel));
    sink.add(box("Tap_Spout", 1.18, 1.43, -2.17, 0.06, 0.06, 0.3, steel));
    inspect(sink, "the deep utility sink", "A chalky tide mark circles the basin. Paint flecks sit near the drain, beside an old cleaning rag.");
    sink.add(box("Cleaning_Rag", 1.56, 1.155, -1.57, 0.3, 0.025, 0.2, cloth));
    box("Splashback", 0, 1.47, -2.485, 4.7, 0.58, 0.025, tile);

    const cupboard = group("Cleaning_Cupboard");
    cupboard.add(box("Cupboard", 2.13, 1, 0.05, 0.6, 2, 1, wood, true));
    cupboard.add(box("Cupboard_Front", 1.81, 1, 0.05, 0.04, 1.86, 0.88, enamel));
    cupboard.add(box("Cupboard_Handle", 1.76, 1.02, 0.34, 0.06, 0.22, 0.03, steel));
    inspect(cupboard, "the cleaning cupboard", "Buckets, brushes and spare bulbs belong here. A handwritten list on the inside of the door asks someone to fix the cellar latch.");
    const basket = group("Laundry_Basket");
    basket.add(box("Basket_Base", -1.87, 0.04, 0.31, 0.65, 0.08, 0.58, wood));
    for (const x of [-2.17, -1.57]) basket.add(box("Basket_Side", x, 0.25, 0.31, 0.05, 0.46, 0.58, wood));
    for (const z of [0.045, 0.575]) basket.add(box("Basket_End", -1.87, 0.25, z, 0.65, 0.46, 0.05, wood));
    for (let i = 0; i < 4; i++) basket.add(box("Laundry", -2.04 + (i % 2) * 0.29, 0.28 + Math.floor(i / 2) * 0.09, 0.3, 0.3, 0.13, 0.42, i % 2 ? enamel : cloth));
    this.colliders.push(new THREE.Box3(new THREE.Vector3(-2.2, 0, 0.01), new THREE.Vector3(-1.54, 0.48, 0.61)));
    inspect(basket, "the laundry basket", "Towels and everyday clothes fill the basket. Nothing is labelled. Rowan cannot be certain which things belonged to whom.");
    this.cylinder("Broom_Handle", -2.28, 0.83, 1.15, 0.025, 1.5, wood);
    box("Broom_Head", -2.28, 0.09, 1.15, 0.33, 0.18, 0.16, cloth);
    const fuse = group("Fuse_Box");
    fuse.add(box("Panel", -2.44, 1.65, -0.57, 0.1, 0.53, 0.4, steel));
    for (let i = 0; i < 4; i++) fuse.add(box("Breaker", -2.377, 1.66, -0.7 + i * 0.09, 0.035, 0.11, 0.05, dark));
    inspect(fuse, "the fuse box", "The circuits are labelled in faded pencil. The kitchen, bedroom and cellar share this old panel. Every switch is currently up.");
    const light = new THREE.PointLight(0xffe6bc, 18, 8, 2); light.position.copy(this.dustOrigin); light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -0.001; light.shadow.normalBias = 0.035; this.root.add(light);
    box("Ceiling_Fixture", 0, 2.68, -0.3, 0.95, 0.12, 0.23, enamel);
  }
}
