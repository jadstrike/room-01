import * as THREE from "three";
import { ProceduralSection } from "../house/ProceduralSection";

/** The lab's front desk, where the night's badge swipes are printed out. Rowan arrives here. */
export class Reception extends ProceduralSection {
  readonly bounds = new THREE.Box3(new THREE.Vector3(-3, 0, -2.5), new THREE.Vector3(3, 2.8, 2.5));
  readonly dustOrigin = new THREE.Vector3(0, 2.45, -0.2);
  readonly spawn = new THREE.Vector3(0, 0, 1.75);
  readonly lookAt = new THREE.Vector3(-1.2, 1.1, -1.4);
  readonly ports = [{ id: "hall", position: new THREE.Vector3(0, 0, 2.5), outward: new THREE.Vector3(0, 0, 1), width: 1.2, height: 2.2 }];

  constructor() {
    super("reception");
    this.root.name = "Lab_Reception";
    const wall = this.material(0xb4b9b3, this.texture("plaster"));
    const floor = this.material(0x7f8786, this.texture("tile"));
    const ceiling = this.material(0xc5c8c2, this.texture("plaster"));
    const laminate = this.material(0xd2cfc4);
    const steel = this.material(0x7b8487, undefined, 0.6);
    const dark = this.material(0x1d2224);
    const paper = this.material(0xe1dccd);
    const blue = this.material(0x4f6b7a, this.texture("fabric"));
    const cork = this.material(0x8c6d4c, this.texture("fabric"));
    const panel = this.own(new THREE.MeshStandardMaterial({ color: 0xeef3ff, emissive: 0xdde8ff, emissiveIntensity: 0.55 }));
    const screen = this.own(new THREE.MeshStandardMaterial({ color: 0x0f1a1c, emissive: 0x3d8a7a, emissiveIntensity: 0.7 }));
    const group = this.group.bind(this);
    const inspect = this.inspect.bind(this);

    this.shell(6, 5, 2.8, wall, floor, ceiling);
    this.exitDoor(this.doorSlab(2.5, this.material(0x5b6a72), steel), "the lab door", "A badge reader blinks red beside the frame. Whatever the tablet has loaded decides where this door opens.");
    this.box("Badge_Reader", -0.85, 1.2, 2.47, 0.1, 0.16, 0.04, dark);
    this.box("Lab_Sign", 0.6, 2.05, -2.48, 1.7, 0.36, 0.03, blue);
    for (const z of [-1.1, 1.1]) this.box("Ceiling_Panel", 0, 2.77, z, 1.2, 0.03, 0.3, panel);

    // The desk faces the door from the back-left corner, so the log is the first thing in view.
    this.box("Desk_Counter", -1.45, 0.55, -1.35, 2.5, 1.1, 0.7, laminate, true);
    this.box("Desk_Top", -1.45, 1.125, -1.35, 2.6, 0.05, 0.8, steel);
    const monitor = group("Security_Monitor");
    monitor.add(this.box("Monitor_Case", -2.1, 1.4, -1.55, 0.6, 0.42, 0.06, dark));
    monitor.add(this.box("Monitor_Screen", -2.1, 1.4, -1.515, 0.52, 0.34, 0.01, screen));
    monitor.add(this.box("Monitor_Stand", -2.1, 1.18, -1.58, 0.08, 0.1, 0.08, dark));
    inspect(monitor, "the security monitor", "Four camera feeds, all of empty corridors. The timestamp in the corner is frozen at 23:40.");
    const log = group("Badge_Log");
    log.add(this.box("Clipboard", -1.0, 1.16, -1.2, 0.26, 0.02, 0.34, dark));
    log.add(this.box("Log_Sheet", -1.0, 1.172, -1.2, 0.22, 0.004, 0.3, paper));
    for (let i = 0; i < 6; i++) log.add(this.box("Log_Line", -1.0, 1.176, -1.32 + i * 0.045, i === 3 ? 0.18 : 0.15, 0.002, 0.008, i === 3 ? this.material(0x9a2c22) : dark));
    inspect(
      log,
      "the night log",
      "The badge readers' night log, printed and clipped to the desk. Two lines are circled: 14 March, 23:40, badge 0412 (his) opens Lab 2. 23:41, her badge, same door. No exit is recorded for either.",
    );

    const chairs = group("Waiting_Chairs");
    for (const z of [-1.2, -0.5, 0.2]) {
      chairs.add(this.box("Chair_Seat", 2.55, 0.45, z, 0.5, 0.06, 0.5, blue));
      chairs.add(this.box("Chair_Back", 2.78, 0.75, z, 0.05, 0.55, 0.5, blue));
      for (const dz of [-0.2, 0.2]) chairs.add(this.box("Chair_Leg", 2.55, 0.21, z + dz, 0.04, 0.42, 0.04, steel));
    }
    chairs.add(this.box("Visitor_Badge", 2.5, 0.49, -0.5, 0.09, 0.01, 0.13, paper));
    this.colliders.push(new THREE.Box3(new THREE.Vector3(2.28, 0, -1.47), new THREE.Vector3(2.83, 1.05, 0.47)));
    inspect(chairs, "the waiting chairs", "A visitor badge lies on the middle chair. The name line has been left blank.");

    const book = group("Visitors_Book");
    book.add(this.box("Lectern", 1.95, 0.5, 1.45, 0.42, 1.0, 0.36, laminate, true));
    book.add(this.box("Book", 1.95, 1.03, 1.45, 0.34, 0.04, 0.26, this.material(0x6d2f2a)));
    inspect(book, "the visitors' book", "Months of signatures. Rowan looks for his own name, on any page, on any visit. It isn't there.");

    const notice = group("Lost_Notice");
    notice.add(this.box("Cork_Board", -2.97, 1.6, 0.7, 0.04, 0.8, 1.1, cork));
    notice.add(this.box("Notice", -2.94, 1.66, 0.55, 0.01, 0.3, 0.22, paper));
    notice.add(this.box("Notice_Pin", -2.93, 1.79, 0.55, 0.02, 0.03, 0.03, this.material(0x9a2c22)));
    notice.add(this.box("Rota", -2.94, 1.5, 0.95, 0.01, 0.34, 0.26, paper));
    inspect(notice, "the lost-property notice", "Typed, a week old: \"Badge 0412 reported lost, 9 March. Deactivation requested.\" Underneath, in pen: \"still not done??\"");

    this.cylinder("Plant_Pot", 2.6, 0.22, 2.0, 0.18, 0.44, dark);
    this.cylinder("Plant", 2.6, 0.75, 2.0, 0.26, 0.65, this.material(0x3d5a3a, this.texture("fabric")));

    this.keyLight(0xe6eeff, 10, 9, this.dustOrigin);
    const fill = new THREE.PointLight(0x9fb4d8, 4, 6, 2);
    fill.position.set(-2, 1.6, -1.6);
    this.root.add(fill);
  }
}
