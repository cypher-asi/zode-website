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
  /** Paragraphs separated by blank lines; lines starting with "- " form a list; `**bold**` marks lead-ins. */
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

export interface CriticalIt {
  value: number;
  estimate: boolean;
  note: string;
  sources: DiligenceSource[];
}

export interface Fx {
  currency: string;
  usdPerUnit: number;
  asOf: string;
  source: string;
}

/** What diligence found for a site ZODE would buy; everything else comes from the compute model. */
export interface PurchaseEconomics {
  purchasePrice: Money;
  conversionCost: Money;
  criticalItMw: CriticalIt;
  fx: Fx;
  /** Share of the purchase price recovered at exit; the model's default when absent. */
  siteResidual?: number;
}

/** The lease's running costs, in USD, as the compute model takes them. */
export interface LeaseTerms {
  /** Base rent per critical kW-month. */
  baseLease: number;
  /** Annual base rent escalation. */
  leaseEscalation: number;
  /** NNN pass-through per critical kW-month. */
  nnn: number;
  /** Landlord operations fee per critical kW-month. */
  operations: number;
  /** Utility power per kWh. */
  electricityRate: number;
  pue: number;
  estimate: boolean;
  note: string;
  sources: DiligenceSource[];
}

/** What diligence found for a site ZODE would lease or rent colo space in; everything else comes from the compute model. */
export interface LeaseEconomics {
  rent: LeaseTerms;
  /** Paid to the landlord toward the build-out. */
  capitalContribution: Money;
  criticalItMw: CriticalIt;
  fx: Fx;
}

interface SummaryBase {
  diligence: Record<DiligenceKey, DiligenceItem>;
  updatedAt: string;
  updatedBy: string;
}

/** The room's kind decides which economics its summary holds. */
export type DiligenceSummary = SummaryBase &
  ({ kind: "purchase"; economics: PurchaseEconomics } | { kind: "lease" | "colo"; economics: LeaseEconomics });

/** Every file the economics cite. */
export function economicsSources(summary: DiligenceSummary): DiligenceSource[] {
  if (summary.kind !== "purchase") {
    const e = summary.economics;
    return [...e.rent.sources, ...e.capitalContribution.sources, ...e.criticalItMw.sources];
  }
  const e = summary.economics;
  return [...e.purchasePrice.sources, ...e.conversionCost.sources, ...e.criticalItMw.sources];
}

export async function hasDiligenceSummary(roomId: string): Promise<boolean> {
  const [row] = await db()`select exists (select 1 from data_room_summaries where room_id = ${roomId}) as found`;
  return Boolean(row.found);
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
    select s.diligence, s.economics, s.updated_at, s.updated_by_email, r.kind
    from data_room_summaries s
    join data_rooms r on r.id = s.room_id
    where s.room_id = ${roomId}
  `;
  if (!row) return null;
  const summary = {
    kind: row.kind,
    diligence: row.diligence,
    economics: row.economics,
    updatedAt: new Date(row.updated_at as string).toISOString(),
    updatedBy: String(row.updated_by_email),
  } as DiligenceSummary;

  const ids = [...Object.values(summary.diligence).flatMap((item) => item.sources), ...economicsSources(summary)].map(
    (source) => source.fileId,
  );
  const files = ids.length
    ? await sql`
        select id, name from data_room_files
        where room_id = ${roomId} and deleted_at is null and id = any(${[...new Set(ids)]}::uuid[])
      `
    : [];
  return { ...summary, sourceNames: new Map(files.map((f) => [String(f.id), String(f.name)])) };
}

export interface SummaryEconomics {
  criticalItMw: number;
  nodes: number;
  inputs: ModelInputs;
  result: ModelResult;
  lifetimeRevenue: number;
  /** The same case, open in the compute model. */
  modelHref: string;
}

export const toUsd = (money: Money, fx: Fx): number | null =>
  money.amount === null ? null : money.currency === "USD" ? money.amount : money.amount * fx.usdPerUnit;

/**
 * Runs the standard compute model for the site: as many B300 nodes as its
 * critical IT power carries. A purchase pays its price and conversion upfront
 * with no base lease; a lease or colo pays its rent terms and capital
 * contribution. Every other input keeps the model's default.
 */
export function summaryEconomics(summary: DiligenceSummary, start = nextMonthStart()): SummaryEconomics {
  const e = summary.economics;
  const nodes = Math.max(0, Math.floor((e.criticalItMw.value * 1000) / DEFAULT_INPUTS.kwPerNode));
  // Upfront site spend is charged per MW of the cluster's IT load, so spread the site's total over it.
  const clusterMw = (nodes * DEFAULT_INPUTS.kwPerNode) / 1000;
  const perMw = (usd: number | null) => (clusterMw > 0 ? Math.round((usd ?? 0) / clusterMw) : 0);

  let inputs: ModelInputs;
  if (summary.kind !== "purchase") {
    const { rent, capitalContribution, fx } = summary.economics;
    inputs = {
      ...DEFAULT_INPUTS,
      nodes,
      siteMode: 0,
      baseLease: rent.baseLease,
      leaseEscalation: rent.leaseEscalation,
      nnn: rent.nnn,
      operations: rent.operations,
      electricityRate: rent.electricityRate,
      pue: rent.pue,
      leaseContributionPerMw: perMw(toUsd(capitalContribution, fx)),
    };
  } else {
    const { purchasePrice, conversionCost, fx, siteResidual } = summary.economics;
    inputs = {
      ...DEFAULT_INPUTS,
      nodes,
      siteMode: 1,
      sitePurchase: Math.round(toUsd(purchasePrice, fx) ?? 0),
      siteConversionPerMw: perMw(toUsd(conversionCost, fx)),
      siteClosingCosts: 0,
      siteLtv: 0,
      siteEquityFee: 0,
      siteResidual: siteResidual ?? DEFAULT_INPUTS.siteResidual,
    };
  }

  const result = runModel(inputs, start);
  const params = new URLSearchParams();
  writeInputParams(inputs, params);
  return {
    criticalItMw: e.criticalItMw.value,
    nodes,
    inputs,
    result,
    lifetimeRevenue: result.monthly.netRevenue.reduce((total, v) => total + v, 0),
    modelHref: `/compute-model?${params}`,
  };
}
