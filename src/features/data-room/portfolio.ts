/**
 * A portfolio summary: one model's results across the sites it holds, as the
 * workbook computed them. scripts/write-portfolio-summary.mjs reads them from
 * the workbook in the room; nothing here is recomputed on view. Amounts are
 * USD, rates and shares fractions, dates YYYY-MM-DD.
 */

/** One site's results, or the total across them, from the model's key metrics. */
export interface PortfolioMetrics {
  /** The sponsor's facility power, which the workbook labels critical IT; IT load is this over PUE. */
  facilityMw: number;
  zodeMw: number;
  thirdPartyMw: number;
  clusters: number;
  firstReady: string | null;
  lastReady: string | null;
  /** The data center company: buys, converts and leases the site. */
  acquisitionAndConversion: number;
  runRateNoi: number;
  yieldOnCost: number | null;
  reDebtPeak: number;
  reDscrMin: number | null;
  siteEquity: number;
  unleveredIrr: number | null;
  siteEquityIrr: number | null;
  siteEquityMultiple: number | null;
  exitValue: number;
  /** The compute companies, one per ZODE cluster, over every GPU generation. */
  gpuHardware: number;
  prepayments: number;
  gpuDebt: number;
  gpuDscrMin: number | null;
  rentPaid: number;
  computeEquity: number;
  computeEquityIrr: number | null;
  computeEquityMultiple: number | null;
}

/** What a site's acquisition and conversion take, from the model's inputs. */
export interface PortfolioSiteTerms {
  purchasePrice: number;
  deposit: number;
  depositDate: string;
  closeDate: string;
  preDevelopment: number;
  closingCosts: number;
  conversionPerMw: number;
  utilityUpgrade: number;
  /** IT load if the seller data rooms' power is all there is. */
  diligenceItMw: number;
  /** Further power the site could add, off unless `included`. */
  expansion: { mw: number; included: boolean; cost: number; note: string } | null;
}

export interface PortfolioSite {
  /** The workbook's column for the site, e.g. "Olds". */
  name: string;
  address: string;
  /** The site's folder in the room, when it has one. */
  folderId: string | null;
  folderPath: string | null;
  metrics: PortfolioMetrics;
  terms: PortfolioSiteTerms;
}

/** Terms every site shares in the base case. */
export interface PortfolioTerms {
  rentPerKwMonth: number;
  contractPricePerGpuHour: number;
  contractMonths: number;
  prepaymentShare: number;
  gpusPerCluster: number;
  pue: number;
  acquisitionLoan: number;
  constructionLoan: number;
  reRate: number;
  gpuRate: number;
  gpuDscr: number;
  gpuMaxLtc: number;
  exitCapRate: number;
  exitDate: string;
  scheduleDelayMonths: number;
}

/** An investor class's terms: a preferred return, then tiers of the cash after it. */
export interface TermSet {
  name: string;
  investorShare: number;
  prefReturn: number;
  compounds: boolean;
  minMultiple: number;
  shareUntilPaid: number;
  tier1Share: number;
  tier1Until: number;
  tier2Share: number;
}

export interface InvestorReturns {
  terms: TermSet;
  capital: number;
  received: number;
  irr: number | null;
  multiple: number | null;
  profitShare: number;
}

/** Where the money comes from and goes, from the first month to the last block ready. */
export interface SourcesAndUses {
  through: string | null;
  sources: {
    siteEquity: number;
    computeEquity: number;
    reDebt: number;
    gpuDebt: number;
    prepayments: number;
    operating: number;
    other: number;
  };
  uses: { label: string; amount: number }[];
}

export type CaseFormat = "months" | "usd" | "usdPerMw" | "kwMonth" | "gpuHour" | "pct" | "x" | "mw";

/** A stored table of downside, base and upside runs. */
export interface CaseTable {
  title: string;
  facilityMw: number;
  assumptions: { label: string; format: CaseFormat; values: [number, number, number] }[];
  results: { label: string; format: CaseFormat; values: [number, number, number] }[];
  notes: string[];
}

export interface ExitRow {
  label: string;
  siteIrr: number;
  siteMultiple: number;
  computeIrr: number;
  minReDscr: number;
}

export interface DebtSizingRow {
  label: string;
  siteCapital: number;
  reDebtPeak: number;
  siteIrr: number;
  siteMultiple: number;
  minReDscr: number;
}

export interface PortfolioModel {
  model: {
    /** The workbook as it's named in the room. */
    name: string;
    fileId: string;
    path: string;
    title: string;
    description: string;
    prepared: string;
    caseLine: string;
    start: string;
  };
  sites: PortfolioSite[];
  total: PortfolioMetrics;
  terms: PortfolioTerms;
  sourcesAndUses: SourcesAndUses;
  investors: { site: InvestorReturns; compute: InvestorReturns; zodeCoInvest: number };
  cases: CaseTable;
  exits: { rows: ExitRow[]; note: string };
  debtSizing: { rows: DebtSizingRow[]; note: string };
}
