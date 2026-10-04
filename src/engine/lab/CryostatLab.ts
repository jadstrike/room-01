import * as THREE from "three";
import { ProceduralSection } from "../house/ProceduralSection";

/** Lab 2: the dilution refrigerator her million qubits would have needed, and the night it quenched. */
export class CryostatLab extends ProceduralSection {
  readonly bounds = new THREE.Box3(new THREE.Vector3(-3.2, 0, -3), new THREE.Vector3(3.2, 3.2, 3));
  readonly dustOrigin = new THREE.Vector3(0.4, 2.85, 0.6);
  readonly spawn = new THREE.Vector3(0, 0, 2.25);
  readonly lookAt = new THREE.Vector3(-0.6, 1.6, -0.8);
  readonly ports = [{ id: "hall", position: new THREE.Vector3(0, 0, 3), outward: new THREE.Vector3(0, 0, 1), width: 1.2, height: 2.2 }];

  constructor() {
    super("cryostat");
    this.root.name = "Lab_Cryostat";
    const wall = this.material(0xa9afb0, this.texture("plaster"));
    const floor = this.material(0x6a7273, this.texture("tile"));
    const ceiling = this.material(0xb9bdbb, this.texture("plaster"));
    const steel = this.material(0x8a9396, undefined, 0.7);
    const gold = this.material(0xc49a4a, undefined, 0.85);
    const copper = this.material(0xa8673f, undefined, 0.8);
    const dark = this.material(0x1a1f21);
    const paper = this.material(0xe3ddce);
    const yellow = this.material(0xc8a22c);
    const panel = this.own(new THREE.MeshStandardMaterial({ color: 0xeef3ff, emissive: 0xdde8ff, emissiveIntensity: 0.6 }));
    const alarm = this.own(new THREE.MeshStandardMaterial({ color: 0x3a0a08, emissive: 0xc0281e, emissiveIntensity: 1.2 }));
    const screen = this.own(new THREE.MeshStandardMaterial({ color: 0x140c0c, emissive: 0x8a2a22, emissiveIntensity: 0.6 }));
    const group = this.group.bind(this);
    const inspect = this.inspect.bind(this);

    this.shell(6.4, 6, 3.2, wall, floor, ceiling);
    this.exitDoor(this.doorSlab(3, this.material(0x5b6a72), steel), "the Lab 2 door", "\"LAB 2 · CRYOGENIC · NO LONE WORKING\". The sign is older than the door.");
    for (const x of [-1.6, 1.6]) this.box("Ceiling_Panel", x, 3.17, 0.6, 1.2, 0.03, 0.3, panel);
    this.box("Warning_Sign", 1.6, 2.1, -2.97, 0.6, 0.4, 0.02, yellow);

    // The "chandelier": gold plates stepping down to the mixing chamber, hung from a frame.
    const fridge = group("Dilution_Fridge");
    for (const [x, z] of [[-1.2, -1.4], [0, -1.4], [-1.2, -0.2], [0, -0.2]]) fridge.add(this.box("Frame_Post", x, 1.6, z, 0.08, 3.2, 0.08, steel));
    fridge.add(this.box("Top_Plate", -0.6, 2.85, -0.8, 1.3, 0.08, 1.3, steel));
    const plates: [number, number][] = [[2.55, 0.48], [2.2, 0.42], [1.85, 0.36], [1.5, 0.3], [1.2, 0.24]];
    for (const [y, r] of plates) fridge.add(this.cylinder("Stage_Plate", -0.6, y, -0.8, r, 0.04, gold));
    for (const [dx, dz] of [[0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18]]) fridge.add(this.cylinder("Support_Rod", -0.6 + dx, 1.9, -0.8 + dz, 0.015, 1.4, gold));
    for (let i = 0; i < 6; i++) {
      const coax = this.cylinder("Coax", -0.6 + Math.cos(i) * 0.3, 1.95, -0.8 + Math.sin(i) * 0.3, 0.008, 1.3, copper);
      fridge.add(coax);
    }
    fridge.add(this.cylinder("Mixing_Chamber", -0.6, 1.0, -0.8, 0.12, 0.3, gold));
    this.colliders.push(new THREE.Box3(new THREE.Vector3(-1.3, 0, -1.5), new THREE.Vector3(0.1, 3.2, -0.1)));
    inspect(
      fridge,
      "the dilution refrigerator",
      "Gold plates stacked like a chandelier, stepping down to a chamber that was once colder than anywhere in the universe. Its shield cans are off. It has been warm for weeks.",
    );

    // Gas handling: the valve that opened, and the tag that says it does that.
    this.box("Gas_Rack", 2.9, 1.1, -0.9, 0.5, 2.2, 1.7, steel, true);
    for (let i = 0; i < 4; i++) {
      const valve = this.cylinder("Valve", 2.62, 1.75 - i * 0.3, -1.4, 0.05, 0.06, dark);
      valve.rotation.z = Math.PI / 2;
    }
    const tag = group("Maintenance_Tag");
    const wheel = this.cylinder("V7_Wheel", 2.6, 1.3, -0.5, 0.09, 0.04, this.material(0x2a5a9a));
    wheel.rotation.z = Math.PI / 2;
    tag.add(wheel);
    tag.add(this.box("Tag", 2.6, 1.12, -0.5, 0.02, 0.18, 0.13, yellow));
    inspect(
      tag,
      "the tag on valve V7",
      "A maintenance tag, dated 2 March: \"V7 sticks. Opens by itself when the line warms. Do not rely on it.\" Below it: \"Reported twice. Nobody came.\"",
    );

    this.box("Terminal_Desk", -2.35, 0.74, 1.5, 1.3, 0.05, 0.75, steel);
    for (const x of [-2.95, -1.75]) this.box("Desk_Leg", x, 0.36, 1.5, 0.05, 0.72, 0.7, steel);
    this.colliders.push(new THREE.Box3(new THREE.Vector3(-3.0, 0, 1.1), new THREE.Vector3(-1.7, 0.77, 1.9)));
    const terminal = group("Control_Terminal");
    terminal.add(this.box("Monitor", -2.6, 1.05, 1.75, 0.6, 0.4, 0.05, dark));
    terminal.add(this.box("Monitor_Screen", -2.6, 1.05, 1.72, 0.54, 0.34, 0.01, screen));
    inspect(terminal, "the control terminal", "A temperature plot falls for days, flattens near nothing, then leaps straight up the screen. The leap is labelled 23:52.");
    const log = group("Incident_Log");
    log.add(this.box("Printout", -2.05, 0.776, 1.4, 0.28, 0.01, 0.38, paper));
    for (let i = 0; i < 4; i++) log.add(this.box("Ink", -2.05, 0.782, 1.28 + i * 0.07, 0.2, 0.002, 0.012, i === 1 ? this.material(0x9a2c22) : dark));
    inspect(
      log,
      "the incident log",
      "The fridge's own log, printed: \"14 March, 23:52. Mixture line valve V7 opened. Quench.\" Somebody has written \"MANUAL?\" in the margin and underlined it.",
    );

    const dewars = group("Helium_Dewars");
    dewars.add(this.cylinder("Dewar", 1.9, 0.6, 1.9, 0.3, 1.2, steel));
    dewars.add(this.cylinder("Dewar", 2.6, 0.55, 2.2, 0.26, 1.1, steel));
    this.colliders.push(new THREE.Box3(new THREE.Vector3(1.55, 0, 1.55), new THREE.Vector3(2.9, 1.2, 2.5)));
    inspect(dewars, "the helium dewars", "Two dewars, both empty. A fill log hangs from one; the last fill is signed with initials that have been scraped off.");

    this.box("Alarm_Beacon", -2.9, 2.6, -2.9, 0.16, 0.16, 0.16, alarm);
    const red = new THREE.PointLight(0xc0281e, 2.5, 4, 2);
    red.position.set(-2.7, 2.5, -2.7);
    this.root.add(red);
    this.keyLight(0xdfe8ff, 20, 10, this.dustOrigin);
  }
}
