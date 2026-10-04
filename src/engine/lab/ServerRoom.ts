import * as THREE from "three";
import { ProceduralSection } from "../house/ProceduralSection";

/** Where her data was, until 00:10 on the fifteenth. */
export class ServerRoom extends ProceduralSection {
  readonly bounds = new THREE.Box3(new THREE.Vector3(-2.5, 0, -2.5), new THREE.Vector3(2.5, 2.8, 2.5));
  readonly dustOrigin = new THREE.Vector3(0, 2.5, 0.4);
  readonly spawn = new THREE.Vector3(0, 0, 1.75);
  readonly lookAt = new THREE.Vector3(-0.4, 1.2, -1.7);
  readonly ports = [{ id: "hall", position: new THREE.Vector3(0, 0, 2.5), outward: new THREE.Vector3(0, 0, 1), width: 1.2, height: 2.2 }];

  constructor() {
    super("server-room");
    this.root.name = "Lab_ServerRoom";
    const wall = this.material(0x8f9698, this.texture("plaster"));
    const floor = this.material(0x5b6264, this.texture("floor"));
    const ceiling = this.material(0xa3a8a8, this.texture("plaster"));
    const rack = this.material(0x22282b, undefined, 0.4);
    const steel = this.material(0x6f777a, undefined, 0.6);
    const paper = this.material(0xe3ddce);
    const dark = this.material(0x15191b);
    const ledGreen = this.own(new THREE.MeshStandardMaterial({ color: 0x0a2a14, emissive: 0x35d26a, emissiveIntensity: 2 }));
    const ledAmber = this.own(new THREE.MeshStandardMaterial({ color: 0x2a1a05, emissive: 0xe0a030, emissiveIntensity: 2 }));
    const screen = this.own(new THREE.MeshStandardMaterial({ color: 0x0c1214, emissive: 0x4a6f8a, emissiveIntensity: 0.5 }));
    const group = this.group.bind(this);
    const inspect = this.inspect.bind(this);

    this.shell(5, 5, 2.8, wall, floor, ceiling);
    this.exitDoor(this.doorSlab(2.5, this.material(0x4c5a62), steel), "the server room door", "It seals with a hiss. The cold behind it is the dry, fanned cold of machines.");

    const racks = group("Server_Racks");
    for (const x of [-1.65, -0.85, -0.05, 0.75]) {
      racks.add(this.box("Rack", x, 1.05, -2.1, 0.7, 2.1, 0.8, rack));
      for (let row = 0; row < 8; row++) {
        racks.add(this.box("LED", x - 0.22 + (row % 3) * 0.05, 0.4 + row * 0.2, -1.695, 0.02, 0.015, 0.006, row % 4 === 1 ? ledAmber : ledGreen));
      }
    }
    this.colliders.push(new THREE.Box3(new THREE.Vector3(-2.0, 0, -2.5), new THREE.Vector3(1.1, 2.1, -1.7)));
    inspect(racks, "the server racks", "The group's machines. Every light is green except one shelf, which blinks amber: \"array degraded, one volume missing\".");

    const note = group("Password_Note");
    note.add(this.box("Sticky_Note", 0.75, 1.42, -1.69, 0.14, 0.14, 0.01, this.material(0xe8d64a)));
    inspect(
      note,
      "the sticky note",
      "Stuck to the rack at eye level: \"labadmin / qubit2024\". Anyone in the group could have used it. Probably everyone did.",
    );

    this.box("Terminal_Desk", 2.05, 0.74, 0.6, 0.8, 0.05, 1.4, steel);
    this.box("Desk_Leg", 2.05, 0.36, 0.0, 0.75, 0.72, 0.05, steel);
    this.box("Desk_Leg", 2.05, 0.36, 1.2, 0.75, 0.72, 0.05, steel);
    this.colliders.push(new THREE.Box3(new THREE.Vector3(1.65, 0, -0.1), new THREE.Vector3(2.5, 0.77, 1.3)));
    this.box("Terminal_Monitor", 2.35, 1.02, 0.85, 0.05, 0.36, 0.56, dark);
    this.box("Terminal_Screen", 2.32, 1.02, 0.85, 0.01, 0.3, 0.5, screen);
    const record = group("Deletion_Record");
    record.add(this.box("Audit_Printout", 1.95, 0.776, 0.35, 0.3, 0.01, 0.4, paper));
    for (let i = 0; i < 4; i++) record.add(this.box("Ink", 1.95, 0.782, 0.23 + i * 0.07, 0.2, 0.002, 0.012, dark));
    inspect(
      record,
      "the audit printout",
      "A filesystem audit: her whole project folder deleted at 00:10 on 15 March, eighteen minutes after the quench, by the account labadmin.",
    );

    const tape = group("Tape_Drive");
    tape.add(this.box("Shelf", -2.25, 1.0, 0.8, 0.5, 0.05, 0.9, steel));
    tape.add(this.box("Drive", -2.25, 1.13, 0.8, 0.42, 0.2, 0.5, dark));
    tape.add(this.box("Empty_Slot", -2.03, 1.13, 0.8, 0.01, 0.04, 0.24, this.material(0x050505)));
    inspect(tape, "the tape drive", "The backup drive. Its slot is empty, and the rack of labelled tapes beside it is missing exactly one: hers.");

    this.box("Cooling_Unit", -2.1, 1.0, -0.65, 0.7, 2.0, 0.9, this.material(0xbfc3c0), true);
    this.keyLight(0xd7e4ff, 13, 8, this.dustOrigin);
  }
}
