import type { SiteMapId } from "./art/siteMaps";
import type { UnitIconId } from "./art/UnitIcon";
import type { SourceId } from "./research";

/** A slide's background; ink is the one dark ground. */
export type Ground = "white" | "paper" | "ink";

export interface Stat {
  readonly value: string;
  readonly label: string;
}

/** Line drawings for the macro slides' cards (art/MacroArt.tsx). */
export type MacroArtId =
  | "capital"
  | "power"
  | "compute"
  | "land"
  | "datacenter"
  | "offtake"
  | "vacancy"
  | "construction"
  | "absorption"
  | "regulation"
  | "localBuild"
  | "supplyChain"
  | "financing"
  | "monolith"
  | "water"
  | "powerBill"
  | "economics"
  | "signature"
  | "interconnect"
  | "capitalStack"
  | "tokenMaze";

/** One link in the chain from capital to offtake; `hard` marks the bottleneck. */
export interface ChainStep {
  readonly label: string;
  readonly art: MacroArtId;
  readonly hard?: boolean;
}

/** A problem as a figure card: its drawing, captioned; `hard` sets the worst in red. */
export interface ProblemCard {
  readonly title: string;
  readonly art: MacroArtId;
  readonly hard?: boolean;
}

/** One side's problems: the biggest as the large card on top, the rest smaller below it. */
export interface ProblemGroup {
  readonly label: string;
  readonly lead: ProblemCard & { readonly body: string };
  readonly rest: readonly ProblemCard[];
}

export interface Logo {
  readonly name: string;
  readonly src: string;
  /** The SVG's viewBox width over its height; marks are sized to one area from it. */
  readonly aspect: number;
  /** Set by eye for marks whose weight or whitespace reads heavy or light at that area. */
  readonly scale?: number;
}

/** A contract figure, drawn as clusters' worth of contract value. */
export interface ContractFigure extends Stat {
  readonly usd: number;
}

/** One side of the contract: its terms. */
export interface ContractSide {
  readonly title: string;
  readonly rows: readonly { label: string; value: string }[];
}

/** A project's capital comes in up to three deals, each its own financing. */
export type DealId = "compute" | "realEstate" | "gpu";

interface Base {
  readonly id: string;
  /** Short name for the control bar, overview and progress tooltips. */
  readonly section: string;
  /** The section name in the head band. */
  readonly eyebrow: string;
  readonly title: string;
  readonly ground: Ground;
  /** Cited on the slide's foot and gathered in the appendix. */
  readonly sources?: readonly SourceId[];
}

const LOGO_DIR = "/images/deck/logos";

export type Slide =
  | (Base & { kind: "cover"; lede: string; meta: string; image: string })
  | (Base & {
      kind: "stats";
      stats: readonly (Stat & { art: MacroArtId })[];
      /** The caption on the token growth chart, the last card. */
      trend: string;
      statement: string;
      chain: readonly ChainStep[];
    })
  | (Base & { kind: "demand" })
  | (Base & { kind: "shortfall" })
  | (Base & { kind: "states" })
  | (Base & { kind: "news" })
  | (Base & {
      kind: "problemSolution";
      columns: readonly [string, string];
      /** One problem per row, drawn, ZODE's answer beside it; `hard` sets the one that blocks projects outright in red. */
      rows: readonly {
        art: MacroArtId;
        hard?: boolean;
        problem: { title: string; stat: Stat & { cite: SourceId } };
        solution: { title: string; body: string };
      }[];
    })
  | (Base & { kind: "problems"; groups: readonly [ProblemGroup, ProblemGroup] })
  | (Base & { kind: "solution"; facts: readonly Stat[] })
  | (Base & { kind: "principles" })
  | (Base & { kind: "stack"; lede: readonly string[] })
  | (Base & {
      kind: "steps";
      steps: readonly { title: string; body: string; art: MacroArtId }[];
      /** Each entry starts its own line. */
      statement: readonly string[];
    })
  | (Base & {
      kind: "unit";
      /** The `highlight` card is set on ink, to stand out. */
      specs: readonly (Stat & { icon: UnitIconId })[];
      highlight: number;
      image: string;
      /** Open in a new tab, under the image. */
      links: readonly { label: string; href: string }[];
    })
  | (Base & {
      kind: "traction";
      /** Contract value of one 4 MW cluster: both figures are drawn as blocks of it. */
      block: { usd: number; note: string };
      /** The large card. */
      contracted: ContractFigure;
      /** The mini-card under it. */
      loi: ContractFigure;
      demand: ContractSide;
      supply: ContractSide;
      /** Rows of logos across the foot of the body, one per stage. */
      customers: readonly { label: string; logos: readonly Logo[] }[];
    })
  | (Base & {
      kind: "pipeline";
      /** One mini-card per site, led by a line map of its city (art/SiteMap.tsx). */
      sites: readonly { site: string; map: SiteMapId; path: string; mw: string; status: string }[];
      total: string;
      capacity: readonly Stat[];
      /** Capacity online by year; each step is ten times the last, so it's drawn on a log scale. */
      plan: readonly { year: string; value: string }[];
      /** A statement under the plan, each entry on its own line; its dollar figures are set in the foreground. */
      planNote: readonly string[];
      /** Where the statement's figures come from, in small type under it. */
      planBasis: string;
    })
  | (Base & {
      kind: "comparison";
      columns: readonly [string, string];
      rows: readonly { label: string; them: string; us: string }[];
      note: string;
    })
  | (Base & {
      kind: "finance";
      /** One card per deal, in the row across the top. */
      deals: readonly {
        id: DealId;
        icon: UnitIconId;
        title: string;
        purpose: string;
        /** What the deal funds and what backs it, in a sentence. */
        body: string;
        /** Its capital stack, top to bottom: equity over debt, the most senior last. */
        layers: readonly { label: string; kind: "equity" | "debt"; terms?: readonly string[] }[];
      }[];
      /** Drawn as one stacked bar, each layer as wide as its share of `usd` and shaded by its deal. */
      example: {
        title: string;
        /** Grouped under their deals in the deals' order; `total` must be the sum of the values as shown. */
        layers: readonly { label: string; deal: DealId; kind: "equity" | "debt"; value: string; usd: number }[];
        total: string;
        note: string;
      };
    })
  | (Base & {
      kind: "raise";
      hero: Stat;
      terms: readonly string[];
      uses: readonly string[];
      total: string;
    })
  | (Base & {
      kind: "team";
      founder: { role: string; name: string; credits: readonly string[] };
    })
  | (Base & { kind: "close"; lede: string; contact: string })
  | (Base & { kind: "sources" });

export type SlideKind = Slide["kind"];

export const SLIDES: readonly Slide[] = [
  {
    id: "cover",
    kind: "cover",
    section: "Cover",
    eyebrow: "Investor presentation · October 2026",
    title: "Sovereign AI capacity, online in 90 days.",
    lede: "ZODE manufactures rapidly deployable data centers and sells the compute.",
    meta: "ZODE Inc.",
    image: "/images/future-home/zode-hero.jpg",
    ground: "ink",
  },
  {
    id: "macro",
    kind: "stats",
    section: "Macro",
    eyebrow: "Macro",
    title: "Demand for compute is outrunning powered capacity.",
    ground: "ink",
    stats: [
      { value: "~$700B", label: "AI capex", art: "capital" },
      { value: "57 GW", label: "power gap", art: "power" },
      { value: "$3.75–5", label: "per GPU-hour", art: "compute" },
    ],
    trend: "AI tokens per month",
    statement: "Capital, GPUs and powered land are available. Converting energy to tokens is the hard part.",
    chain: [
      { label: "Capital", art: "capital" },
      { label: "Land", art: "land" },
      { label: "Data center", art: "datacenter", hard: true },
      { label: "Compute", art: "compute" },
      { label: "Offtake", art: "offtake" },
    ],
    sources: ["capex", "morganStanley", "zodePricing", "googleTokens", "goldmanTokens"],
  },
  {
    id: "demand",
    kind: "demand",
    section: "Demand",
    eyebrow: "Macro · Demand",
    title: "Demand is outrunning what the grid can connect.",
    ground: "ink",
    sources: ["bnef", "epri", "utilityDive", "cbre", "jll"],
  },
  {
    id: "shortfall",
    kind: "shortfall",
    section: "Shortfall",
    eyebrow: "Macro · Shortfall",
    title: "A 33 GW gap through 2028.",
    ground: "ink",
    sources: ["morganStanley"],
  },
  {
    id: "problem",
    kind: "problems",
    section: "Problem",
    eyebrow: "Problem",
    title: "Data centers are slow to build and hard to host.",
    ground: "ink",
    groups: [
      {
        label: "Building",
        lead: {
          title: "Regulation moves at a crawl.",
          body: "Monolithic campuses face years of permits, zoning and hearings, and any one can kill the project.",
          art: "regulation",
          hard: true,
        },
        rest: [
          { title: "Patchwork local builds", art: "localBuild" },
          { title: "Volatile supply chains", art: "supplyChain" },
          { title: "Risk capital stays away", art: "financing" },
        ],
      },
      {
        label: "Community",
        lead: {
          title: "Huge, loud and ugly.",
          body: "Windowless monoliths that hum day and night next to homes.",
          art: "monolith",
        },
        rest: [
          { title: "Water drawn for cooling", art: "water" },
          { title: "Higher power bills", art: "powerBill" },
          { title: "No share of the upside", art: "economics" },
        ],
      },
    ],
  },
  {
    id: "states",
    kind: "states",
    section: "State moratoriums",
    eyebrow: "Policy",
    title: "States are starting to say no.",
    ground: "ink",
    sources: ["ncsl", "newYork", "texas", "oregon", "ercot", "moratoriumNation"],
  },
  {
    id: "local",
    kind: "news",
    section: "Local pauses",
    eyebrow: "Policy · Local",
    title: "Local pauses are spreading.",
    ground: "ink",
    sources: ["dataCenterWatch"],
  },
  {
    id: "solution",
    kind: "solution",
    section: "Solution",
    eyebrow: "Solution",
    title: "Sovereign AI capacity, factory-made.",
    ground: "white",
    facts: [
      { value: "90 days", label: "Order to production" },
      { value: "Tier III", label: "N+1 power and cooling" },
      { value: "NVIDIA", label: "Reference architecture" },
    ],
  },
  {
    id: "principles",
    kind: "principles",
    section: "Design principles",
    eyebrow: "Solution · Design principles",
    title: "Sovereign, distributed, sustainable, open.",
    ground: "white",
  },
  {
    id: "problem-solution",
    kind: "problemSolution",
    section: "Differentiation",
    eyebrow: "Differentiation",
    title: "Why data centers stall and ZODEs fly.",
    ground: "white",
    columns: ["What stops data centers", "How ZODE solves it"],
    rows: [
      {
        art: "datacenter",
        hard: true,
        problem: {
          title: "Community opposition",
          stat: { value: "71%", label: "Oppose a data center near them", cite: "heatmap" },
        },
        solution: {
          title: "Small, quiet and beautiful.",
          body: "4 MW in existing buildings, owned by the communities that host them. No evaporative water, no gas plant.",
        },
      },
      {
        art: "power",
        problem: {
          title: "Grid connection",
          stat: { value: "160+", label: "Weeks for a substation transformer", cite: "transformers" },
        },
        solution: {
          title: "Already energized.",
          body: "Powered buildings and colocation, connected today. 928 MW of power partner sites under LOI.",
        },
      },
      {
        art: "offtake",
        problem: {
          title: "Permitting and zoning",
          stat: { value: "18", label: "States where lawmakers moved to ban data centers", cite: "ncsl" },
        },
        solution: {
          title: "Under the statewide thresholds.",
          body: "New York's pause starts at 50 MW, Texas's at 75 MW. A ZODE cluster is 4 MW, in an existing powered building.",
        },
      },
    ],
    sources: ["heatmap", "transformers", "ncsl"],
  },
  {
    id: "stack",
    kind: "stack",
    section: "The stack",
    eyebrow: "Solution · Stack",
    title: "Vertically integrated, from dirt to tokens.",
    ground: "paper",
    lede: [
      "ZODE builds every layer itself, from the land and power to the network that delivers tokens.",
      "ZODEs are factory-made in North America and ship complete, weather-rated from -40°F to 115°F.",
    ],
  },
  {
    id: "how",
    kind: "steps",
    section: "How we scale",
    eyebrow: "How we scale",
    title: "Contract first. Build second.",
    ground: "white",
    steps: [
      {
        title: "Sign offtake",
        body: "Take-or-pay GPU-hour contracts, 3–5 years, with 25–30% prepaid.",
        art: "signature",
      },
      { title: "Secure power", body: "Lease colocation or convert existing powered buildings.", art: "interconnect" },
      {
        title: "Finance the project",
        body: "One SPV per cluster: prepayment, GPU debt and preferred equity.",
        art: "capitalStack",
      },
      { title: "Produce tokens", body: "Deploy, accept and operate the cluster for the term.", art: "tokenMaze" },
    ],
    statement: ["No megawatt is built without a buyer.", "Every dollar of capex sits behind a signed contract."],
  },
  {
    id: "unit",
    kind: "unit",
    section: "Unit economics",
    eyebrow: "Unit economics",
    title: "One standard cluster: 2,048 GPUs in 4 MW.",
    ground: "paper",
    specs: [
      { value: "256", label: "Nodes · 8× NVIDIA B300 each", icon: "node" },
      { value: "2,048", label: "NVIDIA B300 GPUs, Blackwell Ultra", icon: "gpu" },
      { value: "4 MW", label: "Critical IT load, direct liquid cooling", icon: "power" },
      { value: "800G", label: "Quantum-X800 InfiniBand fabric", icon: "fabric" },
      { value: "2 PB", label: "High-performance storage", icon: "storage" },
      { value: "$4.20", label: "Contracted price per GPU-hour, 5-year term", icon: "rate" },
      { value: "$12.5M", label: "Year 1 net profit, after depreciation and interest", icon: "profit" },
      { value: "$75M", label: "Annual contracted revenue at $4.20/GPU-hr", icon: "revenue" },
    ],
    highlight: 7,
    image: "/images/deck/cluster-2048.png",
    links: [
      { label: "Cluster builder", href: "/cluster-builder?nodes=256&tb=8" },
      { label: "Compute model", href: "/compute-model" },
    ],
  },
  {
    id: "traction",
    kind: "traction",
    section: "Traction",
    eyebrow: "Traction",
    title: "$485M contracted. $20B in LOIs.",
    ground: "paper",
    block: { usd: 375e6, note: "Each block is one 4 MW cluster, about $375M of contract value." },
    contracted: { value: "$485M", label: "Contracted revenue, signed", usd: 485e6 },
    loi: { value: "$20B", label: "In letters of intent", usd: 20e9 },
    demand: {
      title: "Real life demand-side contract",
      rows: [
        { label: "Contract value", value: "$376.8M" },
        { label: "Capacity", value: "2,048 B300 · 256 nodes · ~4 MW" },
        { label: "Price and term", value: "$4.20 per GPU-hour · 5 years" },
        { label: "Prepayment", value: "$103.6M (27.5%)" },
        { label: "Delivery", value: "February 2027" },
      ],
    },
    supply: {
      title: "Real life supply-side contract",
      rows: [
        { label: "Colocation lease", value: "$170/kW-mo · ~$8.2M/yr per 4 MW + NNN and electricity" },
        { label: "Building conversion", value: "$5M per MW · ~$20M per 4 MW" },
      ],
    },
    customers: [
      {
        label: "LOI",
        logos: [
          { name: "Crusoe", src: `${LOGO_DIR}/crusoe.svg`, aspect: 119 / 29, scale: 1.1 },
          { name: "Thinking Machines", src: `${LOGO_DIR}/thinking-machines.svg`, aspect: 1114.8 / 70, scale: 1.1 },
          { name: "Together AI", src: `${LOGO_DIR}/together-ai.svg`, aspect: 119 / 26, scale: 1.12 },
          { name: "San Francisco Compute Company", src: `${LOGO_DIR}/sf-compute.svg`, aspect: 2000 / 336, scale: 1.05 },
        ],
      },
      {
        label: "Pipeline",
        logos: [
          { name: "Anthropic", src: `${LOGO_DIR}/anthropic.svg`, aspect: 1024.2 / 115, scale: 0.88 },
          { name: "OpenAI", src: `${LOGO_DIR}/openai.svg`, aspect: 288 / 78 },
          { name: "SpaceXAI", src: `${LOGO_DIR}/spacexai.svg`, aspect: 1294 / 158, scale: 1.3 },
        ],
      },
    ],
  },
  {
    id: "pipeline",
    kind: "pipeline",
    section: "Pipeline",
    eyebrow: "Pipeline",
    title: "66.8 MW ready to close.",
    ground: "white",
    sites: [
      { site: "Chicago, IL", map: "chicago", path: "Lease", mw: "24.0", status: "Contracted" },
      { site: "Olds, AB", map: "olds", path: "Purchase", mw: "22.0", status: "LOI, lead position" },
      { site: "Calgary, AB", map: "calgary", path: "Purchase", mw: "13.0", status: "In diligence" },
      { site: "Milton, ON", map: "milton", path: "Joint venture", mw: "6.6", status: "In diligence" },
      { site: "Mississauga, ON", map: "mississauga", path: "Colocation", mw: "1.2", status: "In diligence" },
    ],
    total: "66.8",
    capacity: [
      { value: "~925 MW", label: "Under LOI" },
      { value: "1 GW+", label: "In active negotiations" },
    ],
    plan: [
      { year: "2026", value: "100 MW" },
      { year: "2027", value: "1 GW" },
      { year: "2028", value: "10 GW" },
      { year: "2029", value: "100 GW" },
      { year: "2030", value: "Singularity" },
    ],
    planNote: ["Every MW is worth $18.8M in annual revenue", "and $50–75M in enterprise value (2.7–4.0× revenue)."],
    planBasis: "Enterprise value per MW as CoreWeave, Nebius and IREN traded on October 13, 2026.",
    sources: ["evPerMw"],
  },
  {
    id: "advantage",
    kind: "comparison",
    section: "Competitive advantage",
    eyebrow: "Competitive advantage",
    title: "Faster to tokens, at a lower basis.",
    ground: "white",
    columns: ["Conventional build", "ZODE"],
    rows: [
      { label: "Sequencing", them: "Build, then find tenants", us: "Contract first, build second" },
      { label: "Time to tokens", them: "Years", us: "90 days from order" },
      { label: "Cost per MW", them: "$10–12M", us: "~$5M target on conversions" },
      { label: "Site basis", them: "Greenfield at market", us: "Powered buildings near 15¢ on the dollar" },
      { label: "Supply", them: "Allocation queues", us: "Direct with Pegatron, NVIDIA, Tier-1 integrators" },
      { label: "Footprint", them: "One campus", us: "Distributed, sovereign sites" },
    ],
    note: "Cost per MW on conversions is a target, not yet proven at scale.",
  },
  {
    id: "finance",
    kind: "finance",
    section: "Project finance",
    eyebrow: "Project finance",
    title: "Every cluster is its own financeable project.",
    ground: "paper",
    deals: [
      {
        id: "compute",
        icon: "prepay",
        title: "Compute deal",
        purpose: "Equity and debt for compute delivery",
        body: "The customer's take-or-pay contract funds delivery: part prepaid, the rest preferred equity and debt.",
        layers: [
          { label: "Preferred equity", kind: "equity", terms: ["18% pref · 1.5x minimum"] },
          { label: "Customer prepayment", kind: "debt", terms: ["25–30% of contract value"] },
          { label: "Project debt", kind: "debt", terms: ["8–15% interest"] },
        ],
      },
      {
        id: "realEstate",
        icon: "building",
        title: "Real estate deal",
        purpose: "Equity and debt for site acquisition",
        body: "Buys the powered building the cluster runs in, and pays for its conversion.",
        layers: [
          { label: "Real estate equity", kind: "equity", terms: ["Purchase · $1M per MW"] },
          { label: "Conversion debt", kind: "debt", terms: ["Conversion · $5M per MW"] },
          { label: "Mortgage debt", kind: "debt", terms: ["20-year amortizing"] },
        ],
      },
      {
        id: "gpu",
        icon: "gpuDebt",
        title: "GPU deal",
        purpose: "Debt for GPUs",
        body: "Senior debt secured on the GPUs, repaid from the contracted compute revenue.",
        layers: [
          {
            label: "Senior GPU debt",
            kind: "debt",
            terms: ["Sized to 1.15x DSCR", "8–15% interest", "80% LTV", "3-year term", "10% capital reserve · USD.AI"],
          },
        ],
      },
    ],
    example: {
      title: "Example · All three deals together: Alberta, 22 MW, with a purchased building",
      layers: [
        { label: "Preferred equity", deal: "compute", kind: "equity", value: "$83.2M", usd: 83.2e6 },
        { label: "Customer prepayment", deal: "compute", kind: "debt", value: "$622.3M", usd: 622.3e6 },
        { label: "Real estate equity", deal: "realEstate", kind: "equity", value: "$22.0M", usd: 22e6 },
        { label: "Conversion debt", deal: "realEstate", kind: "debt", value: "$110.0M", usd: 110e6 },
        { label: "Senior GPU debt", deal: "gpu", kind: "debt", value: "$302.3M", usd: 302.3e6 },
      ],
      total: "$1,139.8M",
      note: "Preliminary, per the project model: 11,264 GPUs at $4.20 per GPU-hour over 5 years, 30% prepaid; $1M per MW to buy, $5M to convert. Project and mortgage debt not shown.",
    },
  },
  {
    id: "raise",
    kind: "raise",
    section: "The raise",
    eyebrow: "The raise",
    title: "One equity facility for every ZODE cluster.",
    ground: "ink",
    hero: { value: "$20M", label: "First close · Preferred project equity" },
    terms: [
      "18% preferred return, 1.5x minimum multiple",
      "Right to fund each subsequent cluster",
      "Senior GPU debt and prepayments alongside",
    ],
    uses: ["Chicago cluster equity", "Chicago lease deposit", "Alberta site acquisition", "Working capital"],
    total: "$20M",
  },
  {
    id: "team",
    kind: "team",
    section: "Leadership",
    eyebrow: "Leadership",
    title: "Led by a four-time founder.",
    ground: "white",
    founder: {
      role: "Founder and CEO",
      name: "Matthew J. Dorey",
      credits: [
        "Co-founder and Executive Chairman, Wilder World",
        "Founder and CTO, ZERO encrypted communications protocol",
        "Founder, Factory Zero venture studio",
        "Founder and CEO, Curve Dental; sold to private equity",
      ],
    },
  },
  {
    id: "close",
    kind: "close",
    section: "Contact",
    eyebrow: "ZODE",
    title: "From order to tokens in 90 days.",
    ground: "ink",
    lede: "Raising a $20M first close in preferred project equity, alongside senior GPU debt and customer prepayments.",
    contact: "hello@zode.org · zode.org",
  },
  {
    id: "sources",
    kind: "sources",
    section: "Sources",
    eyebrow: "Sources",
    title: "Every figure, cited.",
    ground: "paper",
  },
];
