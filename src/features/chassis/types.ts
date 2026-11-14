import type { Derived } from "./model/calc";
import type { DesignData } from "./model/schema";

/** A design as the Chassis app lists it, figures worked out from its latest version. */
export interface DesignSummary {
  id: string;
  name: string;
  version: number;
  /** The REV in its drawings' title blocks. */
  revision: number;
  status: string;
  totalUsd: number;
  failingChecks: number;
  updatedAt: string;
  archived: boolean;
  uses: DesignUse[];
}

/** A deployment the design was sent to, as a quote. */
export interface DesignUse {
  deploymentId: string;
  deploymentName: string;
  quoteId: string;
  /** The version the quote was written from. */
  version: number;
}

export interface VersionInfo {
  version: number;
  note: string | null;
  createdAt: string;
  createdBy: string | null;
}

/** A design opened in the app: one version's data, with the design around it. */
export interface OpenDesign {
  id: string;
  name: string;
  /** The version shown, the latest unless an older one was asked for. */
  version: number;
  latestVersion: number;
  data: DesignData;
  archived: boolean;
  versions: VersionInfo[];
  uses: DesignUse[];
}

/** A deployment the design can be sent to, with the phases its BOM can go on. */
export interface DeploymentTarget {
  id: string;
  name: string;
  status: string;
  phases: { id: string; label: string }[];
}

export type ActionResult<T = object> = ({ error: string } & Partial<T>) | ({ error?: undefined } & T);

/** Every view of an open design: its sheets, then the data pages. */
export const DATA_VIEWS = [
  { id: "bom", label: "Bill of materials" },
  { id: "parts", label: "Parts catalog" },
  { id: "racks", label: "Racks & elevations" },
  { id: "checks", label: "Design checks" },
  { id: "versions", label: "Versions" },
  { id: "deployments", label: "Deployments" },
] as const;

export type DataView = (typeof DATA_VIEWS)[number]["id"];

export const isDataView = (value: unknown): value is DataView => DATA_VIEWS.some(({ id }) => id === value);

export const CHASSIS_HREF = "/portal/chassis";
export const designHref = (id: string): string => `${CHASSIS_HREF}/${id}`;
export const sheetHref = (id: string, sheetId: string): string => `${CHASSIS_HREF}/${id}/sheets/${sheetId}`;
export const viewHref = (id: string, view: DataView): string => `${CHASSIS_HREF}/${id}/${view}`;

/** `url` when it's an http(s) address, for links built from a design's data. */
export function webHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** One quote item a design version's BOM line becomes, for one set of pods. */
export interface ChassisQuoteItem {
  /** The BOM line's id in the design, e.g. "R1". */
  lineId: string;
  section: string;
  partNumber: string | null;
  manufacturer: string | null;
  description: string;
  quantity: number;
  unitUsd: number;
  url: string | null;
  notes: string;
}

/** The design's BOM as quote items, in its areas' order, under "<area> / <group>" sections. */
export function quoteItemsOf(data: DesignData, derived: Derived): ChassisQuoteItem[] {
  const areaLabel = new Map(data.bom.areas.map((area) => [area.id, area.label]));
  const order = data.bom.areas.map((area) => area.id);
  return [...derived.bom.lines]
    .sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area))
    .map((line) => {
      const name = line.part?.name ?? line.partId;
      return {
        lineId: line.id,
        section: `${areaLabel.get(line.area) ?? line.area} / ${line.group}`,
        partNumber: line.part?.sku ?? null,
        manufacturer: line.part?.manufacturer ?? null,
        description: line.scope && line.scope !== name ? `${name}: ${line.scope}` : name,
        quantity: line.qty,
        unitUsd: line.unitCost,
        url: webHref(line.part?.productUrl),
        notes: `${data.project.name} BOM line ${line.id}; cost basis ${line.basis}`,
      };
    });
}
