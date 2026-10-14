/**
 * Third-party research behind the deck's market and policy slides, as of
 * `AS_OF`. Figures are the publishers' own; anything ZODE derives from them
 * is labelled as such where it's drawn.
 */

import type { MacroArtId } from "./slides";

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
  texas: {
    publisher: "Texas Governor's Office",
    title: "Directives pausing new data center grid hookups and state permits",
    date: "August 3 and September 21, 2026",
    url: "https://gov.texas.gov/news/post/governor-abbott-directs-tceq-to-halt-data-center-permits",
  },
  ercot: {
    publisher: "ERCOT",
    title: "Batch Zero update",
    date: "September 11, 2026",
    url: "https://www.ercot.com/files/docs/2026/09/11/14-Batch-Zero-Update.pdf",
  },
  eei: {
    publisher: "Edison Electric Institute",
    title: "List of large customer projects and tariffs",
    date: "September 2026",
    url: "https://www.eei.org/-/media/Project/EEI/Documents/Issues%20and%20Policy/List%20of%20Large%20Customer%20Projects%20and%20Tariffs",
  },
  moratoriumNation: {
    publisher: "Moratorium Nation",
    title: "Local pauses and state data center restrictions, open dataset",
    date: "September 23, 2026",
    url: "https://mjbommar.github.io/moratorium-data-2026/",
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
  heatmap: {
    publisher: "Heatmap Pro / Embold Research",
    title: "Americans now overwhelmingly oppose new data centers near them",
    date: "June 2026",
    url: "https://heatmap.news/politics/americans-oppose-data-centers-poll",
  },
  transformers: {
    publisher: "Wood Mackenzie",
    title: "Why AI data center projects face years of delays after approval",
    date: "May 12, 2026",
    url: "https://www.datacenterknowledge.com/energy-power-supply/why-ai-data-center-projects-face-years-of-delays-after-approval",
    via: "via Data Center Knowledge",
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
  /**
   * Enterprise value over active or year-end MW: CoreWeave $88.9B on 1.5 GW
   * active, 1.85 GW+ by year end; Nebius $58.9B on 0.8–1 GW connected by year
   * end; IREN $15.8B on ~0.3 GW of IT delivered in 2026. Power from each
   * company's Q2 2026 or FY26 report.
   */
  evPerMw: {
    publisher: "ZODE, from NeoCloud Stocks and company reports",
    title: "AI cloud enterprise value per MW: CoreWeave, Nebius and IREN",
    date: "October 13, 2026",
    url: "https://www.neocloudstocks.com/",
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

/** `art` names each figure's drawing on the demand slide (art/MacroArt.tsx). */
export const MARKET_TIGHTNESS = [
  {
    value: "1.4%",
    label: "Primary-market vacancy, record low",
    source: "CBRE, H1 2026",
    cite: "cbre",
    art: "vacancy",
  },
  {
    value: "66 GW",
    label: "Under construction, 95% pre-leased",
    source: "JLL, midyear 2026",
    cite: "jll",
    art: "construction",
  },
  {
    value: "25 GW",
    label: "Absorbed in H1\u00a02026, 2× last year",
    source: "JLL, midyear 2026",
    cite: "jll",
    art: "absorption",
  },
] as const satisfies readonly { value: string; label: string; source: string; cite: SourceId; art: MacroArtId }[];

/**
 * Morgan Stanley's 2026–2028 US data center power bridge, in GW. `short`
 * labels the bars at phone width; `note` is set under each label in two lines.
 */
export const SHORTFALL = {
  steps: [
    { id: "demand", label: "Demand", short: "Demand", note: ["New load", "2026–28"], value: 97, kind: "total" },
    {
      id: "construction",
      label: "Under construction",
      short: "Building",
      note: ["Already", "building"],
      value: -21,
      kind: "step",
    },
    { id: "grid", label: "Grid capacity", short: "Grid", note: ["Spare or", "contractable"], value: -19, kind: "step" },
    { id: "gross", label: "Gross gap", short: "Gross gap", note: ["Before", "new power"], value: 57, kind: "total" },
    {
      id: "fixes",
      label: "Time-to-power",
      short: "Fixes",
      note: ["Gas, fuel cells,", "nuclear"],
      value: -24,
      kind: "step",
    },
    { id: "net", label: "Net gap", short: "Net gap", note: ["34% of", "demand"], value: 33, kind: "total" },
  ],
  /** Cumulative midpoint net gap by year; 2029 extends the forecast. */
  byYear: [
    { year: 2026, gw: 5 },
    { year: 2027, gw: 12 },
    { year: 2028, gw: 33 },
    { year: 2029, gw: 72, extended: true },
  ],
} as const;