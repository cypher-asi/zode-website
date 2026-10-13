/**
 * Third-party research behind the deck's market and policy slides, as of
 * `AS_OF`. Figures are the publishers' own; anything ZODE derives from them
 * is labelled as such where it's drawn.
 */

export const AS_OF = "October 13, 2026";

export interface Source {
  readonly publisher: string;
  readonly title: string;
  readonly date: string;
  readonly url?: string;
  /** Where a paywalled report's figures were read, e.g. "via Blockspace". */
  readonly via?: string;
}

export const SOURCES = {
  bnef: {
    publisher: "BloombergNEF",
    title: "Six things to know about BNEF's new US data center capacity outlook",
    date: "July 21, 2026",
    url: "https://about.bnef.com/insights/data-centers/six-things-to-know-about-bnefs-new-us-data-center-capacity-outlook/",
  },
  utilityDive: {
    publisher: "Utility Dive",
    title: "BNEF chip-based model pegs US data center demand at 207 GW by 2033",
    date: "July 28, 2026",
    url: "https://www.utilitydive.com/news/bnef-chip-based-model-pegs-us-2033-data-center-demand-at-up-to-200-gw/825910/",
  },
  epri: {
    publisher: "EPRI",
    title: "Powering Intelligence 2026: updated U.S. data center scenarios",
    date: "February 2026",
    url: "https://powering-intelligence.epri.com/executive-summary.html",
  },
  morganStanley: {
    publisher: "Morgan Stanley Research",
    title: "Racking up the power shortfall",
    date: "September 21, 2026",
    url: "https://blockspace.media/insight/morgan-stanley-data-center-shortfall/",
    via: "via Blockspace",
  },
  cbre: {
    publisher: "CBRE",
    title: "North America data center trends H1 2026",
    date: "August 27, 2026",
    url: "https://www.cbre.com/insights/books/north-america-data-center-trends-h1-2026",
  },
  jll: {
    publisher: "JLL",
    title: "North America data center report, midyear 2026",
    date: "August 11, 2026",
    url: "https://www.jll.com/en-us/newsroom/data-center-demand-exceeds-expectations-in-h1-2026",
  },
  ncsl: {
    publisher: "NCSL",
    title: "Which states are banning data centers?",
    date: "2026",
    url: "https://www.ncsl.org/fiscal/which-states-are-banning-data-centers",
  },
  newYork: {
    publisher: "New York State",
    title: "Executive Order No. 62: temporary moratorium on data centers",
    date: "July 14, 2026",
    url: "https://www.governor.ny.gov/executive-order/no-62-establishing-temporary-moratorium-data-centers-new-york-while-state-develops",
  },
  oregon: {
    publisher: "Oregon Governor's Office",
    title: "Governor Kotek pauses work on requests for state land to support new data centers",
    date: "September 8, 2026",
    url: "https://apps.oregon.gov/oregon-newsroom/OR/GOV/Posts/Post/governor-kotek-pauses-work-on-requests-for-state-land-to-support-new-data-centers",
  },
  dataCenterWatch: {
    publisher: "Data Center Watch",
    title: "U.S. data center opposition blocks $68B in Q2 projects",
    date: "September 21, 2026",
    url: "https://www.bisnow.com/news/national/data-center-community-relations/community-backlash-upends-billions-of-dollars-in-new-data-center-projects",
    via: "via Bisnow",
  },
  capex: {
    publisher: "Amazon, Microsoft, Alphabet and Meta",
    title: "2026 capital expenditure guidance",
    date: "2026",
  },
  zodePricing: {
    publisher: "ZODE",
    title: "Market pricing for B300 capacity on 24–60 month terms",
    date: "2026",
  },
  googleTokens: {
    publisher: "Google",
    title: "Google I/O 2026: Sundar Pichai's opening keynote",
    date: "May 19, 2026",
    url: "https://blog.google/innovation-and-ai/sundar-pichai-io-2026/",
  },
  goldmanTokens: {
    publisher: "Goldman Sachs Research",
    title: "AI agents forecast to boost tech cash flow as usage soars",
    date: "May 2026",
    url: "https://www.goldmansachs.com/insights/articles/ai-agents-forecast-to-boost-tech-cash-flow-as-usage-soars",
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

export const sourceUrl = (id: SourceId): string | undefined => (SOURCES[id] as Source).url;

/** A chart point: a year (fractional for a month within it) and its value. */
export type Point = readonly [year: number, value: number];

/** Monthly AI tokens, in trillions, for the token chart. */
export const TOKENS = {
  /**
   * Google's tokens a month across every product, as it has disclosed them:
   * I/O 2024 and 2025, the Q2 and Q3 2025 earnings calls, and I/O 2026.
   */
  google: [
    [2024.3, 9.7],
    [2025.3, 480],
    [2025.55, 980],
    [2025.8, 1300],
    [2026.38, 3200],
  ] as readonly Point[],
  /** Goldman Sachs' global forecast: about 5 quadrillion a month in 2026 to 120 quadrillion by 2030, 24x. */
  forecast: [
    [2026.5, 5000],
    [2030.5, 120000],
  ] as readonly Point[],
  multiple: 24,
} as const;

/** US data center capacity, in GW, for the demand chart. */
export const DEMAND = {
  /** EPRI's 2024 estimate (35–44 GW, midpoint) and BNEF's installed base at the end of 2025. */
  installed: [
    [2024, 40],
    [2025, 47],
  ] as readonly Point[],
  /** BNEF's July 2026 base case. */
  forecast: [
    [2025, 47],
    [2030, 118],
    [2035, 194],
  ] as readonly Point[],
  /**
   * Illustrative, ZODE's: the installed base growing at the most new data
   * center load BNEF says the US grid has connected in one year, 10 GW.
   */
  gridPace: 10,
  /** EPRI's 2030 scenarios for nominal IT capacity. */
  epri2030: { low: 56, high: 132 },
  /** S&P's 2030 estimate, "above 180 GW", as reported by Utility Dive. */
  sp2030: 180,
} as const;

export const MARKET_TIGHTNESS = [
  { value: "1.4%", label: "Primary-market vacancy, a record low", source: "CBRE, H1 2026", cite: "cbre" },
  {
    value: "66 GW",
    label: "Under construction in North America, 95% pre-committed",
    source: "JLL, midyear 2026",
    cite: "jll",
  },
  { value: "25 GW", label: "Absorbed in H1 2026, double a year earlier", source: "JLL, midyear 2026", cite: "jll" },
] as const;

/** Morgan Stanley's 2026–2028 US data center power bridge, in GW. `short` labels the bars at phone width. */
export const SHORTFALL = {
  steps: [
    { id: "demand", label: "Demand", short: "Demand", note: "2026–28 incremental", value: 97, kind: "total" },
    {
      id: "construction",
      label: "Under construction",
      short: "Building",
      note: "Already building",
      value: -21,
      kind: "step",
    },
    { id: "grid", label: "Grid capacity", short: "Grid", note: "Available or contractable", value: -19, kind: "step" },
    { id: "gross", label: "Gross gap", short: "Gross gap", note: "Before new power", value: 57, kind: "total" },
    {
      id: "fixes",
      label: "Time-to-power",
      short: "Fixes",
      note: "On-site gas, fuel cells, nuclear",
      value: -24,
      kind: "step",
    },
    { id: "net", label: "Net gap", short: "Net gap", note: "34% of demand", value: 33, kind: "total" },
  ],
  /** Cumulative midpoint net gap by year; 2029 extends the forecast. */
  byYear: [
    { year: 2026, gw: 5 },
    { year: 2027, gw: 12 },
    { year: 2028, gw: 33 },
    { year: 2029, gw: 72, extended: true },
  ],
} as const;

export type StateStatus = "enacted" | "executive" | "introduced" | "failed";

/** Statewide moratorium actions, from NCSL's tracker and the governors' orders. */
export const STATE_ACTIONS: Readonly<Record<string, { status: StateStatus; note: string }>> = {
  NY: { status: "enacted", note: "Executive Order 62: state permits paused for data centers of 50 MW or more, up to a year" },
  OR: { status: "executive", note: "State-land requests for data centers paused through July 1, 2027" },
  DE: { status: "introduced", note: "SB 353: permits over 100 MW paused until January 2027" },
  GA: { status: "introduced", note: "HB 1059: no local permits until December 2028" },
  MI: { status: "introduced", note: "HB 5594 / 5595: no new approvals until April 2027" },
  NJ: { status: "introduced", note: "AB 5482: six-month moratorium" },
  PA: { status: "introduced", note: "SB 1359 / HB 2533: three-year moratorium" },
  SC: { status: "introduced", note: "H 5526: no local approvals until state oversight" },
  VT: { status: "introduced", note: "S 205: moratorium until 2030" },
  VA: { status: "introduced", note: "HB 1515: approvals held until interconnection catches up; continued" },
  ME: { status: "failed", note: "LD 307: over 20 MW until November 2027; vetoed" },
  MN: { status: "failed", note: "HB 4888 / SB 4298; failed" },
  NH: { status: "failed", note: "HB 1265: one-year moratorium; failed" },
  OK: { status: "failed", note: "SB 1488: until November 2029; failed" },
  SD: { status: "failed", note: "SB 232: one-year moratorium; failed" },
  WI: { status: "failed", note: "SB 1061 / AB 1099; failed" },
};

/** States where a county has paused data center approvals this fall (see news.ts). */
export const COUNTY_PAUSES: readonly string[] = ["VA", "AZ", "NC", "ID"];

export const STATUS_LABELS: Readonly<Record<StateStatus, string>> = {
  enacted: "Moratorium in effect",
  executive: "Executive pause",
  introduced: "Bill introduced",
  failed: "Failed or vetoed",
};

export const POLICY_STATS = [
  { value: "16", label: "States where lawmakers considered banning new data centers", source: "NCSL", cite: "ncsl" },
  {
    value: "30",
    label: "Statehouses that acted on siting, cost-sharing, power or water in 2026",
    source: "Data Center Watch",
    cite: "dataCenterWatch",
  },
] as const;
