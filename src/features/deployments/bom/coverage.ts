import { requiredSlots, slotById, type Slot, type SlotSection } from "@/features/cluster/model/slots";
import type { ClusterModel, PartKind } from "@/features/cluster/model/types";
import { lineUsd, type BomItem } from "./types";

export type CoverageStatus = "missing" | "short" | "covered" | "over";

export const STATUS_LABELS: Record<CoverageStatus, string> = {
  missing: "Missing",
  short: "Short",
  covered: "Covered",
  over: "More than needed",
};

export interface SlotCoverage {
  slot: Slot;
  required: number;
  filled: number;
  status: CoverageStatus;
  /** The lines filling it, each with the slot units it brings. */
  lines: { item: BomItem; units: number }[];
}

export interface PhaseCoverage {
  slots: SlotCoverage[];
  /** Lines in use that fill no slot this cluster needs. */
  unslotted: BomItem[];
  excluded: BomItem[];
  totalUsd: number;
  /** Each line counted in the section of the first slot it fills, or "other". */
  sectionUsd: Map<SlotSection | "other", number>;
  /** Slots that aren't optional and are missing or short. */
  gaps: number;
  counts: Record<CoverageStatus, number>;
}

const EPSILON = 1e-6;

function statusOf(slot: Slot, required: number, filled: number): CoverageStatus {
  if (filled <= EPSILON) return "missing";
  if (slot.unit === "lot") return "covered";
  if (filled < required - EPSILON) return "short";
  return filled > required + EPSILON ? "over" : "covered";
}

/**
 * How the BOM lines of one phase (`items`) fill the slots its cluster
 * `model`, `copies` times over, needs. Excluded lines fill nothing.
 */
export function phaseCoverage(model: ClusterModel, copies: number, items: readonly BomItem[]): PhaseCoverage {
  const required = requiredSlots(model, copies);
  const needed = new Set(required.map((row) => row.slot.id));
  const inUse = items.filter((item) => item.status === "use");
  const slots = required.map(({ slot, qty }) => {
    const lines = inUse.flatMap((item) =>
      item.fills
        .filter((fill) => fill.slotId === slot.id)
        .map((fill) => ({ item, units: item.quantity * fill.unitsPerItem })),
    );
    const filled = lines.reduce((sum, line) => sum + line.units, 0);
    return { slot, required: qty, filled, status: statusOf(slot, qty, filled), lines };
  });

  const sectionUsd = new Map<SlotSection | "other", number>();
  for (const item of inUse) {
    const first = item.fills.find((fill) => needed.has(fill.slotId));
    const section = first ? slotById(first.slotId)!.section : "other";
    sectionUsd.set(section, (sectionUsd.get(section) ?? 0) + lineUsd(item));
  }

  const counts: Record<CoverageStatus, number> = { missing: 0, short: 0, covered: 0, over: 0 };
  for (const row of slots) counts[row.status] += 1;
  return {
    slots,
    unslotted: inUse.filter((item) => !item.fills.some((fill) => needed.has(fill.slotId))),
    excluded: items.filter((item) => item.status === "excluded"),
    totalUsd: inUse.reduce((sum, item) => sum + lineUsd(item), 0),
    sectionUsd,
    gaps: slots.filter((row) => !row.slot.optional && (row.status === "missing" || row.status === "short")).length,
    counts,
  };
}

/** The worst status of any slot standing for each kind of part, for the 3D view. */
export function partStatuses(coverage: PhaseCoverage): Map<PartKind, CoverageStatus> {
  const rank: Record<CoverageStatus, number> = { covered: 0, over: 1, short: 2, missing: 3 };
  const out = new Map<PartKind, CoverageStatus>();
  for (const row of coverage.slots) {
    for (const kind of row.slot.kinds ?? []) {
      const prev = out.get(kind);
      if (!prev || rank[row.status] > rank[prev]) out.set(kind, row.status);
    }
  }
  return out;
}

/** Every slot standing for parts of `kind`. */
export const slotsForKind = (coverage: PhaseCoverage, kind: PartKind): SlotCoverage[] =>
  coverage.slots.filter((row) => row.slot.kinds?.includes(kind));
