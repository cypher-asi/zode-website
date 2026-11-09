/**
 * A TopCo summary: the company's raise, what it puts into each project SPV and
 * what comes back, as the TopCo workbook computed them.
 * scripts/write-topco-summary.mjs reads them from the workbook in the room;
 * nothing here is recomputed on view. Amounts are USD, rates and shares
 * fractions.
 */

/** One of a project's SPVs; `layer` tells it from the others, such as "site" or "compute", and is blank for a project's only SPV. */
export interface TopCoSpv {
  /** The workbook's column for the SPV, e.g. "Retro 1 site". */
  name: string;
  layer: string;
  /** "Site company", "GPU OpCos", ... */
  structure: string;
}

/**
 * Debt and pref by what they pay for. The workbook sizes debt on each year's
 * cost, so the script splits each year's draws and equity by that year's mix
 * of site acquisition, conversion and GPU costs.
 */
export interface TopCoCapital {
  site: { pref: number; debt: number };
  conversion: { pref: number; debt: number };
  gpu: { pref: number; debt: number };
}

/**
 * A project's results, from the workbook's Summary tab: the sum of its SPVs'
 * amounts, and their rates side by side, since those don't add up. TopCo's
 * IRR is on its yearly cash from all of them together.
 */
export interface TopCoProject {
  /** "Calgary". */
  name: string;
  /** Whether the project owns its site or leases space in someone else's. */
  tenure: "own" | "lease";
  spvs: TopCoSpv[];
  /** The project's folder in the room, when it has one. */
  folderId: string | null;
  folderPath: string | null;
  criticalItMw: number;
  /** Total project cost to the model's last year, GPU refreshes included. */
  projectCost: number;
  debt: number;
  prefNeeded: number;
  topcoPref: number;
  thirdPartyPref: number;
  /** By SPV. */
  projectIrr: { layer: string; value: number | null }[];
  pref: { layer: string; irr: number | null; multiple: number | null }[];
  /** TopCo's pref distributions, common share and fees. */
  cashToTopco: number;
  topcoIrr: number | null;
  topcoMultiple: number | null;
  capital: TopCoCapital;
}

export interface TopCoTotal {
  criticalItMw: number;
  projectCost: number;
  debt: number;
  prefNeeded: number;
  topcoPref: number;
  thirdPartyPref: number;
  cashToTopco: number;
  capital: TopCoCapital;
}

/** A row of the consolidated statement, in USD, inflows positive; or capacity in MW at each year end, with no total. */
export interface TopCoStatementRow {
  label: string;
  values: number[];
  total: number | null;
  kind?: "subtotal";
  unit?: "mw";
}

/**
 * The SPVs at 100% and TopCo as one, year by year, with fees to TopCo and rent
 * between a project's own companies left out. A cash model: no depreciation or tax.
 */
export interface TopCoStatement {
  years: number[];
  groups: { title: string; rows: TopCoStatementRow[] }[];
}

export interface TopCoHire {
  role: string;
  headcount: number;
  salary: number;
  startYear: number;
}

export interface TopCoModel {
  model: {
    /** The workbook as it's named in the room. */
    name: string;
    fileId: string;
    path: string;
    /** "ZODE TopCo". */
    title: string;
    prepared: string;
  };
  raise: {
    amount: number;
    preMoney: number;
    postMoney: number;
    ownership: number;
    closeYear: number;
    /** Cash TopCo keeps before distributing to its shareholders. */
    minCash: number;
  };
  /** Where the raise goes: TopCo's operating budget, then pref into each project. */
  uses: { label: string; amount: number; note: string }[];
  projects: TopCoProject[];
  total: TopCoTotal;
  returns: {
    preSeedIrr: number | null;
    preSeedMultiple: number | null;
    lowestCash: number;
    budgetYears: number;
    /** The model's last year, through which distributions count. */
    through: number;
  };
  statement: TopCoStatement;
  team: TopCoHire[];
  /** The workbook's account of itself, as paragraphs and "- " list lines. */
  overview: string;
  notes: string[];
}
