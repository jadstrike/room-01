import * as THREE from "three";
import { ProceduralSection } from "../house/ProceduralSection";

/** Kettle, mugs, a fridge full of other people's lunches, and an argument on a whiteboard. */
export class BreakRoom extends ProceduralSection {
  readonly bounds = new THREE.Box3(new THREE.Vector3(-2.5, 0, -2.3), new THREE.Vector3(2.5, 2.7, 2.3));
  readonly dustOrigin = new THREE.Vector3(-0.3, 2.4, 0.1);
  readonly spawn = new THREE.Vector3(0, 0, 1.6);
  readonly lookAt = new THREE.Vector3(1.2, 1.3, -0.6);
  readonly ports = [{ id: "hall", position: new THREE.Vector3(0, 0, 2.3), outward: new THREE.Vector3(0, 0, 1), width: 1.2, height: 2.2 }];

  constructor() {
    super("break-room");
    this.root.name = "Lab_BreakRoom";
    const wall = this.material(0xb9b29c, this.texture("plaster"));
    const floor = this.material(0x7d7462, this.texture("tile"));
    const ceiling = this.material(0xc5c3b8, this.texture("plaster"));
    const laminate = this.material(0x9c8f78, this.texture("wood"));
    const white = this.material(0xe2e0d8);
    const steel = this.material(0x7b8487, undefined, 0.6);
    const dark = this.material(0x1d2224);
    const paper = this.material(0xe8e0c8);
    const red = this.material(0x9a2c22);
    const blue = this.material(0x2a4f8a);
    const panel = this.own(new THREE.MeshStandardMaterial({ color: 0xfff6e8, emissive: 0xffe6c8, emissiveIntensity: 0.6 }));
    const group = this.group.bind(this);
    const inspect = this.inspect.bind(this);

    this.shell(5, 4.6, 2.7, wall, floor, ceiling);
    this.exitDoor(this.doorSlab(2.3, this.material(0x6a6f62), steel), "the break room door", "A rota on the door assigns the washing-up. Every name on it has been crossed out and rewritten in the same hand.");
    this.box("Ceiling_Panel", -0.3, 2.67, 0.1, 1.2, 0.03, 0.34, panel);

    this.box("Counter", -0.9, 0.45, -1.95, 3.0, 0.9, 0.6, laminate, true);
    this.box("Counter_Top", -0.9, 0.92, -1.95, 3.1, 0.04, 0.66, white);
    this.box("Wall_Cupboard", -0.9, 1.95, -2.1, 3.0, 0.6, 0.35, laminate);
    const kettle = group("Kettle");
    kettle.add(this.cylinder("Kettle_Body", -1.9, 1.06, -1.9, 0.1, 0.24, steel));
    kettle.add(this.box("Kettle_Handle", -1.78, 1.12, -1.9, 0.03, 0.16, 0.05, dark));
    inspect(kettle, "the kettle", "Still faintly warm. Nobody is here to have boiled it.");
    const mugs = group("Mugs");
    for (const [i, x] of [-1.0, -0.75, -0.5].entries()) mugs.add(this.cylinder("Mug", x, 1.0, -1.85, 0.05, 0.12, i === 1 ? red : white));
    inspect(mugs, "the mugs", "One says WORLD'S SECOND-BEST PHYSICIST. It is chipped, and clearly his, and clearly used every day without irony.");

    // The fridge opens on the wall side; the birthday card on its door goes with it.
    const fridge = this.group("Fridge");
    fridge.add(this.box("Fridge_Body", 1.85, 0.95, -1.93, 0.7, 1.9, 0.64, white, true));
    const glow = this.own(new THREE.MeshStandardMaterial({ color: 0xb9c4c0, emissive: 0xc9dcd6, emissiveIntensity: 0.18 }));
    fridge.add(this.box("Fridge_Inside", 1.85, 0.95, -1.607, 0.6, 1.8, 0.01, glow));
    for (const y of [0.5, 0.95, 1.4]) fridge.add(this.box("Fridge_Shelf", 1.85, y, -1.59, 0.58, 0.015, 0.04, glow));
    for (const [i, x] of [1.65, 1.8, 1.97].entries()) fridge.add(this.box("Lunch", x, 1.0, -1.59, 0.12, 0.09, 0.04, i === 2 ? paper : this.material(0x4f6b7a)));
    fridge.add(this.box("Her_Label", 1.85, 0.53, -1.588, 0.16, 0.035, 0.005, paper));
    const fridgeDoor = [this.box("Fridge_Door", 1.85, 0.95, -1.57, 0.7, 1.9, 0.06, white), this.box("Fridge_Handle", 1.55, 1.2, -1.52, 0.03, 0.4, 0.04, steel)];
    for (const part of fridgeDoor) fridge.add(part);
    const card = group("Birthday_Card");
    card.add(this.box("Card", 1.95, 1.35, -1.545, 0.22, 0.28, 0.01, paper));
    card.add(this.box("Card_Front", 1.95, 1.4, -1.538, 0.16, 0.08, 0.002, red));
    fridge.add(card);
    this.swing(fridge, [...fridgeDoor, card], new THREE.Vector3(2.2, 0, -1.57), 1.9, "fridge");
    inspect(fridge, "the break room fridge", "Lunches in labelled boxes. The bottom shelf has her name on the label, in her own handwriting. It is empty.");
    inspect(
      card,
      "the birthday card",
      "A card for his birthday, signed by the whole group. Hers is the longest message: \"I couldn't have done any of it without your hands. Here's to being first, together.\" The signature at the end of it is a smudge.",
    );

    const board = group("Whiteboard_Argument");
    board.add(this.box("Board", 2.47, 1.5, -0.2, 0.03, 1.0, 1.6, this.material(0xf1f1ec)));
    board.add(this.box("Scrawl_Mine", 2.452, 1.72, -0.35, 0.004, 0.08, 0.6, red));
    board.add(this.box("Scrawl_Ours", 2.452, 1.42, -0.1, 0.004, 0.08, 0.7, blue));
    for (let i = 0; i < 3; i++) board.add(this.box("Underline", 2.452, 1.33 - i * 0.04, -0.1, 0.004, 0.012, 0.72, blue));
    inspect(
      board,
      "the whiteboard by the kettle",
      "\"MY idea\" in red, in one hand. Under it, in blue, in another: \"OUR idea\", underlined until the pen gave out. Nobody has wiped it. Nobody has dared.",
    );

    this.box("Table_Top", -0.8, 0.74, 0.35, 1.2, 0.05, 0.8, laminate);
    for (const [x, z] of [[-1.3, 0.05], [-0.3, 0.05], [-1.3, 0.65], [-0.3, 0.65]]) this.box("Table_Leg", x, 0.36, z, 0.05, 0.72, 0.05, steel);
    this.colliders.push(new THREE.Box3(new THREE.Vector3(-1.42, 0, -0.07), new THREE.Vector3(-0.18, 0.77, 0.77)));
    for (const x of [-1.15, -0.45]) {
      this.box("Chair_Seat", x, 0.45, 1.05, 0.42, 0.05, 0.42, blue);
      this.box("Chair_Back", x, 0.75, 1.25, 0.42, 0.5, 0.04, blue);
      this.colliders.push(new THREE.Box3(new THREE.Vector3(x - 0.22, 0, 0.83), new THREE.Vector3(x + 0.22, 1.0, 1.28)));
    }

    this.keyLight(0xffe8cc, 14, 8, this.dustOrigin);
  }
}
