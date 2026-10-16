import { requiredSlots, slotById, SLOTS, type Slot, type SlotSection } from "@/features/cluster/model/slots";
import type { ClusterModel, PartKind } from "@/features/cluster/model/types";
import { lineUsd, type BomLine } from "./types";

/** "unchecked" is a slot's on a phase the cluster builder has no rack for, so nothing says what it needs. */
export type CoverageStatus = "missing" | "short" | "covered" | "over" | "unchecked";

export const STATUS_LABELS: Record<CoverageStatus, string> = {
  missing: "Missing",
  short: "Short",
  covered: "Covered",
  over: "More than needed",
  unchecked: "Not checked",
};

export interface SlotCoverage {
  slot: Slot;
  /** What the cluster needs; null when there's no cluster to say. */
  required: number | null;
  filled: number;
  status: CoverageStatus;
  /** The lines filling it, in BOM order. */
  lines: BomLine[];
  usd: number;
}

export interface PhaseCoverage {
  /** Every slot the cluster needs, then any other slot a line fills, in section order. */
  slots: SlotCoverage[];
  /** Lines that fill no slot. */
  other: BomLine[];
  totalUsd: number;
  sectionUsd: Map<SlotSection | "other", number>;
  /** Slots that aren't optional and are missing or short. */
  gaps: number;
  counts: Record<CoverageStatus, number>;
}

const EPSILON = 1e-6;

function statusOf(slot: Slot, required: number | null, filled: number): CoverageStatus {
  if (required === null) return "unchecked";
  if (filled <= EPSILON) return "missing";
  if (slot.unit === "lot") return "covered";
  if (filled < required - EPSILON) return "short";
  return filled > required + EPSILON ? "over" : "covered";
}

const ORDER = new Map(SLOTS.map((slot, i) => [slot.id, i]));

/**
 * How one phase's BOM `lines` fill the slots its cluster `model`, `copies`
 * times over, needs. With no model (a platform the builder has no rack for),
 * the lines are grouped by slot with nothing to check them against.
 */
export function phaseCoverage(model: ClusterModel | null, copies: number, lines: readonly BomLine[]): PhaseCoverage {
  const required = new Map((model ? requiredSlots(model, copies) : []).map((row) => [row.slot.id, row.qty]));
  const ids = new Set([...required.keys(), ...lines.flatMap((line) => (line.slotId && slotById(line.slotId) ? [line.slotId] : []))]);
  const slots = [...ids]
    .sort((a, b) => ORDER.get(a)! - ORDER.get(b)!)
    .map((id) => {
      const slot = slotById(id)!;
      const filling = lines.filter((line) => line.slotId === id);
      const filled = filling.reduce((sum, line) => sum + line.quantity, 0);
      const need = model ? (required.get(id) ?? 0) : null;
      return {
        slot,
        required: need,
        filled,
        status: statusOf(slot, need, filled),
        lines: filling,
        usd: filling.reduce((sum, line) => sum + lineUsd(line), 0),
      };
    });

  const other = lines.filter((line) => !line.slotId || !slotById(line.slotId));
  const sectionUsd = new Map<SlotSection | "other", number>();
  for (const row of slots) sectionUsd.set(row.slot.section, (sectionUsd.get(row.slot.section) ?? 0) + row.usd);
  if (other.length) sectionUsd.set("other", other.reduce((sum, line) => sum + lineUsd(line), 0));

  const counts: Record<CoverageStatus, number> = { missing: 0, short: 0, covered: 0, over: 0, unchecked: 0 };
  for (const row of slots) counts[row.status] += 1;
  return {
    slots,
    other,
    totalUsd: lines.reduce((sum, line) => sum + lineUsd(line), 0),
    sectionUsd,
    gaps: slots.filter((row) => !row.slot.optional && (row.status === "missing" || row.status === "short")).length,
    counts,
  };
}

/** What `slot` still needs once the `others` lines in it are counted; null when nothing says. */
export function stillNeeded(row: Pick<SlotCoverage, "slot" | "required">, others: readonly Pick<BomLine, "quantity">[]): number | null {
  if (row.required === null || row.slot.unit === "lot") return null;
  return Math.max(row.required - others.reduce((sum, line) => sum + line.quantity, 0), 0);
}

/** The worst status of any slot standing for each kind of part, for the 3D view. */
export function partStatuses(coverage: PhaseCoverage): Map<PartKind, CoverageStatus> {
  const rank: Record<CoverageStatus, number> = { unchecked: 0, covered: 0, over: 1, short: 2, missing: 3 };
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
