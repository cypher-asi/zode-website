export interface SectionMedia {
  readonly src: string;
  readonly alt: string;
}

export interface Citation {
  /** Human-readable source label shown as the link text. */
  readonly label: string;
  /** Destination URL; opened in a new tab. */
  readonly href: string;
}

export interface SolutionCard {
  /** Short uppercase category, e.g. "Modular". */
  readonly label: string;
  /** Headline metric, e.g. "4 months". */
  readonly stat: string;
  /** One-line supporting copy. */
  readonly description: string;
}

export interface NetworkCompany {
  /** Display name shown in the demand rail. */
  readonly name: string;
  /** Provider key that maps to a brand mark in the demand rail. */
  readonly provider: string;
}

export interface MarketTier {
  /** Short acronym shown inside the triangle, e.g. "TAM". */
  readonly acronym: string;
  /** Full tier name, e.g. "Total Addressable Market". */
  readonly name: string;
  /** Headline market-size metric, e.g. "~$106B \u2192 ~$255B by 2030". */
  readonly headline: string;
  /** Optional secondary metric, e.g. "CAGR ~19%". */
  readonly meta?: string;
  /** Supporting copy describing the tier. */
  readonly description: string;
  /**
   * Relative linear size of this tier's triangle (0-1, where the largest
   * tier is 1). Driven by the tier's market size so bigger markets render
   * as bigger triangles; falls back to an index ramp when omitted.
   */
  readonly weight?: number;
}

export interface SiteFact {
  /** Row label, e.g. "Location". */
  readonly label: string;
  /** Row value, e.g. "British Columbia". */
  readonly value: string;
}

export interface SiteProgress {
  /** Ordered build phases shown beneath the bar. */
  readonly stages: readonly string[];
  /** How many stages are complete (fills the green bar). */
  readonly completed: number;
}

export interface SiteContent {
  /** Full-bleed terrain artwork behind the overlay. */
  readonly background: SectionMedia;
  /** Key Facts rows rendered in the right-hand card. */
  readonly facts: readonly SiteFact[];
  /** Segmented progress bar + phase labels. */
  readonly progress: SiteProgress;
}

export interface ProductModule {
  /** Two-digit index shown in the nav, e.g. "01". */
  readonly number: string;
  /** Display name, e.g. "Compute Pod". */
  readonly name: string;
  /** Right-aligned code, e.g. "AI-01". */
  readonly code: string;
  /** Expanded description shown when the module is active. */
  readonly description: string;
}

export interface ProductSpec {
  /** Card title, e.g. "Compute". */
  readonly title: string;
  /** Bullet points rendered beneath the title. */
  readonly bullets: readonly string[];
}

export interface ProductContent {
  /** Expandable module list beside the 3D scene. */
  readonly modules: readonly ProductModule[];
  /** Spec cards across the bottom of the slide. */
  readonly specs: readonly ProductSpec[];
}

export interface FinancialsRow {
  /** Row label, e.g. "Annual Revenue". */
  readonly label: string;
  /** Pre-formatted value, e.g. "$25,297,920" or "37.13%". Omit for group headers. */
  readonly value?: string;
  /** Bold the row (totals, profit, headline metrics). */
  readonly emphasis?: boolean;
  /** Indent the label (children of a group header). */
  readonly indent?: boolean;
  /** Render the label in italics (e.g. derived ratios). */
  readonly muted?: boolean;
}

export interface FinancialsTable {
  /** Card heading, e.g. "ZODE Unit Economics". */
  readonly title: string;
  /** Ordered rows rendered as a label / value list. */
  readonly rows: readonly FinancialsRow[];
}

export interface BuildOutColumn {
  /** Period year, e.g. "2027". Spans the two halves below it. */
  readonly year: string;
  /** Half-year sub-columns under the year, e.g. ["H1", "H2"]. */
  readonly halves: readonly string[];
}

export interface BuildOutRow {
  /** Row label, e.g. "Zodes". */
  readonly label: string;
  /** One numeric cell per half-year column, left-to-right. */
  readonly cells: readonly number[];
  /**
   * How to render each cell:
   * - "number" (default): grouped integer, e.g. "192"
   * - "decimal": two decimals, e.g. "1.50"
   * - "compact": K/M/B abbreviation, e.g. "648K"
   * - "currency": $ + K/M/B abbreviation, e.g. "$15.2B"
   */
  readonly format?: "number" | "decimal" | "compact" | "currency";
  /** Bold the row (e.g. Revenue). */
  readonly emphasis?: boolean;
}

export interface FinancialsChartPoint {
  /** Period label, e.g. "2027 H1". */
  readonly period: string;
  /** Revenue in USD for that half-year. */
  readonly revenue: number;
  /** Cumulative parent equity in USD: ~$7.5M per operating site. */
  readonly parentEquity: number;
  /** Cumulative SPV capital in USD: ~$5M per operating site. */
  readonly spvCapital: number;
}

export interface FinancialsContent {
  /** Top-left table: per-ZODE unit economics. */
  readonly unitEconomics: FinancialsTable;
  /** Bottom-left table: SPV capital structure. */
  readonly capitalStructure: FinancialsTable;
  /** Right-top table: the three-year build-out grid. */
  readonly buildOut: {
    readonly title: string;
    readonly columns: readonly BuildOutColumn[];
    readonly rows: readonly BuildOutRow[];
  };
  /**
   * Right-bottom chart: revenue and capital across the six half-year
   * periods, toggled by a selector.
   */
  readonly chartSeries: readonly FinancialsChartPoint[];
}

export interface SectionContent {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly lede: string;
  readonly body: readonly string[];
  /**
   * When set, the section renders an image-led layout (media on top, title
   * and lede in a band below) instead of the centered text layout.
   */
  readonly media?: SectionMedia;
  /**
   * When set, the section renders an interactive 3D model in the upper 3/4 of
   * the card with the title and lede in a band below. Currently only
   * "a-frame-cabin".
   */
  readonly model?: string;
  /**
   * When set, the section renders a split layout: copy on the left and the
   * named interactive chart on the right. Currently only "energy-demand".
   */
  readonly chart?: string;
  /** Optional small print rendered beneath the split-layout copy. */
  readonly footnote?: string;
  /**
   * When set, the section renders the "deploy" layout: a centered header at
   * the top, the `media` rendering centered behind the middle, and these
   * stat cards across the bottom.
   */
  readonly cards?: readonly SolutionCard[];
  /**
   * When set, the section renders a custom interactive scene instead of the
   * standard layouts. Currently only "ecosystem-network": a three-panel view
   * of compute demand, the ZODE network, and a live transaction feed.
   */
  readonly scene?: string;
  /** Placeholder companies for the "ecosystem-network" demand rail. */
  readonly companies?: readonly NetworkCompany[];
  /** ZODE node labels routed across in the "ecosystem-network" scene. */
  readonly zodes?: readonly string[];
  /**
   * When set, the section renders the "opportunity" layout: a TAM/SAM/SOM
   * triangle infographic, one ascending triangle per tier.
   */
  readonly market?: readonly MarketTier[];
  /**
   * When set, the section renders the "site" layout: cleaned terrain artwork
   * as a full-bleed background, a centered header, a Key Facts card on the
   * right, and a segmented green progress bar centered near the bottom.
   */
  readonly site?: SiteContent;
  /**
   * When set, the section renders the "product" layout: centered header,
   * CabinScene + module nav, and spec cards across the bottom.
   */
  readonly product?: ProductContent;
  /**
   * When set, the section renders the "financials" layout: a centered header
   * with two stacked tables on the left (unit economics + capital structure)
   * and the build-out table plus a revenue line chart on the right.
   */
  readonly financials?: FinancialsContent;
  /** Optional source citations rendered at the bottom of the section. */
  readonly citations?: readonly Citation[];
}

/**
 * The numbered pitch sections rendered as full-panel slides after the
 * cover. `id` is used as the scroll anchor and the tick-rail navigation
 * key; `label` is the short name shown in the rail's expanded menu. The
 * cover slide precedes these and is not numbered, so "The Problem" is the
 * first numbered item in the rail. Copy is placeholder and meant to be
 * replaced.
 */
export const SECTIONS: readonly SectionContent[] = [
  {
    id: "summary",
    label: "Summary",
    title: "Introducing Zode One.",
    lede: "The first rapidly deployable data center to respond to the AI energy crisis.",
    body: [],
    model: "a-frame-cabin",
  },
  {
    id: "problem",
    label: "The Problem",
    title: "The AI energy crisis is here.",
    lede: "",
    body: [
      "The demand for AI energy is expected to ~3x over the next decade from 415 TWh to 1,200 TWh.",
      "Existing energy infrastructure requires multi-year upgrades and significant policy hurdles.",
      "Local communities are revolting against monolithic build outs and risk being left behind.",
    ],
    chart: "energy-demand",
    citations: [
      {
        label: "IEA, Energy demand from AI (Energy and AI report)",
        href: "https://www.iea.org/reports/energy-and-ai/energy-demand-from-ai",
      },
    ],
  },
  {
    id: "solution",
    label: "The Solution",
    title: "Deploy compute in months not years.",
    lede: "",
    body: [],
    media: {
      src: "/images/zode-deploy.png",
      alt: "Zode modular data center wireframe rendering",
    },
    cards: [
      {
        label: "Modular",
        stat: "4 months",
        description: "Rapidly deploy a ZODE anywhere in the world.",
      },
      {
        label: "ELASTIC",
        stat: "1 MW",
        description: "Tap into latent energy availability with ease.",
      },
      {
        label: "Sustainable",
        stat: "0 carbon",
        description: "Contribute to people, communities, and the planet.",
      },
    ],
  },
  {
    id: "opportunity",
    label: "Opportunity",
    title: "Deploy 1 GW of compute by 2030.",
    lede: "",
    body: [],
    market: [
      {
        acronym: "TAM",
        name: "Total Addressable Market",
        headline: "$255B",
        description:
          "Global AI inference and edge AI infrastructure \u2014 the full AI compute build-out.",
        weight: 1,
      },
      {
        acronym: "SAM",
        name: "Serviceable Addressable Market",
        headline: "$60B",
        description:
          "Modular, micro, and edge data centers shifting compute from hyperscale to distributed.",
        weight: 0.62,
      },
      {
        acronym: "SOM",
        name: "Serviceable Obtainable Market",
        headline: "1 GW of power + estimated value",
        description:
          "Power-advantaged micro data centers in renewable-rich secondary markets \u2014 privacy and edge AI inference, agent workloads, and sovereign compute.",
        weight: 0.32,
      },
    ],
  },
  {
    id: "product",
    label: "Product",
    title: "A rapidly deployable micro-data center.",
    lede: "",
    body: [],
    product: {
      modules: [
        {
          number: "01",
          name: "Compute Pod",
          code: "AI-01",
          description:
            "High-density GPU racks with liquid cooling and hot-swappable trays, sized for inference and training workloads at the edge.",
        },
        {
          number: "02",
          name: "Power Module",
          code: "PW-01",
          description:
            "Modular 1 MW power distribution with grid tie-in, on-site battery buffer, and automatic failover between sources.",
        },
        {
          number: "03",
          name: "Cooling System",
          code: "CL-01",
          description:
            "Closed-loop liquid cooling with heat rejection and optional heat-recovery interface for adjacent facilities.",
        },
        {
          number: "04",
          name: "Network Interface",
          code: "NW-01",
          description:
            "Multi-gigabit uplink with redundant paths, low-latency intra-pod switching, and secure tenant isolation.",
        },
        {
          number: "05",
          name: "Control Panel",
          code: "CT-01",
          description:
            "Unified telemetry, remote orchestration, and carbon-aware scheduling from a single operations dashboard.",
        },
        {
          number: "06",
          name: "Enclosure Shell",
          code: "SH-01",
          description:
            "Road-transportable container shell with weatherproof cladding, 26 ft clear span, and rapid on-site assembly.",
        },
      ],
      specs: [
        {
          title: "Compute",
          bullets: [
            "720 GPU capacity",
            "Liquid-cooled racks",
            "Sub-10ms intra-pod latency",
            "Hot-swappable compute trays",
          ],
        },
        {
          title: "Energy",
          bullets: [
            "1 MW modular power draw",
            "Grid + backup hybrid",
            "PUE target under 1.2",
            "On-site battery buffer",
          ],
        },
        {
          title: "Dimensions",
          bullets: [
            "40 ft container footprint",
            "26 ft clear span",
            "4-month deploy timeline",
            "Road-transportable modules",
          ],
        },
        {
          title: "Sustainability",
          bullets: [
            "100% hydro-powered site",
            "Closed-loop cooling",
            "Heat recovery ready",
            "Carbon-aware scheduling",
          ],
        },
      ],
    },
  },
  {
    id: "ecosystem",
    label: "Network",
    title: "A constellation of compute.",
    lede: "",
    body: [],
    scene: "ecosystem-network",
    companies: [
      { name: "Anthropic", provider: "Anthropic" },
      { name: "OpenAI", provider: "OpenAI" },
      { name: "Gemini", provider: "Google" },
      { name: "DeepSeek", provider: "DeepSeek AI" },
      { name: "Kimi", provider: "Moonshot AI" },
      { name: "MiniMax", provider: "MiniMax" },
      { name: "GLM", provider: "Z.ai" },
      { name: "Qwen", provider: "Alibaba Cloud" },
      { name: "Doubao", provider: "ByteDance" },
      { name: "Tripo", provider: "Tripo AI" },
    ],
    zodes: ["ZODE-01", "ZODE-02", "ZODE-03", "ZODE-04", "ZODE-05", "ZODE-06"],
  },
  {
    id: "traction",
    label: "Traction",
    title: "First site ready to deploy.",
    lede: "",
    body: [],
    site: {
      background: {
        src: "/images/first-site.png",
        alt: "Contour map of the British Columbia site with deployment markers",
      },
      facts: [
        { label: "First deployment", value: "Dec. 2026" },
        { label: "Location", value: "British Columbia" },
        { label: "Acres", value: "200+" },
        { label: "GPUs", value: "720" },
        { label: "2027 Revenue (est.)", value: "$33 million" },
        { label: "Power Source", value: "Hydro-power" },
        { label: "Power", value: "1 MW" },
      ],
      progress: {
        stages: [
          "Land",
          "Zoning",
          "Bandwidth",
          "Power",
          "Equipment",
          "Fabrication",
          "Deployment",
          "Monetization",
        ],
        completed: 7,
      },
    },
  },
  {
    id: "financials",
    label: "Financials",
    title: "600 ZODES by 2030.",
    lede: "",
    body: [],
    financials: {
      unitEconomics: {
        title: "ZODE Unit Economics",
        rows: [
          { label: "Nodes", value: "90" },
          { label: "GPUs", value: "720" },
          { label: "Racks", value: "11" },
          { label: "Power density / rack (Kv)", value: "125" },
          { label: "PUE", value: "1.1" },
          { label: "Total power (kW)", value: "1,406" },
          { label: "Revenue / GPU hour ($)", value: "$4.00" },
          { label: "Annual Revenue", value: "$25,297,920", emphasis: true },
          { label: "Expenses" },
          { label: "Power", value: "1,161,135", indent: true },
          { label: "Financing", value: "13,770,361", indent: true },
          { label: "Operations", value: "974,040", indent: true },
          { label: "Total", value: "15,905,536", emphasis: true },
          { label: "Profit", value: "9,392,384", emphasis: true },
          { label: "Gross Margins", value: "37.13%", muted: true },
        ],
      },
      capitalStructure: {
        title: "ZODE I SPV Capital Structure",
        rows: [
          { label: "Equity", emphasis: true },
          { label: "Project", value: "$5,000,000.00", indent: true },
          { label: "Investors", value: "$5,000,000.00", indent: true },
          { label: "Total Equity", value: "$10,000,000.00", emphasis: true },
          { label: "Financing", emphasis: true },
          {
            label: "Equipment Financing",
            value: "$55,404,000.00",
            indent: true,
          },
          {
            label: "Construction Financing",
            value: "$4,900,000.00",
            indent: true,
          },
          { label: "Total Financing", value: "$60,304,000.00", emphasis: true },
          { label: "Investor profit", value: "$2,348,096.09", emphasis: true },
          { label: "Annual ROE", value: "46.96%", muted: true },
        ],
      },
      buildOut: {
        title: "3 Year Build Out",
        columns: [
          { year: "2027", halves: ["H1", "H2"] },
          { year: "2028", halves: ["H1", "H2"] },
          { year: "2029", halves: ["H1", "H2"] },
        ],
        rows: [
          { label: "Sites", cells: [1, 1, 12, 24, 36, 60] },
          { label: "ZODES / site", cells: [3, 6, 6, 8, 10, 10] },
          { label: "ZODES", cells: [3, 6, 72, 192, 360, 600] },
          {
            label: "MW / ZODE",
            format: "decimal",
            cells: [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
          },
          { label: "MW", cells: [5, 9, 108, 288, 540, 900] },
          {
            label: "GPUs",
            format: "compact",
            cells: [3240, 6480, 77760, 207360, 388800, 648000],
          },
          {
            label: "Revenue",
            format: "currency",
            emphasis: true,
            cells: [
              75_893_760, 151_787_520, 1_821_450_240, 4_857_200_640,
              9_107_251_200, 15_178_752_000,
            ],
          },
        ],
      },
      chartSeries: [
        {
          period: "2027 H1",
          revenue: 75_893_760,
          parentEquity: 7_500_000,
          spvCapital: 5_000_000,
        },
        {
          period: "2027 H2",
          revenue: 151_787_520,
          parentEquity: 7_500_000,
          spvCapital: 5_000_000,
        },
        {
          period: "2028 H1",
          revenue: 1_821_450_240,
          parentEquity: 90_000_000,
          spvCapital: 60_000_000,
        },
        {
          period: "2028 H2",
          revenue: 4_857_200_640,
          parentEquity: 180_000_000,
          spvCapital: 120_000_000,
        },
        {
          period: "2029 H1",
          revenue: 9_107_251_200,
          parentEquity: 270_000_000,
          spvCapital: 180_000_000,
        },
        {
          period: "2029 H2",
          revenue: 15_178_752_000,
          parentEquity: 450_000_000,
          spvCapital: 300_000_000,
        },
      ],
    },
  },
  {
    id: "team",
    label: "Team",
    title: "Team",
    lede: "The people building THE GRID.",
    body: [
      "A team spanning distributed systems, cryptography, and product, with a track record of shipping at scale.",
      "Replace this section with founder and team bios.",
    ],
  },
  {
    id: "investment",
    label: "Investment",
    title: "Investment",
    lede: "The round and use of funds.",
    body: [
      "Raising to fund the first deployments, equipment, and team.",
      "Use of funds: site development, GPU and power infrastructure, and operations.",
      "Milestones: first site live Dec. 2026, with expansion through 2027.",
      "Replace this section with the specific ask, terms, and use of funds.",
    ],
  },
];
