import * as THREE from "three";
import { ProceduralSection } from "./ProceduralSection";

/** A disturbed domestic scene; observations do not establish who caused the damage. */
export class Bedroom extends ProceduralSection {
  readonly bounds = new THREE.Box3(new THREE.Vector3(-3, 0, -3), new THREE.Vector3(3, 3, 3));
  readonly dustOrigin = new THREE.Vector3(0.3, 2.5, 0.1);
  readonly spawn = new THREE.Vector3(0, 0, 2.25);
  readonly lookAt = new THREE.Vector3(-0.7, 0.95, -1.6);
  readonly ports = [{ id: "hall", position: new THREE.Vector3(0, 0, 3), outward: new THREE.Vector3(0, 0, 1), width: 1.2, height: 2.2 }];

  constructor(message: (text: string) => void) {
    super();
    this.root.name = "House_Bedroom";
    const plaster = this.material(0x928979, this.texture("plaster"));
    const wood = this.material(0x64503c, this.texture("wood"));
    const dark = this.material(0x252722);
    const green = this.material(0x566257, this.texture("fabric"));
    const linen = this.material(0xb8ae97, this.texture("fabric"));
    const brass = this.material(0x97835b, undefined, 0.6);
    const paper = this.material(0xc9bd9c);
    const box = this.box.bind(this);
    const group = (name: string) => { const g = new THREE.Group(); g.name = name; this.root.add(g); return g; };
    const inspect = (object: THREE.Object3D, label: string, text: string) => this.interactions.push({ id: `bedroom:${object.name}`, object, verb: "Examine", label, range: 2.4, onInteract: () => message(text) });
    box("Floor", 0, -0.06, 0, 6.2, 0.12, 6.2, wood);
    for (let x = -2.8; x < 3; x += 0.35) box("Floor_Joint", x, 0.002, 0, 0.008, 0.003, 6, dark);
    box("Ceiling", 0, 3.06, 0, 6.2, 0.12, 6.2, plaster);
    for (const x of [-3.1, 3.1]) box("Side_Wall", x, 1.5, 0, 0.2, 3, 6.2, plaster, true);
    box("Back_Wall", 0, 1.5, -3.1, 6.2, 3, 0.2, plaster, true);
    for (const x of [-1.8, 1.8]) box("Entry_Wall", x, 1.5, 3.1, 2.4, 3, 0.2, plaster, true);
    box("Entry_Lintel", 0, 2.6, 3.1, 1.2, 0.8, 0.2, plaster, true);
    for (const x of [-2.98, 2.98]) for (const y of [0.09, 2.94]) box("Side_Trim", x, y, 0, 0.05, 0.12, 6, wood);
    for (const y of [0.09, 2.94]) box("Back_Trim", 0, y, -2.97, 6, 0.12, 0.05, wood);
    const door = group("Hall_Door");
    door.add(box("Door_Slab", 0, 1.1, 2.99, 1.18, 2.2, 0.08, wood, true));
    door.add(box("Door_Handle", -0.42, 1, 2.89, 0.13, 0.04, 0.09, brass));
    for (const x of [-0.67, 0.67]) box("Door_Trim", x, 1.13, 2.9, 0.1, 2.26, 0.12, wood);
    box("Door_Trim", 0, 2.26, 2.9, 1.44, 0.1, 0.12, wood);
    for (let i = 0; i < 4; i++) {
      const scratch = box("Latch_Splinter", -0.5 + i * 0.045, 0.95 + i * 0.035, 2.941, 0.015, 0.19, 0.008, paper);
      scratch.rotation.z = -0.3; door.add(scratch);
    }
    inspect(door, "the damaged door", "Wood has splintered beside the latch. Someone may have forced this door. You cannot tell who was on either side.");

    const bed = group("Disturbed_Bed");
    bed.add(box("Bed_Frame", -1.45, 0.3, -1.38, 1.85, 0.35, 2.48, wood, true));
    bed.add(box("Headboard", -1.45, 0.77, -2.6, 1.96, 1.24, 0.13, wood));
    bed.add(box("Mattress", -1.45, 0.59, -1.38, 1.78, 0.24, 2.32, linen));
    const pillow = box("Pillow", -1.88, 0.79, -2.2, 0.7, 0.17, 0.43, linen); pillow.rotation.y = 0.19; bed.add(pillow);
    // Several shallow folds make the duvet visibly pulled toward the floor.
    for (let i = 0; i < 7; i++) {
      const fold = box("Duvet_Fold", -1.35 + i * 0.12, 0.76 + Math.sin(i * 1.5) * 0.04, -0.8 + i * 0.13, 1.28, 0.1, 0.22, green);
      fold.rotation.y = -0.23; bed.add(fold);
    }
    bed.add(box("Duvet_Over_Edge", -0.52, 0.48, -0.45, 0.09, 0.61, 0.69, green));
    inspect(bed, "the disordered bed", "The sheet has been pulled free and the duvet dragged over one side. One pillow is missing. It looks as though the bed was disturbed in a hurry.");
    const fallenPillow = box("Fallen_Pillow", -1.35, 0.09, 0.36, 0.7, 0.16, 0.43, linen); fallenPillow.rotation.y = -0.48;
    const rug = box("Skewed_Rug", -0.4, 0.016, 1.05, 1.65, 0.02, 1.12, this.material(0x796253, this.texture("rug"))); rug.rotation.y = 0.17;

    const wardrobe = group("Wardrobe");
    wardrobe.add(box("Wardrobe_Body", 2.25, 1.13, -2.42, 1.27, 2.26, 0.85, wood, true));
    wardrobe.add(box("Wardrobe_Shadow", 2.25, 1.13, -1.98, 1.09, 2.08, 0.018, dark));
    wardrobe.add(box("Wardrobe_Door", 2.57, 1.13, -1.95, 0.55, 2.08, 0.06, wood));
    wardrobe.add(box("Wardrobe_Handle", 2.37, 1.05, -1.89, 0.025, 0.22, 0.05, brass));
    for (const x of [1.83, 2.01, 2.18]) wardrobe.add(box("Hanging_Clothes", x, 1.37, -2.02, 0.12, 0.82, 0.18, green));
    inspect(wardrobe, "the half-open wardrobe", "Clothes have been pulled from their hangers. The disorder continues across the floor toward the door.");

    const dresser = group("Pulled_Drawer");
    dresser.add(box("Dresser", 2.42, 0.55, -0.6, 0.88, 1.1, 1.4, wood, true));
    for (const y of [0.28, 0.6]) dresser.add(box("Drawer_Front", 1.963, y, -0.6, 0.04, 0.27, 1.22, wood));
    dresser.add(box("Open_Drawer", 1.7, 0.96, -0.6, 0.59, 0.09, 1.2, wood));
    dresser.add(box("Drawer_Inner", 1.71, 1.015, -0.6, 0.48, 0.015, 1.06, dark));
    dresser.add(box("Drawer_Lip", 1.4, 1.05, -0.6, 0.06, 0.26, 1.2, wood));
    this.colliders.push(new THREE.Box3(new THREE.Vector3(1.37, 0.83, -1.2), new THREE.Vector3(2.86, 1.18, 0.1)));
    inspect(dresser, "the pulled-out drawer", "The top drawer has been yanked almost off its runners. A few folded clothes remain inside; the rest have spilled out.");
    for (let i = 0; i < 7; i++) {
      const clothing = box("Scattered_Clothing", 0.8 + (i % 3) * 0.49, 0.03, 0.35 + Math.floor(i / 3) * 0.45, 0.38, 0.04, 0.3, i % 2 ? green : linen);
      clothing.rotation.y = i * 0.63;
    }

    // Build in local coordinates, tip the complete chair, then measure its actual footprint.
    const chair = group("Overturned_Chair");
    chair.add(box("Chair_Seat", 0, 0.47, 0, 0.48, 0.07, 0.48, wood));
    for (const x of [-0.2, 0.2]) for (const z of [-0.2, 0.2]) chair.add(box("Chair_Leg", x, 0.23, z, 0.06, 0.46, 0.06, wood));
    chair.add(box("Chair_Back", 0, 0.79, 0.22, 0.48, 0.62, 0.055, wood));
    chair.rotation.set(Math.PI / 2, 0, -0.3); chair.position.set(-1.72, 0.25, 1.47);
    chair.updateMatrixWorld(true); this.colliders.push(new THREE.Box3().setFromObject(chair));
    inspect(chair, "the overturned chair", "The chair lies on its back. Two pale scrapes run across the floor beneath it, as though it was pushed hard before it fell.");
    for (const x of [-1.94, -1.56]) { const mark = box("Floor_Scrape", x, 0.007, 0.99, 0.025, 0.005, 0.78, paper); mark.rotation.y = -0.28; }

    const frame = group("Broken_Frame");
    const frameWood = box("Fallen_Frame", 0.55, 0.045, -1.6, 0.49, 0.07, 0.37, wood); frameWood.rotation.y = 0.27; frame.add(frameWood);
    frame.add(box("Photo_Backing", 0.55, 0.085, -1.6, 0.35, 0.008, 0.24, paper));
    const glass = this.material(0x7e979c, undefined, 0.5);
    for (let i = 0; i < 5; i++) { const shard = box("Glass_Shard", 0.23 + i * 0.16, 0.012, -1.13 + (i % 2) * 0.15, 0.09, 0.01, 0.035, glass); shard.rotation.y = i * 1.2; frame.add(shard); }
    inspect(frame, "the broken picture frame", "A frame lies face down beside fragments of glass. Rowan remembers raised voices. The memory gives him no clear view of what happened here.");

    const windowMat = new THREE.MeshStandardMaterial({ color: 0x233946, emissive: 0x57748a, emissiveIntensity: 0.4, roughness: 0.4 }); this.materials.add(windowMat);
    box("Window", -2.97, 1.93, -0.5, 0.04, 1.28, 1.58, windowMat);
    for (const z of [-1.32, -0.5, 0.32]) box("Window_Mullion", -2.91, 1.93, z, 0.09, 1.38, 0.06, wood);
    for (const y of [1.24, 2.62]) box("Window_Frame", -2.91, y, -0.5, 0.09, 0.06, 1.7, wood);
    for (let i = 0; i < 5; i++) box("Bunched_Curtain", -2.83 + (i % 2) * 0.04, 1.72, 0.44 + i * 0.08, 0.12, 2.08, 0.1, green);
    box("Curtain_Rail", -2.82, 2.82, -0.29, 0.06, 0.04, 2.3, brass);
    const warm = new THREE.PointLight(0xffd29a, 20, 9, 2); warm.position.copy(this.dustOrigin); warm.castShadow = true;
    warm.shadow.mapSize.set(1024, 1024); warm.shadow.bias = -0.001; warm.shadow.normalBias = 0.035; this.root.add(warm);
    this.cylinder("Light_Cord", 0.3, 2.85, 0.1, 0.012, 0.3, dark);
    this.cylinder("Ceiling_Shade", 0.3, 2.66, 0.1, 0.23, 0.15, linen);
    const moon = new THREE.PointLight(0x8cabc9, 7, 6, 2); moon.position.set(-2.65, 2, -0.5); this.root.add(moon);
  }
}
