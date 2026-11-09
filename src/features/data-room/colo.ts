/**
 * A colo summary: one deployment of a ZODE Colo model, GPU compute companies
 * in leased colocation space, as the workbook computed it, beside the program
 * it's pooled in. scripts/write-colo-summary.mjs reads it from the workbook in
 * the room; nothing here is recomputed on view. Amounts are USD, rates and
 * shares fractions, dates YYYY-MM-DD.
 */

/** A deployment's results, or the program's pooled across them, from the workbook's Summary tab. */
export interface ColoMetrics {
  criticalItMw: number;
  clusters: number;
  signedClusters: number;
  gpus: number;
  firstInService: string;
  lastInService: string;
  contractValue: number;
  prepayments: number;
  /** Contract and merchant revenue over the model's life. */
  lifetimeRevenue: number;
  leaseUpfront: number;
  /** GPU hardware, spares, tax and setup. */
  gpuHardware: number;
  gpuDebt: number;
  gpuDscrMin: number | null;
  receivablePeak: number;
  peakEquity: number;
  peakEquityDate: string;
  /** Equity needed by a date, e.g. "Jan-27 (first 3 months)". */
  equityBy: { label: string; amount: number }[];
  unleveredIrr: number | null;
  /** Null where the workbook reads n.m.: equity comes back before much goes in. */
  equityIrr: number | null;
  equityMultiple: number | null;
  netCash: number;
}

/** One GPU cluster, its own compute company. */
export interface ColoCluster {
  name: string;
  nodes: number;
  gpus: number;
  criticalItMw: number;
  signed: boolean;
  inService: string;
}

export interface ColoDeployment {
  /** The workbook's column for it, e.g. "Mississauga". */
  name: string;
  description: string;
  metrics: ColoMetrics;
  clusters: ColoCluster[];
  lease: {
    /** Per kW-month of critical IT. */
    baseRent: number;
    nnn: number;
    operations: number;
    /** Per kWh. */
    electricity: number;
    pue: number;
    /** Annual escalation of lease, power and operating costs. */
    escalation: number;
    nrc: number;
    legal: number;
    salesTax: number;
  };
  /** Signed clusters' terms, and the target the others are priced at. */
  contract: { price: number; months: number; prepayment: number };
  target: { price: number; months: number; prepayment: number };
  gpu: {
    serverCost: number;
    gpusPerNode: number;
    networking: number;
    deposit: number;
    rate: number;
    tenorMonths: number;
    dscr: number;
    maxLtc: number;
    reserve: number;
  };
  after: { months: number; price: number; utilization: number; resale: number };
  /** The deployment's own tab, calendar year by year; `total` is null where the workbook sums nothing. */
  annual: {
    /** What the first and last years cover, e.g. "2026 = Nov-Dec only; 2036 = Jan-Oct". */
    note: string;
    years: number[];
    rows: { label: string; total: number | null; values: number[] }[];
  };
}

export interface ColoModel {
  model: {
    /** The workbook as it's named in the room. */
    name: string;
    fileId: string;
    path: string;
    /** "ZODE Colo I". */
    title: string;
    prepared: string;
    /** "Base case | exit: hold ...". */
    caseLine: string;
  };
  deployment: ColoDeployment;
  program: {
    description: string;
    deployments: { name: string; criticalItMw: number; clusters: number; unleveredIrr: number | null; peakEquity: number }[];
    total: ColoMetrics;
    investors: {
      termSet: string;
      capital: number;
      received: number;
      irr: number | null;
      multiple: number | null;
      firstCash: string;
    };
  };
  /** The stored raise cases that include the deployment, e.g. "Mississauga 64 nodes only (the first close)". */
  cases: {
    /** Column headings, units dropped into `format`. */
    head: { label: string; format: "mw" | "usd" | "pct" | "x" }[];
    rows: { label: string; values: (number | null)[] }[];
  };
  notes: string[];
}
