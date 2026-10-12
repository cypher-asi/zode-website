import "server-only";
import { db } from "@/lib/db";
import { nextMonthStart, runModel, type ModelResult } from "@/features/compute-model/model/engine";
import { DEFAULT_INPUTS, type ModelInputs } from "@/features/compute-model/model/inputs";
import { writeInputParams } from "@/features/compute-model/model/url";

/** The diligence questions every room's summary answers, in display order. */
export const DILIGENCE_FIELDS = [
  { key: "location", label: "Location" },
  { key: "power", label: "Power" },
  { key: "powerNow", label: "Power now" },
  { key: "powerScaling", label: "Scaling power" },
  { key: "zoning", label: "Zoning" },
  { key: "fiber", label: "Fiber" },
  { key: "moratorium", label: "Moratorium risk" },
  { key: "conversion", label: "Conversion" },
] as const;

export type DiligenceKey = (typeof DILIGENCE_FIELDS)[number]["key"];

/** Confirmed: records in the room. Claimed: the seller says so. Gap: nothing either way. Risk: a known concern. */
export type DiligenceStatus = "confirmed" | "claimed" | "gap" | "risk";

export const STATUS_LABELS: Record<DiligenceStatus, string> = {
  confirmed: "Confirmed",
  claimed: "Claimed",
  gap: "Gap",
  risk: "Risk",
};

/** A room file cited as evidence. The upsert script resolves `path` to `fileId`. */
export interface DiligenceSource {
  path: string;
  fileId: string;
}

export interface DiligenceItem {
  headline: string;
  detail: string;
  status: DiligenceStatus;
  sources: DiligenceSource[];
}

export interface Money {
  /** In `currency`; null when nothing in the room or the market supports a figure. */
  amount: number | null;
  currency: string;
  estimate: boolean;
  note: string;
  sources: DiligenceSource[];
}

/** What diligence found; everything else the economics show comes from the compute model. */
export interface SiteEconomics {
  purchasePrice: Money;
  conversionCost: Money;
  criticalItMw: { value: number; estimate: boolean; note: string; sources: DiligenceSource[] };
  fx: { currency: string; usdPerUnit: number; asOf: string; source: string };
  /** Share of the purchase price recovered at exit; the model's default when absent. */
  siteResidual?: number;
}

export interface DiligenceSummary {
  diligence: Record<DiligenceKey, DiligenceItem>;
  economics: SiteEconomics;
  updatedAt: string;
  updatedBy: string;
}

/**
 * The room's summary, or null before diligence is written. `sourceNames` maps
 * each cited file that is still live to its current name.
 */
export async function getDiligenceSummary(
  roomId: string,
): Promise<(DiligenceSummary & { sourceNames: Map<string, string> }) | null> {
  const sql = db();
  const [row] = await sql`
    select diligence, economics, updated_at, updated_by_email from data_room_summaries where room_id = ${roomId}
  `;
  if (!row) return null;
  const summary: DiligenceSummary = {
    diligence: row.diligence as DiligenceSummary["diligence"],
    economics: row.economics as SiteEconomics,
    updatedAt: new Date(row.updated_at as string).toISOString(),
    updatedBy: String(row.updated_by_email),
  };

  const ids = [
    ...Object.values(summary.diligence).flatMap((item) => item.sources),
    ...summary.economics.purchasePrice.sources,
    ...summary.economics.conversionCost.sources,
    ...summary.economics.criticalItMw.sources,
  ].map((source) => source.fileId);
  const files = ids.length
    ? await sql`
        select id, name from data_room_files
        where room_id = ${roomId} and deleted_at is null and id = any(${[...new Set(ids)]}::uuid[])
      `
    : [];
  return { ...summary, sourceNames: new Map(files.map((f) => [String(f.id), String(f.name)])) };
}

export interface SummaryEconomics {
  purchaseUsd: number | null;
  conversionUsd: number | null;
  criticalItMw: number;
  nodes: number;
  inputs: ModelInputs;
  result: ModelResult;
  lifetimeRevenue: number;
  /** The same case, open in the compute model. */
  modelHref: string;
}

const toUsd = (money: Money, fx: SiteEconomics["fx"]): number | null =>
  money.amount === null ? null : money.currency === "USD" ? money.amount : money.amount * fx.usdPerUnit;

/**
 * Runs the standard compute model for the site as owned: as many B300 nodes as
 * its critical IT power carries, purchase and conversion as upfront capex, no
 * base lease. Every other input keeps the model's default.
 */
export function summaryEconomics(e: SiteEconomics, start = nextMonthStart()): SummaryEconomics {
  const purchaseUsd = toUsd(e.purchasePrice, e.fx);
  const conversionUsd = toUsd(e.conversionCost, e.fx);
  const nodes = Math.max(0, Math.floor((e.criticalItMw.value * 1000) / DEFAULT_INPUTS.kwPerNode));
  // Conversion is charged per MW of the cluster's IT load, so spread the site's total over it.
  const clusterMw = (nodes * DEFAULT_INPUTS.kwPerNode) / 1000;
  const inputs: ModelInputs = {
    ...DEFAULT_INPUTS,
    nodes,
    siteMode: 1,
    sitePurchase: Math.round(purchaseUsd ?? 0),
    siteConversionPerMw: clusterMw > 0 ? Math.round((conversionUsd ?? 0) / clusterMw) : 0,
    siteClosingCosts: 0,
    siteLtv: 0,
    siteEquityFee: 0,
    siteResidual: e.siteResidual ?? DEFAULT_INPUTS.siteResidual,
  };
  const result = runModel(inputs, start);
  const params = new URLSearchParams();
  writeInputParams(inputs, params);
  return {
    purchaseUsd,
    conversionUsd,
    criticalItMw: e.criticalItMw.value,
    nodes,
    inputs,
    result,
    lifetimeRevenue: result.monthly.netRevenue.reduce((total, v) => total + v, 0),
    modelHref: `/compute-model?${params}`,
  };
}
