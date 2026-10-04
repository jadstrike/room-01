import type { ProceduralSection } from "../house/ProceduralSection";
import { LivingRoom } from "../house/LivingRoom";
import { Kitchen } from "../house/Kitchen";
import { UtilityRoom } from "../house/UtilityRoom";
import { Bedroom } from "../house/Bedroom";
import { Basement } from "../house/Basement";
import { Study } from "../house/Study";
import { Reception } from "../lab/Reception";
import { Office } from "../lab/Office";
import { CryostatLab } from "../lab/CryostatLab";
import { ServerRoom } from "../lab/ServerRoom";
import { BreakRoom } from "../lab/BreakRoom";

/** Every site room by the id src/story/sites.ts knows it by. Building one is synchronous and cheap. */
export const ROOMS: Readonly<Record<string, () => ProceduralSection>> = {
  "living-room": () => new LivingRoom(),
  kitchen: () => new Kitchen(),
  "utility-room": () => new UtilityRoom(),
  bedroom: () => new Bedroom(),
  basement: () => new Basement(),
  study: () => new Study(),
  reception: () => new Reception(),
  office: () => new Office(),
  cryostat: () => new CryostatLab(),
  "server-room": () => new ServerRoom(),
  "break-room": () => new BreakRoom(),
};
