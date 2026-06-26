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

export interface SiteCard {
  /** Card title, e.g. "Site". */
  readonly title: string;
  /** Bullet points rendered beneath the title. */
  readonly bullets: readonly string[];
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
  /** Floating cards across the bottom of the slide. */
  readonly cards: readonly SiteCard[];
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
  /** Highlight zone id lit in the 3D scene when this module is active. */
  readonly zone: string;
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

/**
 * A bullet is either a plain string or a parent line with indented
 * sub-bullets rendered beneath it.
 */
export type InvestmentBullet =
  | string
  | { readonly text: string; readonly subBullets: readonly string[] };

export interface InvestmentBulletGroup {
  /** Group heading, e.g. "Capital Raise". */
  readonly title: string;
  /** Bullet points rendered beneath the title. */
  readonly bullets: readonly InvestmentBullet[];
}

export interface UseOfProceedsSlice {
  /** Expense category label shown in the legend / tooltip. */
  readonly label: string;
  /** Relative weight; rendered as a percentage of the whole. */
  readonly value: number;
}

export interface InvestmentContent {
  /** Left-column stacked groups: Capital Raise, Deal Terms, Key Dates. */
  readonly bulletGroups: readonly InvestmentBulletGroup[];
  /** Mock pie-chart slices for the Use of Proceeds card. */
  readonly useOfProceeds: readonly UseOfProceedsSlice[];
  /** Bottom-right card: reasons to invest now. */
  readonly whyInvestNow: InvestmentBulletGroup;
}

export interface ContactContent {
  /** Contact email address shown beneath the wordmark, linked via mailto. */
  readonly email: string;
}

export interface FounderProfile {
  /** Role line shown above the name, e.g. "Founder / CEO". */
  readonly role: string;
  /** Founder's full name. */
  readonly name: string;
  /** Short bio paragraph. */
  readonly bio: string;
  /** Heading above the achievements list, e.g. "Key Achievements". */
  readonly achievementsLabel: string;
  /** Bullet list of headline achievements. */
  readonly achievements: readonly string[];
}

export interface TimelineEntry {
  /** Year shown in the left column, e.g. "2016". */
  readonly year: string;
  /** Optional short phase label beneath the year, e.g. "Early Days". */
  readonly label?: string;
  /** Milestones for that year. */
  readonly events: readonly string[];
}

export interface CompanyLink {
  /** Visible text, e.g. "zero.tech". */
  readonly label: string;
  /** Destination URL. */
  readonly href: string;
}

export interface CompanyCard {
  /** Company name, e.g. "ZERO". */
  readonly name: string;
  /** One-line description. */
  readonly description: string;
  /** Website link. */
  readonly url: CompanyLink;
  /** X (Twitter) link; label is the handle, e.g. "@zero_app". */
  readonly x: CompanyLink;
  /** Founding year, e.g. "2017". */
  readonly year: string;
}

export interface ParentCompany {
  /** Kicker above the name, e.g. "Parent Company". */
  readonly label: string;
  /** Holding company name, e.g. "CYPHER, INC.". */
  readonly name: string;
  /** Short description paragraph. */
  readonly bio: string;
  /** Heading above the core values list, e.g. "Core Values". */
  readonly valuesLabel: string;
  /** The company's core values. */
  readonly values: readonly string[];
}

export interface TeamContent {
  /** Founder/CEO bio shown on the left in the Leadership view. */
  readonly founder: FounderProfile;
  /** Parent holding company shown on the right in the Leadership view. */
  readonly parentCompany: ParentCompany;
  /** Chronological milestones shown in the Timeline view. */
  readonly timeline: readonly TimelineEntry[];
  /** Portfolio company cards shown across the bottom. */
  readonly companies: readonly CompanyCard[];
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
  /**
   * When set, the section renders the "investment" layout: a centered header
   * with the Capital Raise / Deal Terms / Key Dates groups stacked on the
   * left, and a Use of Proceeds pie chart above a "Why invest now?" card on
   * the right.
   */
  readonly investment?: InvestmentContent;
  /**
   * When set, the section renders the "team" layout: a centered header, a
   * founder/CEO bio on the left, a vertical timeline on the right, and a row
   * of portfolio company cards across the bottom.
   */
  readonly team?: TeamContent;
  /**
   * When set, the section renders the "contact" layout: a large ZODE wordmark
   * centered on the panel with the contact email linked beneath it.
   */
  readonly contact?: ContactContent;
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
    label: "Market",
    title: "Deploy 1 GW of compute by 2030.",
    lede: "",
    body: [],
    market: [
      {
        acronym: "TAM",
        name: "Total Addressable Market",
        headline: "$255B",
        description:
          "Global AI inference and edge AI infrastructure across the full AI compute build-out.",
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
        headline: "$15B+",
        description:
          "Power-advantaged micro data centers in renewable-rich secondary markets for edge AI.",
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
          name: "NOC",
          code: "NOC-01",
          zone: "noc",
          description:
            "The Network Operations Center anchors the front of the first cabin. Operators monitor every workload, alert, and uplink from a single wall of telemetry. It is the staffed front door to the entire ZODE.",
        },
        {
          number: "02",
          name: "Compute Hall",
          code: "CMP-02",
          zone: "compute",
          description:
            "The compute hall fills the rest of the first cabin with twelve liquid-cooled GPU racks. Hot-swappable trays keep inference and training online during service. This is where the ZODE turns power into compute.",
        },
        {
          number: "03",
          name: "Cooling Yard",
          code: "COOL-03",
          zone: "cooling",
          description:
            "The cooling yard bridges the two cabins with six closed-loop heat-rejection units. Paired rows reject rack heat with full redundancy. Captured heat can feed adjacent buildings instead of the sky.",
        },
        {
          number: "04",
          name: "Power Hall",
          code: "PWR-04",
          zone: "power",
          description:
            "The power hall occupies the second cabin with switchgear, distribution, and battery buffering. It ties the grid feed to on-site backup with automatic failover. Clean, conditioned power flows from here to every rack.",
        },
        {
          number: "05",
          name: "Generators",
          code: "GEN-05",
          zone: "generators",
          description:
            "Standby generators sit outside on the far end of the site. They carry the full load through grid interruptions and maintenance windows. Sized for the whole ZODE, they keep compute running no matter what.",
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
            "100% hydro-powered SITE",
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
    title: "Deploying December 2026.",
    lede: "",
    body: [],
    site: {
      background: {
        src: "/images/first-site.png",
        alt: "Contour map of the British Columbia site with deployment markers",
      },
      cards: [
        {
          title: "SITE",
          bullets: [
            "British Columbia",
            "200+ acres",
            "100% hydro-powered",
            "First deployment Dec. 2026",
          ],
        },
        {
          title: "Compute",
          bullets: [
            "720 scaling to 4,320 GPUs",
            "1.5 MW scaling to 9 MW",
            "Liquid-cooled racks",
            "Sub-10ms intra-pod latency",
          ],
        },
        {
          title: "Revenue",
          bullets: [
            "$25M per year for ZODE 1",
            "$150M per year for SITE 1",
            "6 ZODES for SITE 1",
            "Scales SITE by SITE",
          ],
        },
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
          { label: "SITES", cells: [1, 1, 12, 24, 36, 60] },
          { label: "ZODES / SITE", cells: [3, 6, 6, 8, 10, 10] },
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
    title: "A decade building sovereign systems.",
    lede: "",
    body: [],
    team: {
      founder: {
        role: "Founder / CEO",
        name: "Matthew Dorey",
        bio: "THE GRID is founded by Matthew Dorey, a Canadian entrepreneur and software developer with over 20+ years building and scaling technology companies.",
        achievementsLabel: "Key Achievements",
        achievements: [
          "Collective peak valuation of $2 billion+",
          "Over $100 million raised",
          "Founded 5+ companies",
          "First exit in 20s",
        ],
      },
      parentCompany: {
        label: "Parent Company",
        name: "CYPHER, INC.",
        bio: "CYPHER is the holding company behind multiple consumer AI-focused companies built on top of THE GRID protocol. Our mission is to build sovereign systems that empower humanity.",
        valuesLabel: "Core Values",
        values: ["Sovereignty", "Privacy", "Security", "Open Source"],
      },
      timeline: [
        {
          year: "2016",
          label: "Early Days",
          events: ["ZERO is incubated at Factory 0 in San Francisco at 711 Scott St."],
        },
        {
          year: "2020",
          label: "All Systems Go",
          events: ["ZERO whitepaper is publicly released for a Social Operating System."],
        },
        {
          year: "2021",
          events: [
            "Wilder World is founded to create a large scale simulation using ZERO technology.",
          ],
        },
        {
          year: "2022",
          events: [
            "Z Wilder World hits valuation > $2 billion.",
            "ZNS 1.0 launches.",
          ],
        },
        {
          year: "2023",
          events: ["First Wilder World trailer hits 1M views.", "Work begins on The GRID"],
        },
        {
          year: "2024",
          events: [
            "Wilder World partners with Epic Games, NVIDIA and Lamborghini.",
            "Z Chain launches. ZNS 2.0 launches.",
          ],
        },
        {
          year: "2025",
          events: [
            "Wilder World launches Super Early Access.",
            "CYPHER is announced.",
            "AURA AI is founded.",
          ],
        },
        {
          year: "2026",
          events: [
            "ZODE launches.",
            "Wilder World economy goes live.",
            "The GRID launches.",
          ],
        },
      ],
      companies: [
        {
          name: "ZERO",
          description: "A secure platform for deploying an agentic workforce.",
          url: { label: "zero.tech", href: "https://zero.tech" },
          x: { label: "@zero_app", href: "https://x.com/zero_app" },
          year: "2017",
        },
        {
          name: "WILDER WORLD",
          description: "A secure platform for deploying an agentic workforce.",
          url: { label: "wilderworld.com", href: "https://wilderworld.com" },
          x: { label: "@wilderworld", href: "https://x.com/wilderworld" },
          year: "2021",
        },
        {
          name: "Z CHAIN",
          description: "A secure platform for deploying an agentic workforce.",
          url: { label: "zchain.org", href: "https://zchain.org" },
          x: { label: "@zchain_org", href: "https://x.com/zchain_org" },
          year: "2023",
        },
        {
          name: "AURA",
          description: "A secure platform for deploying an agentic workforce.",
          url: { label: "aura.ai", href: "https://aura.ai" },
          x: { label: "@aura_asi", href: "https://x.com/aura_asi" },
          year: "2024",
        },
        {
          name: "ZODE",
          description: "Distributed compute network powered by THE GRID.",
          url: { label: "thegrid.host", href: "https://thegrid.host" },
          x: { label: "@zode_org", href: "https://x.com/zode_org" },
          year: "2026",
        },
      ],
    },
  },
  {
    id: "investment",
    label: "Investment",
    title: "Sustainable infrastructure for the AI revolution.",
    lede: "",
    body: [],
    investment: {
      bulletGroups: [
        {
          title: "Capital Raise",
          bullets: [
            "Tokenizing ZODE 1",
            "Raising $5 million in Reg CF offering",
            "Structured as a tokenized security revenue share offering",
            "12 month lock-up before trading",
          ],
        },
        {
          title: "Deal Terms",
          bullets: [
            "30% profit participation units for SITE 1",
            "3 year capital payback",
            "Dividends paid monthly",
            {
              text: "All expenses are directly related to unit operation:",
              subBullets: [
                "Does not include corporate admin, R&D, marketing, etc.",
              ],
            },
          ],
        },
        {
          title: "Key Dates",
          bullets: [
            "Target start on August 1, 2026 for 90 days",
            "Ends on October 30, 2026",
            "First ZODE planned to launch on December 1, 2026",
          ],
        },
      ],
      useOfProceeds: [
        { label: "Equipment", value: 45 },
        { label: "Power Infrastructure", value: 20 },
        { label: "Site Development", value: 15 },
        { label: "Operations", value: 10 },
        { label: "Network & Cooling", value: 6 },
        { label: "Contingency", value: 4 },
      ],
      whyInvestNow: {
        title: "Why invest now?",
        bullets: [
          "Still early but heavily de-risked (land, permitting, power, water, etc.)",
          "Fast to revenue and dividends",
          "Positive societal impact at scale",
          "Proven team and track-record",
        ],
      },
    },
  },
  {
    id: "contact",
    label: "Contact",
    title: "Get in touch.",
    lede: "",
    body: [],
    contact: { email: "hello@zode.org" },
  },
];
