import * as THREE from "three";
import { ProceduralSection } from "../house/ProceduralSection";

/** The office she shared with the coworker: two desks, one of them cleared. */
export class Office extends ProceduralSection {
  readonly bounds = new THREE.Box3(new THREE.Vector3(-2.8, 0, -2.5), new THREE.Vector3(2.8, 2.7, 2.5));
  readonly dustOrigin = new THREE.Vector3(0, 2.4, -0.3);
  readonly spawn = new THREE.Vector3(0, 0, 1.75);
  readonly lookAt = new THREE.Vector3(0.6, 1, -1.4);
  readonly ports = [{ id: "hall", position: new THREE.Vector3(0, 0, 2.5), outward: new THREE.Vector3(0, 0, 1), width: 1.2, height: 2.2 }];

  constructor() {
    super("office");
    this.root.name = "Lab_Office";
    const wall = this.material(0xb7b4a8, this.texture("plaster"));
    const floor = this.material(0x5f6a6c, this.texture("fabric"));
    const ceiling = this.material(0xc5c8c2, this.texture("plaster"));
    const desk = this.material(0xc9bfa8, this.texture("wood"));
    const steel = this.material(0x6f777a, undefined, 0.6);
    const dark = this.material(0x1c2022);
    const paper = this.material(0xe3ddce);
    const green = this.material(0x2f7a46);
    const cloth = this.material(0x3f4a52, this.texture("fabric"));
    const panel = this.own(new THREE.MeshStandardMaterial({ color: 0xeef3ff, emissive: 0xdde8ff, emissiveIntensity: 0.5 }));
    const screen = this.own(new THREE.MeshStandardMaterial({ color: 0x10181a, emissive: 0x4a6f8a, emissiveIntensity: 0.4 }));
    const group = this.group.bind(this);
    const inspect = this.inspect.bind(this);

    this.shell(5.6, 5, 2.7, wall, floor, ceiling);
    this.exitDoor(this.doorSlab(2.5, this.material(0x5b6a72), steel), "the office door", "The nameplate on the door has two slots. One is empty.");
    this.box("Ceiling_Panel", 0, 2.67, -0.3, 1.4, 0.03, 0.34, panel);

    const deskAt = (x: number, name: string) => {
      const g = group(name);
      g.add(this.box("Desk_Top", x, 0.74, -1.3, 1.6, 0.05, 0.8, desk));
      for (const dx of [-0.74, 0.74]) g.add(this.box("Desk_Side", x + dx, 0.36, -1.3, 0.05, 0.72, 0.76, desk));
      g.add(this.box("Monitor", x, 1.0, -1.6, 0.56, 0.36, 0.05, dark));
      g.add(this.box("Monitor_Screen", x, 1.0, -1.57, 0.5, 0.3, 0.01, screen));
      this.colliders.push(new THREE.Box3(new THREE.Vector3(x - 0.8, 0, -1.7), new THREE.Vector3(x + 0.8, 0.77, -0.9)));
      return g;
    };

    // Her desk: everything gone, even the dust.
    const hers = deskAt(-1.4, "Her_Desk");
    hers.add(this.box("Nameplate_Holder", -1.4, 0.8, -0.95, 0.32, 0.07, 0.04, steel));
    hers.add(this.box("Clean_Patch", -1.85, 0.766, -1.35, 0.24, 0.002, 0.18, this.material(0xe0d8c2)));
    inspect(hers, "her desk", "Bare. The nameplate holder is empty. A rectangle of cleaner wood shows where a photograph stood, and Rowan cannot picture what was in it.");

    const his = deskAt(1.4, "His_Desk");
    his.add(this.box("Keyboard", 1.4, 0.775, -1.2, 0.44, 0.02, 0.14, dark));
    his.add(this.box("Mug", 1.95, 0.82, -1.0, 0.09, 0.12, 0.09, paper));
    inspect(his, "his desk", "Tidy, used every day. A calendar is open on the screen: the fourteenth of March has nothing in it.");
    const draft = group("Draft_Paper");
    draft.add(this.box("Draft_Stack", 0.95, 0.775, -1.05, 0.3, 0.02, 0.4, paper));
    draft.add(this.box("Struck_Name", 0.95, 0.787, -1.18, 0.2, 0.003, 0.02, green));
    draft.add(this.box("Green_Pen", 1.2, 0.78, -0.98, 0.025, 0.02, 0.16, green));
    inspect(
      draft,
      "the draft paper",
      "A printed draft of the paper. In the author list, her name is struck through so hard the page has torn, and his is arrowed up to first. The ink is the same green as the pen beside it.",
    );

    for (const [x, z] of [[-1.4, -0.45], [1.4, -0.45]]) {
      this.box("Chair_Seat", x, 0.47, z, 0.5, 0.08, 0.5, cloth);
      this.box("Chair_Back", x, 0.82, z + 0.24, 0.5, 0.6, 0.06, cloth);
      this.cylinder("Chair_Post", x, 0.23, z, 0.03, 0.44, steel);
      this.colliders.push(new THREE.Box3(new THREE.Vector3(x - 0.27, 0, z - 0.27), new THREE.Vector3(x + 0.27, 1.12, z + 0.3)));
    }

    const board = group("Whiteboard");
    board.add(this.box("Board", 0, 1.5, -2.47, 2.2, 1.1, 0.03, this.material(0xf1f1ec)));
    for (let i = 0; i < 5; i++) board.add(this.box("Marker", -0.7 + i * 0.36, 1.25 + (i % 3) * 0.2, -2.452, 0.28, 0.02, 0.004, i % 2 ? dark : this.material(0x2a4f8a)));
    inspect(board, "the whiteboard", "Qubit counts climb across it in two hands: a thousand, a hundred thousand, a million. At the top, someone has written \"factory?\" and circled it twice.");

    const email = group("Email_Printout");
    email.add(this.box("Cork_Board", 2.77, 1.5, -0.2, 0.04, 0.7, 1.0, this.material(0x8c6d4c, this.texture("fabric"))));
    email.add(this.box("Email", 2.74, 1.52, -0.3, 0.01, 0.34, 0.26, paper));
    inspect(
      email,
      "the pinned email",
      "From him to the whole group, a week before the fourteenth: \"Her name goes first. It was her idea. I won't discuss it again.\" Someone has pinned it up where he would see it every day.",
    );

    this.box("Filing_Cabinet", 2.35, 0.65, 1.55, 0.6, 1.3, 0.6, steel, true);
    this.keyLight(0xe8eeff, 8, 8, this.dustOrigin);
  }
}
