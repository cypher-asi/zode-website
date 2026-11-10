/**
 * ZODE's master model, as scripts/write-master-summary.mjs reads it from the
 * workbook in the room: the company's summary at the top of the room, a
 * deployment summary in each project's folder and each owned site's own
 * figures beside its diligence. Nothing here is recomputed on view. Amounts
 * are USD unless a value says otherwise, rates and shares are fractions, dates
 * are YYYY-MM-DD.
 */

export interface MasterFile {
  /** The workbook as it's named in the room. */
  name: string;
  fileId: string;
  path: string;
  /** "Prepared by Ezra for ZODE, Nov 2026." */
  prepared: string;
}

/** How the workbook formats a value, from its cell's number format. */
export type ValueFormat = "usd" | "usdCents" | "pct" | "month" | "number" | "decimal" | "x" | "text";

export interface ModelValue {
  /** A date's value is YYYY-MM-DD; a `text` value is the workbook's literal, such as "No cap". */
  value: number | string;
  format: ValueFormat;
  /** "C$" for an amount the workbook gives in Canadian dollars; USD otherwise. */
  currency?: string;
}

/** A row of yearly values. `total` is null where the workbook adds nothing up, such as balances at year end. */
export interface YearRow {
  label: string;
  values: number[];
  total: number | null;
  unit: "usd" | "mw" | "count";
  kind?: "subtotal";
  /** Part of the row above it. */
  indent?: boolean;
}

export interface YearTable {
  /** "Q4 2026", "2027", ... */
  years: string[];
  groups: { title: string; rows: YearRow[] }[];
}

/** One project SPV, from the Structure tab. */
export interface MasterSpv {
  /** The SPV's tab, e.g. "BigWatt". */
  name: string;
  /** "Toronto SPV (CORE, Mississauga)". */
  entity: string;
  /** "Lease: 1 MW colocation; 512 B300 GPUs; ..." */
  business: string;
  zodeEquity: number;
  thirdPartyPref: number;
  peakDebt: number;
  firstInService: string;
  capitalStack: string;
  /** The project's folder in the room; null for an SPV without one, such as future sites. */
  folderId: string | null;
}

export interface MasterModel {
  model: MasterFile;
  raise: {
    amount: number;
    postMoneyCap: number;
    ownership: number;
    received: string;
    /** "$55M SAFE at a $300M post-money cap". */
    terms: string;
  };
  /** Where the raise goes, as the Summary tab lists it; what's left can be negative. */
  uses: { label: string; amount: number }[];
  /** What ZODE Inc. is and does. */
  topco: string;
  spvs: MasterSpv[];
  structureNotes: string[];
  statement: YearTable;
  /** The workbook's account of itself. */
  overview: string[];
  conventions: string[];
  simplifications: string[];
  openItems: string[];
}

export interface CapacityBlock {
  name: string;
  site: string;
  mw: number;
  inService: string;
}

export interface InputTerm {
  label: string;
  value: ModelValue;
  /** The workbook's note beside the input, such as its source or "Placeholder". */
  note: string;
}

export interface InputGroup {
  /** "Site company" or "Compute companies" where the SPV has both; null otherwise. */
  part: string | null;
  title: string;
  terms: InputTerm[];
}

/** One project SPV's own tab. */
export interface DeploymentModel {
  model: MasterFile;
  spv: MasterSpv;
  /** "Toronto SPV - ZODE GPU cluster at CORE, Mississauga". */
  title: string;
  tenure: "own" | "lease";
  description: string;
  summary: YearTable;
  /** `indent` marks a part of the figure above it, such as its equity from ZODE Inc. */
  keyFigures: { label: string; value: ModelValue; indent?: boolean }[];
  capacity: { title: string; blocks: CapacityBlock[]; totalMw: number };
  inputs: InputGroup[];
  /** The Notes tab's open items and placeholders for this SPV. */
  openItems: string[];
  /** Owned sites with a folder of their own in the room. */
  sites: { name: string; folderId: string }[];
}

/**
 * An owned site's own figures from its SPV's tab. Revenue, debt, equity and
 * returns are modelled for the SPV as a whole, so `spv` carries those, for
 * every site in it together.
 */
export interface MasterSite {
  model: MasterFile;
  name: string;
  purchasePrice: { usd: number; local: number | null; currency: string | null };
  deposit: number;
  closes: string;
  /** The price less the deposit, plus the site's share of closing and transaction costs. */
  balanceAndClosing: number;
  reEnergization: number | null;
  blocks: CapacityBlock[];
  mw: number;
  conversionPerMw: number;
  /** Intercompany rent the compute companies pay the site company. */
  rentPerKwMonth: number;
  /** Deposit, balance and closing, re-energization and conversion; the SPV's shared pre-development isn't in it. */
  siteCost: number;
  spv: {
    name: string;
    folderId: string | null;
    sites: string[];
    mw: number;
    preDevelopment: number;
    siteCost: number;
    revenue: number;
    ebitda: number;
    peakEquity: number;
    zodeEquity: number;
    thirdPartyPref: number;
    peakDebt: number;
    unleveredIrr: number | null;
    firstInService: string;
  };
}
