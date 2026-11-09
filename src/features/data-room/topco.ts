/**
 * A TopCo summary: the company's raise, what it puts into each project SPV and
 * what comes back, as the TopCo workbook computed them.
 * scripts/write-topco-summary.mjs reads them from the workbook in the room;
 * nothing here is recomputed on view. Amounts are USD, rates and shares
 * fractions.
 */

/** One project SPV's results, from the workbook's Summary tab. */
export interface TopCoProject {
  /** The workbook's column for the SPV, e.g. "Retro 1 site". */
  name: string;
  /** "Site company", "GPU OpCos", ... */
  structure: string;
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
  projectIrr: number | null;
  prefIrr: number | null;
  prefMultiple: number | null;
  /** TopCo's pref distributions, common share and fees. */
  cashToTopco: number;
  topcoIrr: number | null;
  topcoMultiple: number | null;
}

export interface TopCoTotal {
  criticalItMw: number;
  projectCost: number;
  debt: number;
  prefNeeded: number;
  topcoPref: number;
  thirdPartyPref: number;
  cashToTopco: number;
}

/** A row of the yearly TopCo cash table, in USD; `total` is null where the workbook sums nothing. */
export interface TopCoCashRow {
  label: string;
  total: number | null;
  values: number[];
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
  /** Where the raise goes: TopCo's operating budget, then pref into each SPV. */
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
  cash: { years: number[]; rows: TopCoCashRow[] };
  team: TopCoHire[];
  /** The workbook's account of itself, as paragraphs and "- " list lines. */
  overview: string;
  notes: string[];
}
