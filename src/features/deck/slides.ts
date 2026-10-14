import type { SiteMapId } from "./art/siteMaps";
import type { UnitIconId } from "./art/UnitIcon";
import { FOUNDER_CONTRIBUTIONS, type Contributions } from "./github";
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
  /** Where the lettering's middle sits, as a share of the height from the top, for marks a descender or swoosh pulls off centre. */
  readonly center?: number;
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
      /** One axis per row, each side's answer as a figure over its detail. */
      rows: readonly { label: string; them: Stat; us: Stat }[];
      /** The `highlight` row is set on grey, its figures larger, to stand out. */
      highlight: number;
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
      /** Set on ink under the cards, beside the note. */
      firstClose: Stat;
      cluster: { purpose: string; rows: readonly { label: string; value: string }[] };
      /** The issuer's capital stack, top to bottom: equity over debt, the most senior last. */
      capital: {
        purpose: string;
        layers: readonly { label: string; kind: "equity" | "debt"; value: string; terms: readonly string[] }[];
      };
      /** Each figure over the contract's term and as its yearly average. */
      revenue: {
        purpose: string;
        columns: readonly [string, string];
        rows: readonly { label: string; contract: string; annual: string }[];
      };
      /** Where the figures come from, in small type under the cards. */
      note: string;
    })
  | (Base & {
      kind: "team";
      founder: {
        role: string;
        name: string;
        linkedin: string;
        /** The ventures, under a label of their own. */
        main: {
          title: string;
          /** Each company's years tagged beside its name; the name and the outcome each link out where they have a site. */
          ventures: readonly {
            company: string;
            href?: string;
            years: string;
            role: string;
            description: string;
            outcome: string;
            outcomeHref?: string;
          }[];
        };
        /** Set much smaller under the ventures, as one line of links. */
        side: { title: string; links: readonly { label: string; href: string }[] };
        /** Drawn under the side projects. */
        contributions: Contributions;
      };
      /** The team, alliances and advisors, by area. */
      network: { title: string; areas: readonly { label: string; logos: readonly Logo[] }[] };
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
    title: "A 33 GW compute crunch through 2028.",
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
    title: "Designed for humanity.",
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
    sources: ["heatmap", "transformers", "ncsl", "newYork", "texas"],
  },
  {
    id: "stack",
    kind: "stack",
    section: "The stack",
    eyebrow: "Solution · Stack",
    title: "Vertically integrated, from dirt to tokens.",
    ground: "white",
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
    title: "Revenue is scaling vertically.",
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
          { name: "OpenAI", src: `${LOGO_DIR}/openai.svg`, aspect: 288 / 78, center: 31 / 78 },
          { name: "SpaceXAI", src: `${LOGO_DIR}/spacexai.svg`, aspect: 1294 / 158, scale: 1.3, center: 108 / 158 },
        ],
      },
    ],
  },
  {
    id: "team",
    kind: "team",
    section: "Leadership",
    eyebrow: "Leadership",
    title: "Led by a four-time founder.",
    ground: "paper",
    founder: {
      role: "Founder and CEO",
      name: "Matthew J. Dorey",
      linkedin: "https://www.linkedin.com/in/frank-wilder/",
      main: {
        title: "Main quests",
        ventures: [
          {
            company: "Wilder World",
            href: "https://wilderworld.com",
            years: "2020–Present",
            role: "Co-founder, CEO and Executive Chairman",
            description: "Persistent simulation with Samsung, NVIDIA, Epic Games and Lamborghini.",
            outcome: "$2 billion+ valuation",
          },
          {
            company: "Factory ZERO",
            years: "2011–2020",
            role: "Co-founder and CEO",
            description: "Venture studio for Apple, Nike, GE, Google and the Fortune 100.",
            outcome: "Became HF0",
            outcomeHref: "https://www.hf0.com",
          },
          {
            company: "Curve Dental",
            href: "https://www.curvedental.com",
            years: "2004–2011",
            role: "Founder and CEO",
            description: "The #1 cloud-based dental EMR system.",
            outcome: "$1 billion+ valuation",
          },
        ],
      },
      side: {
        title: "Side quests",
        links: [
          { label: "cypher.net", href: "https://cypher.net" },
          { label: "zode.tech", href: "https://zode.tech" },
          { label: "zchain.org", href: "https://zchain.org" },
          { label: "aura.ai", href: "https://aura.ai" },
          { label: "zine.live", href: "https://zine.live" },
        ],
      },
      contributions: FOUNDER_CONTRIBUTIONS,
    },
    network: {
      title: "Team members and strategic advisors from",
      areas: [
        {
          label: "Capital markets",
          logos: [
            { name: "Goldman Sachs", src: `${LOGO_DIR}/goldman-sachs.svg`, aspect: 192.76 / 85.04, scale: 0.9 },
            { name: "Brookfield", src: `${LOGO_DIR}/brookfield.svg`, aspect: 240 / 35.933, scale: 0.8 },
            { name: "Merrill", src: `${LOGO_DIR}/merrill.svg`, aspect: 150 / 43, scale: 1.15 },
          ],
        },
        {
          label: "Data centers",
          logos: [
            { name: "AWS", src: `${LOGO_DIR}/aws.svg`, aspect: 188.726 / 125.89, scale: 0.8 },
            { name: "Meta", src: `${LOGO_DIR}/meta.svg`, aspect: 948 / 191, scale: 0.9 },
            { name: "Google Cloud", src: `${LOGO_DIR}/google-cloud.svg`, aspect: 181 / 28, scale: 1.05 },
          ],
        },
        {
          label: "Manufacturing",
          logos: [
            { name: "SpaceX", src: `${LOGO_DIR}/spacex.svg`, aspect: 400 / 50, scale: 0.95 },
            { name: "Tesla", src: `${LOGO_DIR}/tesla.svg`, aspect: 993.047 / 100, scale: 0.85 },          ],
        },
      ],
    },
  },
  {
    id: "pipeline",
    kind: "pipeline",
    section: "Pipeline",
    eyebrow: "Pipeline",
    title: "66.8 MW ready to close.",
    ground: "paper",
    sites: [
      { site: "Illinois", map: "chicago", path: "Lease", mw: "24.0", status: "Contracted" },
      { site: "Alberta", map: "calgary", path: "Purchase", mw: "22.0", status: "LOI, lead position" },
      { site: "Alberta", map: "calgary", path: "Purchase", mw: "13.0", status: "In diligence" },
      { site: "Ontario", map: "milton", path: "Joint venture", mw: "6.6", status: "In diligence" },
      { site: "Ontario", map: "mississauga", path: "Colocation", mw: "1.2", status: "In diligence" },
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
    title: "Speed is currency.",
    ground: "paper",
    columns: ["Traditional developers", "ZODE"],
    rows: [
      {
        label: "Product",
        them: { value: "Powered shell", label: "Leased by the kW-month to a tenant" },
        us: { value: "Compute", label: "Sold by the GPU-hour, dirt to tokens" },
      },
      {
        label: "Sequencing",
        them: { value: "Build, then lease", label: "Speculative capex ahead of tenants" },
        us: { value: "Contract, then build", label: "Take-or-pay offtake, 25–30% prepaid" },
      },
      {
        label: "Power",
        them: { value: "New interconnect", label: "160+ weeks for a substation transformer" },
        us: { value: "Already energized", label: "Powered buildings and colocation" },
      },
      {
        label: "Site size",
        them: { value: "100 MW–1 GW+", label: "One campus, over the statewide pause thresholds" },
        us: { value: "4 MW", label: "Under New York's 50 MW and Texas's 75 MW" },
      },
      {
        label: "Cost per MW",
        them: { value: "~$17.6M", label: "Greenfield average, excluding GPUs" },
        us: { value: "~$5M", label: "Target, factory-made into existing buildings" },
      },
      {
        label: "Community",
        them: { value: "71% oppose", label: "Loud, water-cooled, no local upside" },
        us: { value: "Community-owned", label: "Quiet, no evaporative water" },
      },
      {
        label: "Time to tokens",
        them: { value: "3–5 years", label: "Land, permits, substation, then the build" },
        us: { value: "90 days", label: "From order to production" },
      },
    ],
    highlight: 6,
    note: "Cost per MW on conversions is a target, not yet proven at scale. Greenfield cost is Cushman & Wakefield's 2026 all-in average, excluding chips and GPUs. Traditional site size and time to tokens are ZODE's estimates for greenfield hyperscale campuses.",
    sources: ["heatmap", "transformers", "newYork", "texas", "cushmanCost"],
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
            terms: ["Sized to 1.15x DSCR", "8–15% interest", "80% LTV", "3-year term", "10% capital reserve"],
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
    title: "Raising equity for ZODE Super Cluster B, LLC.",
    ground: "paper",
    firstClose: { value: "$20M", label: "First close · Preferred equity in ZODE Super Cluster B, LLC" },
    cluster: {
      purpose: "NVIDIA B300 compute across six sites",
      rows: [
        { label: "Target power", value: "100 MW IT" },
        { label: "Target nodes", value: "6,400" },
        { label: "Target GPUs", value: "51,200" },
        { label: "Target sites", value: "6" },
      ],
    },
    capital: {
      purpose: "Equity over debt, the most senior last",
      layers: [
        { label: "Target equity", kind: "equity", value: "$135M", terms: ["18% pref · 1.5x minimum"] },
        { label: "Target project debt", kind: "debt", value: "$657M", terms: ["DSCR gap and site loans"] },
        { label: "Target GPU debt", kind: "debt", value: "$1.24B", terms: ["1.15x DSCR · 3-year term"] },
      ],
    },
    revenue: {
      purpose: "Take-or-pay at $4.20 per GPU-hour",
      columns: ["Contract · 5 yr", "Annual"],
      rows: [
        { label: "Contract value", contract: "$9.43B", annual: "$1.89B" },
        { label: "Contract EBITDA", contract: "$7.02B", annual: "$1.40B" },
        { label: "Contract net income", contract: "$2.01B", annual: "$403M" },
      ],
    },
    note: "Preliminary, per the project model: 51,200 GPUs at $4.20 per GPU-hour over 5 years, 30% prepaid ($2.83B, alongside); half the sites leased at $170/kW-mo, half bought at $1M per MW and converted at $5M. Project debt fills the GPU debt's DSCR gap at 12% interest-only, with $180M of site loans. Net income is after depreciation and interest, before income tax. Annual is the contract's yearly average.",
  },
  {
    id: "close",
    kind: "close",
    section: "Contact",
    eyebrow: "ZODE",
    title: "From order to tokens in 90 days.",
    ground: "ink",
    lede: "Raising a $20M first close in ZODE Super Cluster B, LLC, alongside project debt, senior GPU debt and customer prepayments.",
    contact: "hello@zode.org · zode.org",
  },
  {
    id: "sources",
    kind: "sources",
    section: "Sources",
    eyebrow: "Sources",
    title: "All sources.",
    ground: "paper",
  },
];
