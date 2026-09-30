import * as THREE from "three";
import { ProceduralSection } from "./ProceduralSection";

/** Authored house room. All geometry, ports and colliders use section-local metres. */
export class LivingRoom extends ProceduralSection {
  readonly bounds = new THREE.Box3(new THREE.Vector3(-3.4, 0, -3), new THREE.Vector3(3.4, 3, 3));
  readonly dustOrigin = new THREE.Vector3(-2.56, 1.35, 1.86);
  readonly spawn = new THREE.Vector3(0, 0, 2.25);
  readonly lookAt = new THREE.Vector3(-0.4, 1.1, -1.7);
  readonly ports = [{ id: "hall", position: new THREE.Vector3(0, 0, 3), outward: new THREE.Vector3(0, 0, 1), width: 1.2, height: 2.2 }];

  constructor(message: (text: string) => void) {
    super();
    this.root.name = "House_LivingRoom";
    const plaster = this.material(0x96907b, this.texture("plaster"));
    const green = this.material(0x4b5950, this.texture("plaster"));
    const wood = this.material(0x685039, this.texture("wood"));
    const darkWood = this.material(0x302a23, this.texture("wood"));
    const fabric = this.material(0x65664e, this.texture("fabric"));
    const curtain = this.material(0x6c5745, this.texture("fabric"));
    const cream = this.material(0xc6b898);
    const dark = this.material(0x191b19);
    const brass = this.material(0x9a8050, undefined, 0.65);
    const brick = this.material(0x685446, this.texture("plaster"));
    const box = this.box.bind(this);
    const cylinder = this.cylinder.bind(this);
    // Components are grouped so details do not occlude their own inspection target.
    const group = (name: string) => { const g = new THREE.Group(); g.name = name; this.root.add(g); return g; };
    const inspect = (object: THREE.Object3D, label: string, text: string) => this.interactions.push({
      id: `living-room:${object.name}`, object, verb: "Examine", label, range: 2.4, onInteract: () => message(text),
    });

    box("Floor", 0, -0.06, 0, 7, 0.12, 6.2, darkWood);
    // Thin plank joints give the floor scale without creating collision obstacles.
    for (let x = -3.2; x <= 3.3; x += 0.32) box("Floor_Joint", x, 0.002, 0, 0.008, 0.003, 6, dark);
    box("Ceiling", 0, 3.06, 0, 7, 0.12, 6.2, plaster);
    box("Wall_Left", -3.5, 1.5, 0, 0.2, 3, 6.2, plaster, true);
    box("Wall_Right", 3.5, 1.5, 0, 0.2, 3, 6.2, plaster, true);
    box("Wall_Back", 0, 1.5, -3.1, 7, 3, 0.2, plaster, true);
    for (const x of [-2, 2]) box("Entry_Wall", x, 1.5, 3.1, 2.8, 3, 0.2, plaster, true);
    box("Entry_Lintel", 0, 2.6, 3.1, 1.2, 0.8, 0.2, plaster, true);
    for (const x of [-3.38, 3.38]) {
      box("Wainscot", x, 0.43, 0, 0.03, 0.86, 6, green);
      for (const y of [0.09, 0.87, 2.93]) box("Wall_Trim", x, y, 0, 0.055, 0.09, 6, wood);
    }
    box("Back_Panelling", 0, 0.43, -2.98, 6.8, 0.86, 0.03, green);
    for (const y of [0.09, 0.87, 2.93]) box("Back_Trim", 0, y, -2.95, 6.8, 0.09, 0.06, wood);
    for (const x of [-2, 2]) {
      box("Entry_Panelling", x, 0.43, 2.98, 2.8, 0.86, 0.03, green);
      box("Entry_Trim", x, 0.87, 2.95, 2.8, 0.09, 0.06, wood);
    }
    const door = group("Hall_Door");
    door.add(box("Door_Slab", 0, 1.1, 2.99, 1.18, 2.2, 0.08, green, true));
    for (const y of [0.6, 1.58]) door.add(box("Door_Panel", 0, y, 2.94, 0.91, 0.71, 0.025, wood));
    door.add(box("Door_Handle", -0.43, 1.03, 2.87, 0.14, 0.04, 0.08, brass));
    for (const x of [-0.67, 0.67]) box("Door_Trim", x, 1.13, 2.9, 0.1, 2.26, 0.12, wood);
    box("Door_Trim", 0, 2.26, 2.9, 1.44, 0.1, 0.12, wood);
    inspect(door, "the hall door", "The handle turns, but the door stays shut. A narrow line of darkness runs underneath it.");

    // Seating along the left wall leaves a continuous route down the right side.
    const sofa = group("Sofa");
    sofa.add(box("Sofa_Base", -2.58, 0.3, -0.2, 1.02, 0.4, 2.5, fabric, true));
    sofa.add(box("Sofa_Back", -3.04, 0.77, -0.2, 0.21, 0.74, 2.5, fabric));
    for (const z of [-1.39, 0.99]) sofa.add(box("Sofa_Arm", -2.55, 0.61, z, 1.08, 0.44, 0.2, fabric));
    for (const z of [-0.95, -0.2, 0.55]) {
      sofa.add(box("Seat_Cushion", -2.46, 0.55, z, 0.78, 0.2, 0.7, fabric));
      sofa.add(box("Back_Cushion", -2.87, 0.86, z, 0.19, 0.46, 0.7, fabric));
      sofa.add(box("Cushion_Piping", -2.065, 0.56, z, 0.012, 0.018, 0.64, cream));
    }
    for (const x of [-2.95, -2.2]) for (const z of [-1.21, 0.81]) sofa.add(box("Sofa_Foot", x, 0.09, z, 0.09, 0.18, 0.09, darkWood));
    const blanket = this.material(0x887a62, this.texture("fabric"));
    sofa.add(box("Folded_Throw", -2.44, 0.67, 0.52, 0.65, 0.035, 0.55, blanket));
    sofa.add(box("Hanging_Throw", -2.035, 0.43, 0.52, 0.035, 0.48, 0.55, blanket));
    inspect(sofa, "the worn sofa", "One cushion has sunk further than the others. A blanket is folded over the arm, its edge almost touching the floor.");

    box("Rug", -0.55, 0.012, -0.12, 2.45, 0.015, 2.7, this.material(0x7c5140, this.texture("rug")));
    box("Coffee_Table", -0.58, 0.43, -0.1, 0.82, 0.09, 1.52, wood, true);
    for (const x of [-0.9, -0.26]) for (const z of [-0.73, 0.53]) box("Coffee_Table_Leg", x, 0.2, z, 0.055, 0.4, 0.055, darkWood);
    box("Magazine", -0.58, 0.485, 0.31, 0.4, 0.025, 0.32, cream);
    box("Magazine_Cover", -0.58, 0.501, 0.31, 0.36, 0.003, 0.28, green);
    const remote = group("Remote");
    remote.add(box("Remote_Body", -0.53, 0.505, -0.46, 0.085, 0.04, 0.24, dark));
    for (let i = 0; i < 4; i++) remote.add(box("Remote_Button", -0.53, 0.53, -0.53 + i * 0.045, 0.035, 0.009, 0.02, cream));
    inspect(remote, "the television remote", "The lettering has worn away around the volume keys. The power button is pushed in and will not spring back.");

    const fireplace = group("Fireplace");
    fireplace.add(box("Chimney_Breast", -0.3, 1.5, -2.85, 1.9, 3, 0.3, green, true));
    fireplace.add(box("Firebox", -0.3, 0.52, -2.675, 1.02, 0.85, 0.055, dark));
    for (const x of [-0.98, 0.38]) fireplace.add(box("Fireplace_Jamb", x, 0.58, -2.5, 0.27, 1.16, 0.42, brick));
    fireplace.add(box("Mantel", -0.3, 1.19, -2.45, 1.78, 0.12, 0.62, wood));
    fireplace.add(box("Hearth", -0.3, 0.055, -2.4, 1.86, 0.11, 0.83, brick));
    // Explicit assembly footprint includes projecting jambs, not just the chimney wall.
    this.colliders.push(new THREE.Box3(new THREE.Vector3(-1.23, 0, -3), new THREE.Vector3(0.63, 1.25, -2.15)));
    for (let x = -0.73; x < 0.2; x += 0.16) fireplace.add(box("Grate_Bar", x, 0.28, -2.43, 0.022, 0.35, 0.025, dark));
    for (const x of [-0.52, -0.15]) {
      const log = cylinder("Cold_Log", x, 0.2, -2.55, 0.06, 0.42, darkWood);
      log.rotation.x = Math.PI / 2; fireplace.add(log);
    }
    inspect(fireplace, "the cold fireplace", "Ash lies beneath the grate. There is no warmth left in the stone, and no way to tell how long it has been cold.");
    const clock = group("Mantel_Clock");
    clock.add(box("Clock_Case", -0.3, 1.47, -2.42, 0.42, 0.43, 0.17, darkWood));
    const face = cylinder("Clock_Face", -0.3, 1.49, -2.325, 0.15, 0.012, cream);
    face.rotation.x = Math.PI / 2; clock.add(face);
    clock.add(box("Minute_Hand", -0.3, 1.54, -2.313, 0.012, 0.115, 0.008, dark));
    clock.add(box("Hour_Hand", -0.26, 1.49, -2.31, 0.085, 0.012, 0.008, dark));
    inspect(clock, "the stopped clock", "The clock has stopped. Its hands offer a time, but no date—and nothing that says why it stopped.");
    box("Picture_Frame", -0.3, 2.17, -2.66, 0.93, 0.57, 0.05, darkWood);
    box("Landscape_Print", -0.3, 2.17, -2.627, 0.79, 0.43, 0.014, this.material(0x707363, this.texture("plaster")));

    const bookcase = group("Bookcase");
    bookcase.add(box("Bookcase_Back", 2.48, 1.15, -2.8, 1.22, 2.3, 0.24, darkWood, true));
    for (const x of [1.88, 3.08]) bookcase.add(box("Bookcase_Side", x, 1.15, -2.64, 0.08, 2.3, 0.42, wood));
    const bookMaterials = [green, cream, this.material(0x714a39), this.material(0x4c555c)];
    for (let row = 0; row < 4; row++) {
      const y = 0.15 + row * 0.55;
      bookcase.add(box("Shelf", 2.48, y, -2.62, 1.18, 0.06, 0.46, wood));
      for (let i = 0; i < 8; i++) {
        const h = 0.29 + ((row * 3 + i) % 4) * 0.035;
        bookcase.add(box("Book", 2.01 + i * 0.13, y + 0.035 + h / 2, -2.59, 0.095, h, 0.26, bookMaterials[(row + i) % 4]));
      }
    }
    this.colliders.push(new THREE.Box3(new THREE.Vector3(1.84, 0, -2.95), new THREE.Vector3(3.12, 2.3, -2.39)));
    inspect(bookcase, "the bookcase", "Paperbacks, a road atlas, and instruction manuals. A clean rectangle in the dust marks where something used to stand.");

    const television = group("Television");
    television.add(box("TV_Console", 2.83, 0.37, -0.1, 0.81, 0.74, 1.48, wood, true));
    television.add(box("TV_Case", 2.83, 1.13, -0.1, 0.62, 0.69, 1.08, dark));
    const screen = new THREE.MeshStandardMaterial({ color: 0x26342e, roughness: 0.22, metalness: 0.25 });
    this.materials.add(screen);
    television.add(box("TV_Screen", 2.505, 1.15, -0.18, 0.025, 0.51, 0.8, screen));
    television.add(box("TV_Control", 2.49, 0.94, 0.34, 0.04, 0.055, 0.045, cream));
    inspect(television, "the dark television", "The screen reflects the room dimly. Its power light is off. No recording is playing.");

    // Closed window backing: outside space will be authored separately from maze connectivity.
    const glass = new THREE.MeshStandardMaterial({ color: 0x1a2c36, emissive: 0x567589, emissiveIntensity: 0.4, roughness: 0.3 });
    this.materials.add(glass);
    box("Window", -3.36, 1.95, -0.15, 0.04, 1.35, 1.84, glass);
    for (const z of [-1.1, -0.15, 0.8]) box("Window_Mullion", -3.29, 1.95, z, 0.1, 1.48, 0.06, wood);
    for (const y of [1.23, 1.95, 2.67]) box("Window_Frame", -3.29, y, -0.15, 0.1, 0.06, 2, wood);
    box("Window_Sill", -3.21, 1.21, -0.15, 0.32, 0.08, 2.08, cream);
    for (const side of [-1.35, 1.05]) for (let i = 0; i < 4; i++) {
      box("Curtain_Fold", -3.17 + (i % 2) * 0.045, 1.75, side + i * 0.075, 0.12, 2.02, 0.1, curtain);
    }
    box("Curtain_Rail", -3.17, 2.8, -0.03, 0.06, 0.05, 2.8, brass);

    box("Side_Table", -2.56, 0.66, 1.86, 0.67, 0.07, 0.6, wood, true);
    for (const x of [-2.81, -2.31]) for (const z of [1.64, 2.08]) box("Side_Table_Leg", x, 0.32, z, 0.06, 0.64, 0.06, darkWood);
    cylinder("Lamp_Base", -2.56, 0.73, 1.86, 0.17, 0.05, brass);
    cylinder("Lamp_Stem", -2.56, 1.04, 1.86, 0.022, 0.59, brass);
    const shadeMaterial = new THREE.MeshStandardMaterial({ color: 0xd8c29b, emissive: 0xc28c45, emissiveIntensity: 0.35, side: THREE.DoubleSide, roughness: 1 });
    this.materials.add(shadeMaterial);
    const shadeGeometry = new THREE.CylinderGeometry(0.17, 0.31, 0.39, 24, 1, true);
    this.geometries.add(shadeGeometry);
    const shade = new THREE.Mesh(shadeGeometry, shadeMaterial);
    shade.name = "Lamp_Shade"; shade.position.set(-2.56, 1.42, 1.86); this.root.add(shade);
    const lamp = new THREE.PointLight(0xffcb89, 12, 7, 2);
    lamp.position.set(-2.56, 1.35, 1.86); lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -0.001; lamp.shadow.normalBias = 0.035;
    this.root.add(lamp);
    const moon = new THREE.PointLight(0x8daec7, 7, 7, 2);
    moon.position.set(-2.98, 2.04, -0.15); this.root.add(moon);
    const fill = new THREE.PointLight(0xffd6a0, 18, 9, 2);
    fill.position.set(0.3, 2.6, 0.35); this.root.add(fill);
  }
}
