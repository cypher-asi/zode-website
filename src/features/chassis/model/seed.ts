import bom from "../seed/bom.json";
import cooling from "../seed/cooling.json";
import electrical from "../seed/electrical.json";
import parts from "../seed/parts.json";
import pods from "../seed/pods.json";
import project from "../seed/project.json";
import racks from "../seed/racks.json";
import sheets from "../seed/sheets.json";
import site from "../seed/site.json";
import { DesignData } from "./schema";

/** NIRA Chassis I as its drawing set was issued, the template every new design starts from. */
export const rawSeed = { project, sheets, parts, bom, pods, racks, electrical, cooling, site };

export function parseDesign(raw: unknown): DesignData {
  return DesignData.parse(raw);
}

/** Like `parseDesign`, but null rather than a throw for data that isn't a design. */
export function safeParseDesign(raw: unknown): DesignData | null {
  const result = DesignData.safeParse(raw);
  return result.success ? result.data : null;
}

export const seedDesign: DesignData = parseDesign(rawSeed);
