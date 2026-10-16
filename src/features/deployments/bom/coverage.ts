import type { PartKind } from "@/features/cluster/model/types";
import type { ResolvedConfig } from "../config/catalog";
import type { Sizing } from "./sizing";
import { requiredSlots, slotById, SLOTS, viewSlot, type SlotSection, type SlotView } from "./slots";
import { lineUsd, type BomLine } from "./types";

export type CoverageStatus = "missing" | "short" | "covered" | "over";

export const STATUS_LABELS: Record<CoverageStatus, string> = {
  missing: "Missing",
  short: "Short",
  covered: "Covered",
  over: "More than needed",
};

export interface SlotCoverage extends SlotView {
  /** What the phase needs; 0 for a slot its configuration leaves out that lines fill anyway. */
  required: number;
  filled: number;
  status: CoverageStatus;
  /** The lines filling it, in BOM order. */
  lines: BomLine[];
  usd: number;
}

export interface PhaseCoverage {
  /** Every slot the phase needs, then any other slot a line fills, in section order. */
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

function statusOf(row: Pick<SlotCoverage, "slot" | "required" | "filled">): CoverageStatus {
  const { slot, required, filled } = row;
  if (filled <= EPSILON) return "missing";
  if (slot.unit === "lot" && required > 0) return "covered";
  if (filled < required - EPSILON) return "short";
  return filled > required + EPSILON ? "over" : "covered";
}

const ORDER = new Map(SLOTS.map((slot, i) => [slot.id, i]));

/** How one phase's BOM `lines` fill the slots its `sizing` and configuration `c` need. */
export function phaseCoverage(sizing: Sizing, c: ResolvedConfig, lines: readonly BomLine[]): PhaseCoverage {
  const needs = new Map(requiredSlots(sizing, c).map((row) => [row.slot.id, row]));
  const ids = new Set([...needs.keys(), ...lines.flatMap((line) => (line.slotId && slotById(line.slotId) ? [line.slotId] : []))]);
  const slots = [...ids]
    .sort((a, b) => ORDER.get(a)! - ORDER.get(b)!)
    .map((id): SlotCoverage => {
      const need = needs.get(id);
      const view = need ?? viewSlot(slotById(id)!, c, sizing);
      const filling = lines.filter((line) => line.slotId === id);
      const row = {
        ...view,
        required: need?.qty ?? 0,
        filled: filling.reduce((sum, line) => sum + line.quantity, 0),
        lines: filling,
        usd: filling.reduce((sum, line) => sum + lineUsd(line), 0),
      };
      return { ...row, status: statusOf(row) };
    });

  const other = lines.filter((line) => !line.slotId || !slotById(line.slotId));
  const sectionUsd = new Map<SlotSection | "other", number>();
  for (const row of slots) sectionUsd.set(row.slot.section, (sectionUsd.get(row.slot.section) ?? 0) + row.usd);
  if (other.length) sectionUsd.set("other", other.reduce((sum, line) => sum + lineUsd(line), 0));

  const counts: Record<CoverageStatus, number> = { missing: 0, short: 0, covered: 0, over: 0 };
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

/** What `slot` still needs once the `others` lines in it are counted; null for a lot. */
export function stillNeeded(row: Pick<SlotCoverage, "slot" | "required">, others: readonly Pick<BomLine, "quantity">[]): number | null {
  if (row.slot.unit === "lot") return null;
  return Math.max(row.required - others.reduce((sum, line) => sum + line.quantity, 0), 0);
}

/** The worst status of any slot standing for each kind of part, for the 3D view. */
export function partStatuses(coverage: PhaseCoverage): Map<PartKind, CoverageStatus> {
  const rank: Record<CoverageStatus, number> = { covered: 0, over: 1, short: 2, missing: 3 };
  const out = new Map<PartKind, CoverageStatus>();
  for (const row of coverage.slots) {
    if (row.slot.optional && row.status === "missing") continue;
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
