import "server-only";
import { db } from "@/lib/db";
import { nextMonthStart, runModel, type ModelResult, type StartDate } from "@/features/compute-model/model/engine";
import { DEFAULT_INPUTS, type ModelInputs } from "@/features/compute-model/model/inputs";
import { writeInputParams } from "@/features/compute-model/model/url";
import { toRoomSite } from "./rooms";
import type { RoomSite } from "./types";

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

/** The utility supply a deal is sized on; its critical IT is `mw / pue`. */
export interface FacilityPower {
  mw: number;
  pue: number;
  estimate: boolean;
  note: string;
  sources: DiligenceSource[];
}

/** The facility power the site could grow to beyond what it's sized on today, by diligence's best reading. */
export interface FuturePower {
  mw: number;
  estimate: boolean;
  note: string;
  sources: DiligenceSource[];
}

/** A bank loan against the purchase price plus conversion; equity pays the rest. */
export interface SiteFinancing {
  /** Loan / purchase price plus conversion. */
  ltv: number;
  rate: number;
  /** Level monthly payments over this term; the balance is repaid when the site is sold. */
  amortizationYears: number;
  /** Months of loan payments held in reserve from closing to exit. */
  reserveMonths: number;
  estimate: boolean;
  note: string;
  sources: DiligenceSource[];
}

/** The customer contract the cluster is sold on; merchant rates follow its term. */
export interface GpuContract {
  pricePerGpuHour: number;
  months: number;
  estimate: boolean;
  note: string;
  sources: DiligenceSource[];
}

/** An acquisition's agreed terms. The model starts at closing and the cluster ships when conversion ends. */
export interface AcquisitionTerms {
  facilityPower: FacilityPower;
  /** The model's standard contract when absent. */
  contract?: GpuContract;
  /** Paid at signing and credited against the purchase price. */
  deposit: Money;
  /** YYYY-MM-DD. */
  conditionDate: string;
  /** YYYY-MM-DD. */
  closingDate: string;
  conversionMonths: number;
  financing: SiteFinancing;
}

/** What diligence found for a site ZODE would buy; everything else comes from the compute model. */
export interface PurchaseEconomics {
  purchasePrice: Money;
  /** The total, or per MW of critical IT when `perMw`. */
  conversionCost: Money & { perMw?: boolean };
  /** Absent when `deal` sizes the site by its facility power. */
  criticalItMw?: CriticalIt;
  fx: Fx;
  /** Share of the purchase price recovered at exit; the model's default when absent. */
  siteResidual?: number;
  deal?: AcquisitionTerms;
  futurePower?: FuturePower;
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
  futurePower?: FuturePower;
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
    return [
      ...e.rent.sources,
      ...e.capitalContribution.sources,
      ...e.criticalItMw.sources,
      ...(e.futurePower?.sources ?? []),
    ];
  }
  const e = summary.economics;
  return [
    ...(e.futurePower?.sources ?? []),
    ...e.purchasePrice.sources,
    ...e.conversionCost.sources,
    ...(e.criticalItMw?.sources ?? []),
    ...(e.deal
      ? [
          ...e.deal.facilityPower.sources,
          ...(e.deal.contract?.sources ?? []),
          ...e.deal.deposit.sources,
          ...e.deal.financing.sources,
        ]
      : []),
  ];
}

/** The site's critical IT: as diligence states it, or a deal's facility power over its PUE. */
export function criticalIt(summary: DiligenceSummary): CriticalIt {
  if (summary.kind !== "purchase") return summary.economics.criticalItMw;
  const { deal, criticalItMw } = summary.economics;
  if (!deal) return criticalItMw ?? { value: 0, estimate: true, note: "", sources: [] };
  const power = deal.facilityPower;
  return { value: power.mw / power.pue, estimate: power.estimate, note: power.note, sources: power.sources };
}

export async function hasDiligenceSummary(roomId: string): Promise<boolean> {
  const [row] = await db()`select exists (select 1 from data_room_summaries where room_id = ${roomId}) as found`;
  return Boolean(row.found);
}

/**
 * The room's summary, or null before diligence is written. `sourceNames` maps
 * each cited file that is still live to its current name; `site` is the room's
 * address, when it has one.
 */
export async function getDiligenceSummary(
  roomId: string,
): Promise<(DiligenceSummary & { sourceNames: Map<string, string>; site: RoomSite | null }) | null> {
  const sql = db();
  const [row] = await sql`
    select s.diligence, s.economics, s.updated_at, s.updated_by_email, r.kind, r.address, r.city, r.place_id
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
  return {
    ...summary,
    sourceNames: new Map(files.map((f) => [String(f.id), String(f.name)])),
    site: toRoomSite(row),
  };
}

export interface SummaryEconomics {
  criticalItMw: number;
  nodes: number;
  inputs: ModelInputs;
  result: ModelResult;
  lifetimeRevenue: number;
  /** The forecast's month 0: a deal's closing date, otherwise next month. */
  start: StartDate;
  /** Level monthly payment on the site loan; 0 without one. */
  siteLoanPayment: number;
  /** Cash held from closing to exit against the site loan; 0 without a deal. */
  capitalReserve: number;
  /** All distributions over all equity contributed. */
  equityMultiple: number | null;
  /** UTC milliseconds of the first month distributions have returned the equity paid in. */
  paybackDate: number | null;
  /** The same case, open in the compute model. */
  modelHref: string;
}

export const toUsd = (money: Money, fx: Fx): number | null =>
  money.amount === null ? null : money.currency === "USD" ? money.amount : money.amount * fx.usdPerUnit;

/** A purchase's total conversion in USD, for a site of `itMw` critical IT. */
export function conversionUsd(e: PurchaseEconomics, itMw: number): number | null {
  const usd = toUsd(e.conversionCost, e.fx);
  return usd === null || !e.conversionCost.perMw ? usd : usd * itMw;
}

/** "2026-11-30" as a forecast start. */
const startOn = (date: string): StartDate => {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: month - 1, day };
};

/** Level monthly payment on `loan` at an annual `rate` over `years`. */
const levelPayment = (loan: number, rate: number, years: number) => {
  const r = rate / 12;
  const n = years * 12;
  return loan <= 0 ? 0 : r > 0 ? (loan * r) / (1 - (1 + r) ** -n) : loan / n;
};

/**
 * Runs the standard compute model for the site: as many B300 nodes as its
 * critical IT power carries. A purchase pays its price and conversion upfront
 * with no base lease; a lease or colo pays its rent terms and capital
 * contribution. A purchase with deal terms starts at closing, ships when
 * conversion ends and takes its site loan and capital reserve. Every other
 * input keeps the model's default.
 */
export function summaryEconomics(summary: DiligenceSummary, at?: StartDate): SummaryEconomics {
  const it = criticalIt(summary);
  const nodes = Math.max(0, Math.floor((it.value * 1000) / DEFAULT_INPUTS.kwPerNode));
  // Upfront site spend is charged per MW of the cluster's IT load, so spread the site's total over it.
  const clusterMw = (nodes * DEFAULT_INPUTS.kwPerNode) / 1000;
  const perMw = (usd: number | null) => (clusterMw > 0 ? Math.round((usd ?? 0) / clusterMw) : 0);

  let inputs: ModelInputs;
  let start = at ?? nextMonthStart();
  let siteLoanPayment = 0;
  let capitalReserve = 0;
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
    const e = summary.economics;
    inputs = {
      ...DEFAULT_INPUTS,
      nodes,
      siteMode: 1,
      sitePurchase: Math.round(toUsd(e.purchasePrice, e.fx) ?? 0),
      siteConversionPerMw: perMw(conversionUsd(e, it.value)),
      siteClosingCosts: 0,
      siteLtv: 0,
      siteEquityFee: 0,
      siteResidual: e.siteResidual ?? DEFAULT_INPUTS.siteResidual,
    };
    if (e.deal) {
      const { facilityPower, contract, conversionMonths, financing, closingDate } = e.deal;
      const loan = (inputs.sitePurchase + inputs.siteConversionPerMw * clusterMw) * financing.ltv;
      siteLoanPayment = levelPayment(loan, financing.rate, financing.amortizationYears);
      capitalReserve = Math.round(siteLoanPayment * financing.reserveMonths);
      start = at ?? startOn(closingDate);
      inputs = {
        ...inputs,
        pue: facilityPower.pue,
        contractPrice: contract?.pricePerGpuHour ?? DEFAULT_INPUTS.contractPrice,
        contractMonths: contract?.months ?? DEFAULT_INPUTS.contractMonths,
        shipMonth: conversionMonths,
        leadMonths: Math.min(DEFAULT_INPUTS.leadMonths, conversionMonths),
        siteLtv: financing.ltv,
        siteRate: financing.rate,
        siteAmortizationYears: financing.amortizationYears,
        minCash: DEFAULT_INPUTS.minCash + capitalReserve,
      };
    }
  }

  const result = runModel(inputs, start);
  const { cumulativeEquity, cumulativeDistributions, dates } = result.monthly;
  const paidIn = cumulativeEquity[cumulativeEquity.length - 1];
  const payback = cumulativeDistributions.findIndex((out, m) => m > 0 && out >= cumulativeEquity[m] && cumulativeEquity[m] > 0);
  const params = new URLSearchParams();
  writeInputParams(inputs, params);
  return {
    criticalItMw: it.value,
    nodes,
    inputs,
    result,
    lifetimeRevenue: result.monthly.netRevenue.reduce((total, v) => total + v, 0),
    start,
    siteLoanPayment,
    capitalReserve,
    equityMultiple: paidIn > 0 ? cumulativeDistributions[cumulativeDistributions.length - 1] / paidIn : null,
    paybackDate: payback < 0 ? null : dates[payback],
    modelHref: `/compute-model?${params}`,
  };
}
