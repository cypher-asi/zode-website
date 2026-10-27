import type { SiteMapId } from "./art/siteMaps";
import type { UnitIconId } from "./art/UnitIcon";
import type { Contributions } from "./github";
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
      /** One SPV per half. Clicking it opens the matching summary in `RAISE_DETAILS`. */
      deals: readonly {
        id: string;
        icon: UnitIconId;
        title: string;
        /** What the SPV does, in one line. */
        overview: string;
        /** Nodes, GPUs and power. */
        fleet: readonly Stat[];
        /** Capital stack, top to bottom: equity over debt, the most senior last. `returns` is that layer's investor IRR and multiple. */
        layers: readonly {
          label: string;
          kind: "equity" | "debt";
          value: string;
          terms: readonly string[];
          returns?: string;
        }[];
      }[];
      /** Where the figures come from, behind the disclaimer under the deals. */
      note: string;
    })
  | (Base & {
      kind: "model";
      /** The sites in the program. */
      sites: readonly { name: string; figure: string; detail: string }[];
      sitesNote: string;
      /** Capital stack, top to bottom: equity over debt, the most senior last. */
      layers: readonly { label: string; kind: "equity" | "debt"; value: string; terms: readonly string[] }[];
      /** Under the stack, where a dollar figure was not kept in the run. */
      stackNote?: string;
      /** Uses, equity calls and residual. */
      facts: readonly Stat[];
      /** Downside, base and upside. One group per investor class. */
      cases: {
        label: string;
        columns: readonly string[];
        groups: readonly {
          label: string;
          rows: readonly { label: string; cells: readonly string[] }[];
        }[];
      };
      /** A short comparison under the cases, such as other exits. */
      aside?: { label: string; rows: readonly Stat[] };
      note: string;
    })
  | (Base & {
      kind: "team";
      founder: {
        role: string;
        name: string;
        /** Drawn as marks beside the role, in this order. */
        social: readonly { network: "linkedin"; label: string; href: string }[];
        /** The ventures, under a label of their own. */
        main: {
          title: string;
          /** Each company's years tagged beside its name, which links out where it has a site; any outcome beside the description. */
          ventures: readonly {
            company: string;
            href?: string;
            years: string;
            role: string;
            description: string;
            outcome?: string;
          }[];
        };
        /** Set much smaller under the ventures, as one line of links. */
        side: { title: string; links: readonly { label: string; href: string }[] };
        /** Drawn under the side projects; `FOUNDER_CONTRIBUTIONS` in `./github`. */
        contributions?: Contributions;
      };
      /** One column per area: its key partner over the team members from it. */
      network: {
        title: string;
        partnerLabel: string;
        areas: readonly { label: string; partner: Logo; logos: readonly Logo[] }[];
      };
    })
  | (Base & { kind: "close"; lede: string; contact: string })
  | (Base & { kind: "sources" });

export type SlideKind = Slide["kind"];

export const SLIDES: readonly Slide[] = [
  {
    id: "cover",
    kind: "cover",
    section: "Cover",
    eyebrow: "Investor presentation · Q4 2026",
    title: "The Sovereign Intelligence Network",
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
    sources: ["bnef", "epri", "utilityDive"],
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
        ],
      },
    ],
  },
  {
    id: "team",
    kind: "team",
    section: "Team",
    eyebrow: "Team",
    title: "Led by a three-time founder.",
    ground: "paper",
    founder: {
      role: "Founder & CEO",
      name: "Matthew J. Dorey",
      social: [{ network: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/frank-wilder/" }],
      main: {
        title: "Main quests",
        ventures: [
          {
            company: "Wilder World",
            href: "https://www.wilderworld.com",
            years: "2020–Present",
            role: "Co-founder, CEO & Executive Chairman",
            description: "Persistent simulation with Samsung, NVIDIA and Epic Games.",
            outcome: "$2 billion+ EV",
          },
          {
            company: "Factory ZERO",
            years: "2011–2020",
            role: "Co-founder & CEO",
            description: "Venture studio for Apple, Nike, Google and the Fortune 100.",
          },
          {
            company: "Curve Dental",
            href: "https://www.curvedental.com",
            years: "2004–2011",
            role: "Founder & CEO",
            description: "The #1 cloud-based dental EMR system.",
            outcome: "$1 billion+ EV",
          },
        ],
      },
      side: {
        title: "Side quests",
        links: [
          { label: "cypher.net", href: "https://cypher.net" },
          { label: "zero.tech", href: "https://zero.tech" },
          { label: "zchain.org", href: "https://zchain.org" },
          { label: "aura.ai", href: "https://aura.ai" },
          { label: "zine.live", href: "https://zine.live" },
        ],
      },
    },
    network: {
      title: "Team members from",
      partnerLabel: "Key partnership",
      areas: [
        {
          label: "Compute",
          partner: { name: "San Francisco Compute Company", src: `${LOGO_DIR}/sf-compute.svg`, aspect: 2000 / 336, scale: 0.91 },
          logos: [
            { name: "OpenAI", src: `${LOGO_DIR}/openai.svg`, aspect: 288 / 78, scale: 0.91, center: 31 / 78 },
            { name: "Lambda", src: `${LOGO_DIR}/lambda.svg`, aspect: 196 / 42, scale: 0.95 },
            { name: "Voltage Park", src: `${LOGO_DIR}/voltage-park.svg`, aspect: 2542 / 350, scale: 0.95 },
          ],
        },
        {
          label: "Capital markets",
          partner: { name: "Ezra", src: `${LOGO_DIR}/ezra.svg`, aspect: 299 / 92, scale: 0.89 },
          logos: [
            { name: "Goldman Sachs", src: `${LOGO_DIR}/goldman-sachs.svg`, aspect: 192.76 / 85.04, scale: 0.94 },
            { name: "Brookfield", src: `${LOGO_DIR}/brookfield.svg`, aspect: 240 / 35.933, scale: 0.84 },
            { name: "Merrill", src: `${LOGO_DIR}/merrill.svg`, aspect: 150 / 43, scale: 1.04 },
            { name: "Crusoe", src: `${LOGO_DIR}/crusoe.svg`, aspect: 119 / 29, scale: 1.04 },
          ],
        },
        {
          label: "Data centers",
          partner: { name: "Inovi", src: `${LOGO_DIR}/inovi.webp`, aspect: 900 / 212, scale: 0.82 },
          logos: [
            { name: "AWS", src: `${LOGO_DIR}/aws.svg`, aspect: 188.726 / 125.89, scale: 0.89 },
            { name: "Meta", src: `${LOGO_DIR}/meta.svg`, aspect: 948 / 191, scale: 0.87 },
            { name: "Google Cloud", src: `${LOGO_DIR}/google-cloud.svg`, aspect: 181 / 28, scale: 0.99 },
          ],
        },
        {
          label: "Manufacturing",
          partner: { name: "Foundry Robotics", src: `${LOGO_DIR}/foundry-robotics.svg`, aspect: 154 / 46, scale: 0.91 },
          logos: [
            { name: "SpaceX", src: `${LOGO_DIR}/spacex.svg`, aspect: 400 / 50, scale: 1.03 },
            { name: "Tesla", src: `${LOGO_DIR}/tesla.svg`, aspect: 993.047 / 100, scale: 0.95 },
            { name: "Blue Origin", src: `${LOGO_DIR}/blue-origin.svg`, aspect: 945 / 160, scale: 0.83 },
          ],
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
        us: { value: "90–180 days", label: "From order to production" },
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
    section: "Capital raise",
    eyebrow: "Capital raise",
    title: "Raising equity for ZODE Colo I and ZODE Retro I.",
    ground: "paper",
    deals: [
      {
        id: "colo",
        icon: "node",
        title: "ZODE Colo I",
        overview: "Leasing 50 MW of data center space.",
        fleet: [
          { value: "50", label: "MW" },
          { value: "$3.69B", label: "Contract value" },
          { value: "3,200", label: "Nodes" },
          { value: "25,600", label: "GPUs" },
        ],
        layers: [
          {
            label: "Site acquisition equity",
            kind: "equity",
            value: "$20.5M",
            terms: ["Lease NRCs and deposits"],
            returns: "17% IRR · 1.71x",
          },
          {
            label: "Compute equity",
            kind: "equity",
            value: "$336M",
            terms: ["15% simple · 1.5x minimum"],
            returns: "17% IRR · 1.71x",
          },
          { label: "Conversion debt", kind: "debt", value: "None", terms: ["Leased, built space"] },
          {
            label: "Customer prepayment",
            kind: "debt",
            value: "$935M",
            terms: ["25–30% of contract value"],
          },
          {
            label: "GPU financing",
            kind: "debt",
            value: "$817M",
            terms: ["12% · 1.15x DSCR · up to 80% LTV"],
          },
        ],
      },
      {
        id: "retro",
        icon: "building",
        title: "ZODE Retro I",
        overview: "Acquiring and converting 50 MW of data center space.",
        fleet: [
          { value: "51", label: "MW" },
          { value: "$3.41B", label: "Contract value" },
          { value: "3,072", label: "Nodes" },
          { value: "24,576", label: "GPUs" },
        ],
        layers: [
          {
            label: "Site acquisition equity",
            kind: "equity",
            value: "$193M",
            terms: ["12% pref · 95/5 co-invest"],
            returns: "39% IRR · 2.84x",
          },
          {
            label: "Compute equity",
            kind: "equity",
            value: "$373M",
            terms: ["15% simple · 1.5x minimum"],
            returns: "18% IRR · 2.51x",
          },
          {
            label: "Conversion debt",
            kind: "debt",
            value: "$255M",
            terms: ["55% of price · 60% of conversion · 11%"],
          },
          {
            label: "Customer prepayment",
            kind: "debt",
            value: "$853M",
            terms: ["25% of contract value"],
          },
          {
            label: "GPU financing",
            kind: "debt",
            value: "$874M",
            terms: ["12% · 1.15x DSCR · up to 80% LTV"],
          },
        ],
      },
    ],
    note: "Preliminary, from the October 2026 models: Colo I is the live base case, held through repayment, and Retro I the stored 51 MW sale case. Unsigned contracts assume 25% prepaid; GPU debt is sized to 1.15x DSCR, below its 80% LTV cap.",
  },
  {
    id: "close",
    kind: "close",
    section: "Contact",
    eyebrow: "ZODE",
    title: "From order to tokens in 90 days.",
    ground: "ink",
    lede: "Raising preferred equity in ZODE Colo I and ZODE Retro I.",
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

/**
 * Off the sequence: the raise slide opens each over the deck, from its two
 * deals. Printed, they follow that slide as pages.
 */
export const RAISE_DETAILS: readonly Extract<Slide, { kind: "model" }>[] = [
  {
    id: "colo",
    kind: "model",
    section: "ZODE Colo I",
    eyebrow: "ZODE Colo I",
    title: "Leasing 50 MW.",
    ground: "paper",
    sites: [
      { name: "Mississauga", figure: "2 MW", detail: "128 nodes" },
      { name: "Chicago", figure: "24 MW", detail: "1,536 nodes · one phase signed" },
      { name: "Next colo", figure: "24 MW", detail: "1,536 nodes · site unidentified" },
    ],
    sitesNote: "14 clusters, 2 with a signed contract. 3,200 nodes and 25,600 GPUs.",
    layers: [
      { label: "Site acquisition equity", kind: "equity", value: "$20.5M", terms: ["Lease NRCs"] },
      { label: "Compute equity", kind: "equity", value: "$336M", terms: ["15% simple · 1.5x"] },
      { label: "Conversion debt", kind: "debt", value: "None", terms: ["Leased space"] },
      { label: "Customer prepayment", kind: "debt", value: "$935M", terms: ["25–30%"] },
      { label: "GPU financing", kind: "debt", value: "$817M", terms: ["12% · 1.15x DSCR"] },
    ],
    facts: [
      { value: "$2.14B", label: "GPU hardware" },
      { value: "$3.69B", label: "Contract value" },
      { value: "$11M", label: "Equity by Jan 2027" },
      { value: "$75M", label: "Equity by Oct 2027" },
      { value: "$17M", label: "Receivable loan, peak" },
      { value: "$206M", label: "ZODE residual" },
    ],
    cases: {
      label: "Investor returns, hold",
      columns: ["Downside", "Base", "Upside"],
      groups: [
        {
          label: "Colo I investors",
          rows: [
            { label: "Capital", cells: ["$505M", "$356M", "$209M"] },
            { label: "IRR · multiple", cells: ["10% · 1.44x", "17% · 1.71x", "26% · 2.07x"] },
          ],
        },
      ],
    },
    note: "Live base case, held to repayment. One raise funds both equity layers. The Chicago lease is unsigned and the next colo is not yet a named site.",
  },
  {
    id: "retro",
    kind: "model",
    section: "ZODE Retro I",
    eyebrow: "ZODE Retro I",
    title: "Converting 50 MW with ZODE modules.",
    ground: "paper",
    sites: [
      { name: "Calgary I", figure: "22 MW", detail: "Five clusters · 2 MW third party" },
      { name: "Calgary II", figure: "13 MW", detail: "Three clusters · 1 MW third party" },
      { name: "Next 1", figure: "8 MW", detail: "Two clusters · not yet identified" },
      { name: "Next 2", figure: "8 MW", detail: "Two clusters · not yet identified" },
    ],
    sitesNote: "3,072 nodes · 24,576 GPUs.",
    layers: [
      { label: "Site acquisition equity", kind: "equity", value: "$193M", terms: ["12% pref · then 70/30"] },
      { label: "Compute equity", kind: "equity", value: "$373M", terms: ["15% simple · 1.5x"] },
      { label: "Conversion debt", kind: "debt", value: "$255M", terms: ["55% of price · 11%"] },
      { label: "Customer prepayment", kind: "debt", value: "$853M", terms: ["25%"] },
      { label: "GPU financing", kind: "debt", value: "$874M", terms: ["12% · 1.15x DSCR"] },
    ],
    facts: [
      { value: "$1.98B", label: "GPU hardware" },
      { value: "17% · 6.31x", label: "Site exit: hold to 2046" },
      { value: "39% · 2.84x", label: "Site exit: sale" },
      { value: "22% · 5.58x", label: "Site exit: refinancing" },
    ],
    cases: {
      label: "Investor returns, sale",
      columns: ["Downside", "Base", "Upside"],
      groups: [
        {
          label: "Site investors",
          rows: [
            { label: "Capital", cells: ["$271M", "$193M", "$148M"] },
            { label: "IRR · multiple", cells: ["13% · 1.48x", "39% · 2.84x", "55% · 4.01x"] },
          ],
        },
        {
          label: "Compute investors",
          rows: [
            { label: "Capital", cells: ["$677M", "$373M", "$271M"] },
            { label: "IRR · multiple", cells: ["12% · 2.51x", "18% · 2.51x", "25% · 2.68x"] },
          ],
        },
      ],
    },
    note: "October 20, 2026 sale case, with two sites not yet identified. Contract value, prepayment and GPU debt are the first GPU generation, from the workbook recalculated with those sites.",
  },
];

/**
 * Off the sequence: the demand slide opens each over the deck, from the
 * buttons in its side column. `summary` is set under each button's title: one
 * line of the slide's own figures, from the sources the deck already cites.
 */
export const DEMAND_DETAILS: readonly (Slide & { summary: string })[] = [
  {
    id: "shortfall",
    kind: "shortfall",
    section: "Shortfall",
    eyebrow: "Macro · Shortfall",
    title: "A 33 GW compute crunch through 2028.",
    summary: "97 GW of new load meets 64 GW of new power, leaving a third of demand unserved.",
    ground: "ink",
    sources: ["morganStanley"],
  },
  {
    id: "problem",
    kind: "problems",
    section: "Problem",
    eyebrow: "Problem",
    title: "Data centers are slow to build and hard to host.",
    summary: "A substation transformer takes 160+ weeks, and 71% of Americans oppose a data center near them.",
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
    summary: "Lawmakers in 18 states have moved to pause data centers; New York and Texas already have.",
    ground: "ink",
    sources: ["ncsl", "newYork", "texas", "oregon", "ercot", "moratoriumNation"],
  },
  {
    id: "local",
    kind: "news",
    section: "Local pauses",
    eyebrow: "Policy · Local",
    title: "Local pauses are spreading.",
    summary: "Local opposition blocked or delayed $198B of US projects in H1 2026, 120+ in all.",
    ground: "ink",
    sources: ["dataCenterWatch"],
  },
];
