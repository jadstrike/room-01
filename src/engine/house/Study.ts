import * as THREE from "three";
import { ProceduralSection } from "./ProceduralSection";

/** Records offer context for accusations without settling Rowan's unreliable memories. */
export class Study extends ProceduralSection {
  readonly bounds = new THREE.Box3(new THREE.Vector3(-2.7, 0, -2.6), new THREE.Vector3(2.7, 2.9, 2.6));
  readonly dustOrigin = new THREE.Vector3(0.2, 2.4, -0.2);
  readonly spawn = new THREE.Vector3(0, 0, 1.9);
  readonly lookAt = new THREE.Vector3(-0.6, 1, -1.7);
  readonly ports = [{ id: "hall", position: new THREE.Vector3(0, 0, 2.6), outward: new THREE.Vector3(0, 0, 1), width: 1.2, height: 2.2 }];

  constructor(message: (text: string) => void) {
    super();
    this.root.name = "House_Study";
    const plaster = this.material(0x8e8b79, this.texture("plaster"));
    const wood = this.material(0x614c36, this.texture("wood"));
    const paper = this.material(0xd0c39e);
    const dark = this.material(0x262a25);
    const cloth = this.material(0x596a5a, this.texture("fabric"));
    const brass = this.material(0x9b8250, undefined, 0.6);
    const bookMaterials = [cloth, this.material(0x76524a), this.material(0x656f7c)];
    const box = this.box.bind(this);
    const group = (name: string) => { const g = new THREE.Group(); g.name = name; this.root.add(g); return g; };
    const inspect = (object: THREE.Object3D, label: string, text: string) => this.interactions.push({ id: `study:${object.name}`, object, verb: "Examine", label, range: 2.4, onInteract: () => message(text) });
    box("Floor", 0, -0.06, 0, 5.6, 0.12, 5.4, wood);
    box("Ceiling", 0, 2.96, 0, 5.6, 0.12, 5.4, plaster);
    for (const x of [-2.8, 2.8]) box("Side_Wall", x, 1.45, 0, 0.2, 2.9, 5.4, plaster, true);
    box("Back_Wall", 0, 1.45, -2.7, 5.6, 2.9, 0.2, plaster, true);
    for (const x of [-1.65, 1.65]) box("Entry_Wall", x, 1.45, 2.7, 2.1, 2.9, 0.2, plaster, true);
    box("Entry_Lintel", 0, 2.55, 2.7, 1.2, 0.7, 0.2, plaster, true);
    for (const x of [-2.67, 2.67]) box("Wall_Trim", x, 0.1, 0, 0.06, 0.2, 5.2, wood);
    const door = group("Hall_Door");
    door.add(box("Door", 0, 1.1, 2.59, 1.18, 2.2, 0.08, wood, true));
    door.add(box("Handle", -0.43, 1, 2.5, 0.14, 0.04, 0.08, brass));
    inspect(door, "the study door", "The study is quieter than the rest of the house. For a moment, Rowan expects to hear someone turning a page behind him.");

    box("Desk_Top", -0.8, 0.88, -1.92, 2.2, 0.12, 1, wood, true);
    for (const x of [-1.7, 0.1]) box("Desk_Pedestal", x, 0.41, -1.92, 0.35, 0.82, 0.83, wood, true);
    for (const y of [0.24, 0.55]) box("Drawer_Handle", -1.7, y, -1.475, 0.16, 0.025, 0.045, brass);
    const letter = group("Unfinished_Letter");
    letter.add(box("Letter_Paper", -0.82, 0.948, -1.7, 0.4, 0.014, 0.5, paper));
    for (let i = 0; i < 6; i++) letter.add(box("Letter_Ink", -0.82, 0.957, -1.89 + i * 0.057, i === 5 ? 0.14 : 0.3, 0.003, 0.008, dark));
    letter.add(box("Pen", -0.52, 0.96, -1.65, 0.025, 0.025, 0.24, brass));
    inspect(letter, "the unfinished letter", "“I can't keep having this argument. We need to talk when we're both calm.” There is no signature and no date. Rowan recognises the words more readily than the handwriting.");
    const receipts = group("Repair_Receipts");
    for (let i = 0; i < 3; i++) receipts.add(box("Receipt", -1.48 + i * 0.04, 0.95 + i * 0.008, -1.96, 0.22, 0.008, 0.37, paper));
    inspect(receipts, "the repair receipts", "A receipt lists a cellar latch, wood stain and pipe fittings. The purchases could explain the tools and marks downstairs. There is no name on the receipt.");
    const lamp = group("Desk_Lamp");
    lamp.add(this.cylinder("Lamp_Base", -0.06, 0.97, -2.15, 0.15, 0.05, brass));
    lamp.add(this.cylinder("Lamp_Stem", -0.06, 1.17, -2.15, 0.02, 0.4, brass));
    lamp.add(this.cylinder("Lamp_Shade", -0.06, 1.4, -2.15, 0.2, 0.18, cloth));
    const deskLight = new THREE.PointLight(0xffd394, 4, 3, 2); deskLight.position.set(-0.06, 1.29, -2.05); this.root.add(deskLight);

    const chair = group("Desk_Chair");
    chair.add(box("Chair_Seat", -1.08, 0.48, -0.59, 0.53, 0.1, 0.5, cloth));
    chair.add(box("Chair_Back", -1.08, 0.8, -0.35, 0.53, 0.64, 0.08, wood));
    for (const x of [-1.3, -0.86]) for (const z of [-0.79, -0.39]) chair.add(box("Chair_Leg", x, 0.23, z, 0.06, 0.46, 0.06, wood));
    this.colliders.push(new THREE.Box3(new THREE.Vector3(-1.35, 0, -0.84), new THREE.Vector3(-0.81, 1.12, -0.3)));
    const rug = box("Study_Rug", -0.3, 0.014, 0.3, 2.1, 0.02, 1.7, this.material(0x796953, this.texture("rug"))); rug.rotation.y = 0.05;

    const shelves = group("Bookshelves");
    shelves.add(box("Bookcase_Back", 2.31, 1.08, -1.43, 0.1, 2.16, 1.75, wood));
    for (const z of [-2.29, -0.57]) shelves.add(box("Bookcase_Side", 2.06, 1.08, z, 0.6, 2.16, 0.08, wood));
    for (const y of [0.12, 0.77, 1.42, 2.1]) shelves.add(box("Shelf", 2.06, y, -1.43, 0.6, 0.07, 1.8, wood));
    for (let row = 0; row < 3; row++) for (let i = 0; i < 8; i++) {
      const h = 0.31 + (i % 3) * 0.065;
      shelves.add(box("Book", 2.02, 0.16 + row * 0.65 + h / 2, -2.13 + i * 0.19, 0.42, h, 0.12, bookMaterials[(i + row) % 3]));
    }
    this.colliders.push(new THREE.Box3(new THREE.Vector3(1.76, 0, -2.33), new THREE.Vector3(2.39, 2.16, -0.53)));
    inspect(shelves, "the bookshelves", "Repair manuals stand beside novels and old notebooks. Dust outlines a missing volume. Rowan cannot remember its title.");
    const cabinet = group("Household_Files");
    cabinet.add(box("Filing_Cabinet", 2.13, 0.62, 1.04, 0.76, 1.24, 0.77, dark, true));
    for (const y of [0.31, 0.87]) {
      cabinet.add(box("File_Drawer", 1.735, y, 1.04, 0.025, 0.49, 0.66, cloth));
      cabinet.add(box("File_Handle", 1.7, y, 1.04, 0.05, 0.03, 0.18, brass));
    }
    cabinet.add(box("Folder", 2.12, 1.255, 1.04, 0.53, 0.025, 0.57, paper));
    inspect(cabinet, "the household files", "Bills and maintenance records are sorted by year. Several envelopes are addressed only to Rowan. He searches for something that would tell him who else lived here, but this drawer gives no clear answer.");

    const board = group("Noticeboard");
    board.add(box("Board_Frame", -2.65, 1.68, -0.36, 0.08, 0.9, 1.12, wood));
    board.add(box("Cork", -2.601, 1.68, -0.36, 0.025, 0.78, 1, cloth));
    for (let i = 0; i < 3; i++) board.add(box("Pinned_Note", -2.579, 1.68 + (i % 2) * 0.16, -0.68 + i * 0.31, 0.01, 0.3, 0.22, paper));
    inspect(board, "the noticeboard", "Shopping reminders and a hunting-club meeting slip overlap on the board. Someone has circled a date, but it is not the night Rowan remembers.");
    const frame = group("Empty_Photo_Frame");
    frame.add(box("Frame", -1.68, 1.17, -2.26, 0.32, 0.43, 0.06, wood));
    frame.add(box("Frame_Backing", -1.68, 1.17, -2.223, 0.25, 0.35, 0.012, dark));
    inspect(frame, "the empty photograph frame", "The frame holds only its backing. Rowan is certain there used to be a picture here. When he tries to remember the faces, the image slips away.");

    const warm = new THREE.PointLight(0xffdab0, 16, 8, 2); warm.position.copy(this.dustOrigin); warm.castShadow = true;
    warm.shadow.mapSize.set(1024, 1024); warm.shadow.bias = -0.001; warm.shadow.normalBias = 0.035; this.root.add(warm);
    this.cylinder("Ceiling_Cord", 0.2, 2.7, -0.2, 0.012, 0.4, dark);
    this.cylinder("Ceiling_Shade", 0.2, 2.51, -0.2, 0.23, 0.17, paper);
  }
}
