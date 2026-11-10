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

/** How a cluster's output is sold; the unit slide switches its price figures between them. */
export type SaleModeId = "offtake" | "merchant" | "inference";

/** Half of a finance row: how its revenue is earned, or how its cost is funded. */
export interface FinancePart {
  label: string;
  value: string;
  /** Of the row, 0 to 1. */
  share: number;
  detail: string;
}

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

/** A project's site company or compute company on the raise slide. */
export interface RaiseEntity {
  /** What it holds, such as its GPUs. */
  readonly detail: string;
  /** What third parties put in; a figure ZODE funds alone is `source: "zode"`. */
  readonly value: string;
  readonly basis: string;
  readonly source?: "zode";
}

/** One row's capital stack on the raise slide. */
export interface RaiseStack {
  readonly row: "topco" | "propco" | "computeco";
  readonly label: string;
  /** What the row raises, in its details. */
  readonly raising: Stat;
  /**
   * Top to bottom: equity over debt, the most senior last; the stack's total
   * is their sum. `zode` layers are ZODE Inc.'s equity, paid from the seed, so
   * not raised here.
   */
  readonly layers: readonly {
    label: string;
    kind: "equity" | "debt";
    source?: "zode";
    /** In whole USD. */
    amount: number;
    terms: string;
  }[];
}

/** A quarter of the consolidated model on the revenue ramp, in whole USD; costs are positive. */
export interface RampQuarter {
  /** "Q3 2027". */
  readonly quarter: string;
  readonly revenue: { readonly inference: number; readonly merchant: number; readonly offtake: number };
  readonly costs: {
    /** Colocation rent, site and cluster operations. */
    readonly opCosts: number;
    readonly power: number;
    /** Interest and principal repaid. */
    readonly debtService: number;
    /** ZODE Inc.'s staffing and G&A. */
    readonly topco: number;
  };
}

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
      kind: "timeline";
      /** Ahead of the milestone, while the compute is held unsold; a drawing over each. */
      phases: readonly { title: string; body: string; art: MacroArtId }[];
      /** Set on the band under the phases, which runs up to the milestone. */
      position: string;
      milestone: { label: string; detail: string };
      /** The last card, past the milestone: its channels in place of a drawing, highest price first. */
      sale: { title: string; body: string; channels: readonly { title: string; body: string }[] };
      /** Each entry starts its own line. */
      statement: readonly string[];
    })
  | (Base & {
      kind: "unit";
      /** A toggle over the cards switches between these, the first shown first. */
      modes: readonly { id: SaleModeId; label: string }[];
      /** The `highlight` card is set on ink, to stand out. A figure that turns on the price gives one per mode. */
      specs: readonly ({ icon: UnitIconId } & (Stat | { byMode: Record<SaleModeId, Stat> }))[];
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
      /** The sites by how close they are to closing, each under its label: one mini-card per site, led by a line map of its city (art/SiteMap.tsx). */
      groups: readonly {
        label: string;
        mw: string;
        sites: readonly { site: string; map: SiteMapId; path: string; mw: string; status: string }[];
      }[];
      total: string;
      capacity: readonly Stat[];
      /** MW contracted by year, not yet live, drawn to a linear scale from `mw`; a row without it is drawn full, as the end of the scale. */
      plan: readonly { year: string; value: string; mw?: number }[];
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
      /** What the figures are per, over the stack. */
      basis: string;
      /**
       * One MW's stack, top to bottom: the revenue, then the costs it pays for, the largest first.
       * Each row's two parts sit side by side, each as wide as its `share`; a row's `total` must be the sum of its parts.
       */
      rows: readonly {
        icon: UnitIconId;
        title: string;
        kind: "revenue" | "cost";
        /** What the row is, under its title. */
        purpose: string;
        total: string;
        parts: readonly [FinancePart, FinancePart];
      }[];
      /** The costs summed, under the stack. */
      total: { label: string; value: string; detail: string };
      note: string;
    })
  | (Base & {
      kind: "ramp";
      /** One stacked bar each: the quarter's revenue, split into where it goes. */
      quarters: readonly RampQuarter[];
      /** Under the chart, beside its key. */
      caption: string;
      note: string;
    })
  | (Base & {
      kind: "raise";
      /** Across the top of the chart, over every project. */
      topco: { name: string; detail: string; uses: string };
      /** One column each. A leased site has no site company, so no `propCo`. */
      projects: readonly {
        name: string;
        detail: string;
        tenure: "lease" | "own";
        propCo?: RaiseEntity;
        computeCo: RaiseEntity;
      }[];
      /** On the far right, each beside its row of the chart. */
      stacks: readonly RaiseStack[];
      /** Where the figures come from, behind the disclaimer under the chart. */
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
  /** Ends the public deck, in place of the slides kept for the data room. */
  | (Base & { kind: "gate"; lede: string; loginHref: string })
  /** `cited` is every source a slide in the full deck cites. */
  | (Base & { kind: "sources"; cited: readonly SourceId[] });

export type SlideKind = Slide["kind"];

/**
 * The slides anyone can read, up to project finance. The rest of the deck
 * (slides.full.ts) is sent only to readers with data room access; everyone
 * else gets `GATE` after these.
 */
export const PUBLIC_SLIDES: readonly Slide[] = [
  {
    id: "cover",
    kind: "cover",
    section: "Cover",
    eyebrow: "Investor presentation · Q4 2026",
    title: "The industrialization of intelligence.",
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
      { value: "120 days", label: "Order to production" },
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
          body: "1 MW pods in existing buildings, owned by the communities that host them. No evaporative water, no gas plant.",
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
    kind: "timeline",
    section: "How we scale",
    eyebrow: "How we scale",
    title: "Maximally long compute.",
    ground: "white",
    phases: [
      { title: "Acquire", body: "Powered buildings and colocation, already energized.", art: "interconnect" },
      { title: "Build", body: "Factory-made ZODEs, in production 120 days from order.", art: "compute" },
      { title: "Equitize", body: "One SPV per cluster: preferred equity and GPU debt.", art: "capitalStack" },
    ],
    position: "Long compute: held unsold until RFS",
    milestone: { label: "RFS", detail: "Ready for service" },
    sale: {
      title: "Sell",
      body: "Close to RFS, for the most each GPU-hour will fetch.",
      channels: [
        { title: "Tokens", body: "Inference sold by the token, the highest yield." },
        { title: "Merchant compute", body: "GPU-hours at market rates." },
        { title: "Offtake", body: "Take-or-pay contracts, the floor." },
      ],
    },
    statement: [
      "We acquire, build and equitize ahead of the buyer,",
      "then sell close to RFS, for the most we can.",
    ],
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
      {
        icon: "rate",
        byMode: {
          offtake: { value: "$5.00", label: "Contracted price per GPU-hour, 5-year term" },
          merchant: { value: "$6.50", label: "Merchant price per GPU-hour, 100% utilized" },
          inference: { value: "$16.90", label: "Inference net revenue per GPU-hour" },
        },
      },
      {
        icon: "profit",
        byMode: {
          offtake: { value: "$26.3M", label: "Year 1 net profit, after all costs" },
          merchant: { value: "$37.8M", label: "Year 1 net profit, after all costs" },
          inference: { value: "$209.3M", label: "Year 1 net profit, after all costs" },
        },
      },
      {
        icon: "revenue",
        byMode: {
          offtake: { value: "$89.7M", label: "Annual contracted revenue at $5/GPU-hr" },
          merchant: { value: "$116.6M", label: "Annual merchant revenue at $6.50/GPU-hr" },
          inference: { value: "$303.2M", label: "Annual inference revenue at $16.90/GPU-hr" },
        },
      },
    ],
    modes: [
      { id: "offtake", label: "Offtake" },
      { id: "merchant", label: "Merchant" },
      { id: "inference", label: "Inference" },
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
            outcome: "$4 billion+ peak EV",
          },
          {
            company: "F0",
            years: "2011–2020",
            role: "Co-founder & CEO",
            description: "Venture studio for Apple, Nike, Google and the Fortune 100.",
            outcome: "Converted to HF0",
          },
          {
            company: "Curve Dental",
            href: "https://www.curvedental.com",
            years: "2004–2011",
            role: "Founder & CEO",
            description: "The #1 cloud-based dental EMR system.",
            outcome: "$1 billion+ current EV",
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
    title: "72.8 MW ready to close.",
    ground: "paper",
    groups: [
      {
        label: "Imminent",
        mw: "36.2",
        sites: [
          { site: "Mississauga", map: "mississauga", path: "Colocation", mw: "1.2", status: "In diligence" },
          { site: "Calgary", map: "calgary", path: "Purchase", mw: "22.0", status: "LOI" },
          { site: "Calgary", map: "calgary", path: "Purchase", mw: "13.0", status: "LOI" },
        ],
      },
      {
        label: "Soon",
        mw: "36.6",
        sites: [
          { site: "Illinois", map: "chicago", path: "Lease", mw: "30.0", status: "Contracted" },
          { site: "Ontario", map: "milton", path: "Joint venture", mw: "6.6", status: "In diligence" },
        ],
      },
    ],
    total: "72.8",
    capacity: [
      { value: "~925 MW", label: "Under LOI" },
      { value: "1 GW+", label: "In active negotiations" },
    ],
    plan: [
      { year: "2026", value: "1 MW", mw: 1 },
      { year: "2027", value: "100 MW", mw: 100 },
      { year: "2028", value: "1 GW", mw: 1_000 },
      { year: "2029", value: "10 GW", mw: 10_000 },
      { year: "2030", value: "Singularity" },
    ],
    planNote: [
      "Every MW earns $22.4M a year contracted, $29.2–75.8M",
      "as merchant or inference, and is valued at $50–75M.",
    ],
    planBasis:
      "Annual revenue per MW of IT load at $5.00 contracted, $6.50 merchant and $16.90 inference per GPU-hour. Value per MW as CoreWeave, Nebius and IREN traded on October 13, 2026.",
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
        label: "Sales",
        them: { value: "Build, then lease", label: "One tenant on one long lease" },
        us: { value: "Build, then sell", label: "Tokens, merchant and offtake, at the best price" },
      },
      {
        label: "Power",
        them: { value: "New interconnect", label: "160+ weeks for a substation transformer" },
        us: { value: "Already energized", label: "Powered buildings and colocation" },
      },
      {
        label: "Site size",
        them: { value: "100 MW–1 GW+", label: "One campus, over the statewide pause thresholds" },
        us: { value: "1–50 MW", label: "Up to New York's 50 MW, under Texas's 75 MW" },
      },
      {
        label: "Cost per MW",
        them: { value: "~$17.6M", label: "Greenfield average, excluding GPUs" },
        us: { value: "~$5M", label: "Target, factory-made into existing buildings" },
      },
      {
        label: "Community",
        them: { value: "71% oppose", label: "Loud, water-cooled, no local upside" },
        us: { value: "Community benefits", label: "Quiet, no evaporative water, beautiful, profit share" },
      },
      {
        label: "Time to tokens",
        them: { value: "3–5 years", label: "Land, permits, substation, then the build" },
        us: { value: "120 days", label: "From order to production" },
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
    basis: "One MW of critical IT load · 64 nodes · 512 GPUs",
    rows: [
      {
        icon: "revenue",
        title: "Compute",
        kind: "revenue",
        purpose: "Revenue per year",
        total: "$49.1M",
        parts: [
          { label: "Offtake", value: "$11.2M", share: 0.5, detail: "32 nodes · 256 GPUs at $5.00/GPU-hr" },
          { label: "Inference", value: "$37.9M", share: 0.5, detail: "32 nodes · 256 GPUs at $16.90/GPU-hr" },
        ],
      },
      {
        icon: "gpu",
        title: "GPU",
        kind: "cost",
        purpose: "64 nodes · 512 B300 GPUs",
        total: "$35.2M",
        parts: [
          { label: "Equity", value: "$17.6M", share: 0.5, detail: "50% of cost" },
          { label: "Debt", value: "$17.6M", share: 0.5, detail: "Secured on the GPUs" },
        ],
      },
      {
        icon: "building",
        title: "Data Center",
        kind: "cost",
        purpose: "Building conversion",
        total: "$5.0M",
        parts: [
          { label: "Equity", value: "$2.5M", share: 0.5, detail: "50% of cost" },
          { label: "Debt", value: "$2.5M", share: 0.5, detail: "Secured on the building" },
        ],
      },
      {
        icon: "power",
        title: "Land + Power",
        kind: "cost",
        purpose: "Powered site purchase",
        total: "$1.0M",
        parts: [
          { label: "Equity", value: "$0.5M", share: 0.5, detail: "50% of cost" },
          { label: "Debt", value: "$0.5M", share: 0.5, detail: "Secured on the land" },
        ],
      },
    ],
    total: { label: "Total cost", value: "$41.2M", detail: "$20.6M equity · $20.6M debt" },
    note: "Preliminary, fully utilized: half on a 5-year offtake at $5.00/GPU-hr, half as inference at $16.90 net. GPUs at $550K per node before tax and setup; data center at the ~$5M/MW target; land and power at $1M/MW.",
  },
];

/** The public deck's last slide. Logging in comes back to it, which a member then reads as the first of the data room's slides. */
export const GATE: Slide = {
  id: "gate",
  kind: "gate",
  section: "Data room",
  eyebrow: "Data room",
  title: "The raise is in the data room.",
  lede: "The capital raise, its SPV models and the rest of the deck are shared with investors who have VDR access.",
  ground: "ink",
  loginHref: `/login?next=${encodeURIComponent(`/deck?slide=${PUBLIC_SLIDES.length + 1}`)}`,
};

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
