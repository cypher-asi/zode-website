import type { SourceId } from "./research";

/** A slide's background; ink is the one dark ground. */
export type Ground = "white" | "paper" | "ink";

export interface Stat {
  readonly value: string;
  readonly label: string;
}

/** Line drawings for the macro slide's cards (art/MacroArt.tsx). */
export type MacroArtId = "capital" | "power" | "compute" | "land" | "datacenter" | "offtake";

/** One link in the chain from capital to offtake; `hard` marks the bottleneck. */
export interface ChainStep {
  readonly label: string;
  readonly art: MacroArtId;
  readonly hard?: boolean;
}

export interface Logo {
  readonly name: string;
  readonly src: string;
  /** Height in slide units, set by eye so the marks read at one size. */
  readonly height: number;
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
  /** A small row of logos at the foot's start. */
  readonly logos?: readonly Logo[];
}

const LOGO_DIR = "/images/deck/logos";

export type Slide =
  | (Base & { kind: "cover"; lede: string; meta: string; image: string })
  | (Base & {
      kind: "stats";
      stats: readonly (Stat & { art: MacroArtId })[];
      statement: string;
      chain: readonly ChainStep[];
    })
  | (Base & { kind: "demand" })
  | (Base & { kind: "shortfall" })
  | (Base & { kind: "states" })
  | (Base & { kind: "news"; takeaway: string })
  | (Base & {
      kind: "columns";
      columns: readonly { label: string; title: string; body: string }[];
      statement: string;
    })
  | (Base & { kind: "solution"; facts: readonly Stat[] })
  | (Base & {
      kind: "stack";
      lede: string;
      layers: readonly { index: string; title: string; body: string }[];
    })
  | (Base & { kind: "steps"; steps: readonly { title: string; body: string }[]; statement: string })
  | (Base & { kind: "unit"; specs: readonly Stat[]; highlight: number; image: string })
  | (Base & {
      kind: "traction";
      hero: Stat;
      /** Set under the hero, smaller, joined with a plus. */
      plus: Stat;
      details: readonly { label: string; value: string }[];
      notes: readonly { title: string; body: string }[];
    })
  | (Base & {
      kind: "pipeline";
      rows: readonly { site: string; path: string; mw: string; status: string }[];
      total: string;
      stats: readonly Stat[];
    })
  | (Base & { kind: "market"; hero: Stat; stats: readonly Stat[]; callout: Stat })
  | (Base & {
      kind: "comparison";
      columns: readonly [string, string];
      rows: readonly { label: string; them: string; us: string }[];
      note: string;
    })
  | (Base & {
      kind: "finance";
      stack: readonly { label: string; value: string }[];
      example: { title: string; rows: readonly { label: string; value: string }[]; note: string };
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
      { value: "~$700B", label: "Hyperscaler AI capex, 2026", art: "capital" },
      { value: "57 GW", label: "US power shortfall to 2028", art: "power" },
      { value: "$3.75–5", label: "B300 per GPU-hour", art: "compute" },
    ],
    statement: "Capital, GPUs and powered land are available. Converting energy to tokens is the main bottleneck.",
    chain: [
      { label: "Capital", art: "capital" },
      { label: "Land", art: "land" },
      { label: "Data center", art: "datacenter", hard: true },
      { label: "Compute", art: "compute" },
      { label: "Offtake", art: "offtake" },
    ],
    sources: ["capex", "morganStanley", "zodePricing"],
  },
  {
    id: "demand",
    kind: "demand",
    section: "Demand",
    eyebrow: "Macro · Demand",
    title: "Demand is outrunning what the grid can connect.",
    ground: "paper",
    sources: ["bnef", "epri", "utilityDive", "cbre", "jll"],
  },
  {
    id: "shortfall",
    kind: "shortfall",
    section: "Shortfall",
    eyebrow: "Macro · Shortfall",
    title: "A 33 GW gap through 2028, after every fix.",
    ground: "white",
    sources: ["morganStanley"],
  },
  {
    id: "problem",
    kind: "columns",
    section: "Problem",
    eyebrow: "Problem",
    title: "The constraint is power and time. Not capital.",
    ground: "paper",
    columns: [
      {
        label: "Power",
        title: "Energized sites are the scarce input.",
        body: "Liquid-cooled, high-density space is close to unavailable. New megawatts wait on utilities.",
      },
      {
        label: "Time",
        title: "Buildings lag the hardware.",
        body: "GPU nodes ship in 12–18 weeks. InfiniBand in 24–30. A conventional data center takes years.",
      },
      {
        label: "Cost",
        title: "Capacity is expensive to build.",
        body: "Market builds run $10–12M per MW. Modular vendor quotes run $9–11M per MW.",
      },
    ],
    statement: "Buyers already prepay 20–30% to lock capacity. Delivery is the bottleneck.",
  },
  {
    id: "states",
    kind: "states",
    section: "State moratoriums",
    eyebrow: "Policy",
    title: "States are starting to say no.",
    ground: "white",
    sources: ["ncsl", "newYork", "oregon", "dataCenterWatch"],
  },
  {
    id: "local",
    kind: "news",
    section: "Local pauses",
    eyebrow: "Policy · Local",
    title: "Local pauses are spreading.",
    ground: "paper",
    takeaway:
      "The bans target scale: 50 MW in New York, 100 MW in Delaware's bill, 20 MW in Maine's. A standard ZODE cluster is 4 MW, in an existing powered building.",
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
    id: "stack",
    kind: "stack",
    section: "The stack",
    eyebrow: "Solution · Stack",
    title: "Vertically integrated, from dirt to tokens.",
    ground: "paper",
    lede: "ZODE builds every layer itself, from the land and power to the network that delivers tokens. ZODEs are factory-made in North America and ship complete, weather-rated from -40°F to 115°F.",
    layers: [
      { index: "06", title: "Network", body: "Fiber and satellite uplinks" },
      { index: "05", title: "Edge routing", body: "Software that places workloads" },
      { index: "04", title: "Compute", body: "Dense, liquid-cooled GPU clusters" },
      { index: "03", title: "ZODE Pods", body: "Compute, Electrical and Cooling Pods" },
      { index: "02", title: "Power", body: "On-site generation and storage" },
      { index: "01", title: "Land", body: "Powered sites, owned or leased" },
    ],
  },
  {
    id: "how",
    kind: "steps",
    section: "How it works",
    eyebrow: "How it works",
    title: "Contract first. Build second.",
    ground: "white",
    steps: [
      { title: "Sign offtake", body: "Take-or-pay GPU-hour contracts, 3–5 years, with 25–30% prepaid." },
      { title: "Secure power", body: "Lease colocation or convert existing powered buildings." },
      { title: "Finance the project", body: "One SPV per cluster: prepayment, GPU debt and preferred equity." },
      { title: "Deliver tokens", body: "Deploy, accept and operate the cluster for the term." },
    ],
    statement: "No megawatt is built without a buyer. Every dollar of capex sits behind a signed contract.",
  },
  {
    id: "unit",
    kind: "unit",
    section: "The unit",
    eyebrow: "The unit",
    title: "One standard cluster: 2,048 GPUs in 4 MW.",
    ground: "paper",
    specs: [
      { value: "256", label: "Nodes · 8× NVIDIA B300 each" },
      { value: "~4 MW", label: "Critical IT load, direct liquid cooling" },
      { value: "800G", label: "Quantum-X800 InfiniBand fabric" },
      { value: "2 PB", label: "High-performance storage" },
      { value: "$4.20", label: "Contracted price per GPU-hour, 5-year term" },
      { value: "$75M", label: "Annual contracted revenue at $4.20/GPU-hr" },
    ],
    highlight: 5,
    image: "/images/future-home/zode-cutaway.jpg",
  },
  {
    id: "traction",
    kind: "traction",
    section: "Traction",
    eyebrow: "Traction",
    title: "$485M contracted. $20B in LOIs.",
    ground: "ink",
    hero: { value: "$485M", label: "Contracted revenue, signed" },
    plus: { value: "$20B", label: "In letters of intent" },
    details: [
      { label: "Anchor contract", value: "$376.8M · Chicago, IL" },
      { label: "Capacity", value: "2,048 B300 · 256 nodes · ~4 MW" },
      { label: "Price and term", value: "$4.20 per GPU-hour · 5 years" },
      { label: "Prepayment", value: "$103.6M (27.5%)" },
      { label: "Delivery", value: "February 2027" },
    ],
    notes: [
      { title: "Second offtake.", body: "Take-or-pay MSA signed July 2026. Being resized to 64 nodes on a 3-year term." },
      { title: "Power partner.", body: "LOI executed September 2026 for access to 928 MW across MT, ND, KY and TX." },
    ],
    logos: [
      { name: "Anthropic", src: `${LOGO_DIR}/anthropic.svg`, height: 0.72 },
      { name: "Crusoe", src: `${LOGO_DIR}/crusoe.svg`, height: 1.08 },
      { name: "Thinking Machines", src: `${LOGO_DIR}/thinking-machines.svg`, height: 0.66 },
      { name: "Together AI", src: `${LOGO_DIR}/together-ai.svg`, height: 1.08 },
      { name: "San Francisco Compute Company", src: `${LOGO_DIR}/sf-compute.svg`, height: 1.08 },
    ],
  },
  {
    id: "pipeline",
    kind: "pipeline",
    section: "Pipeline",
    eyebrow: "Pipeline",
    title: "66.8 MW on the critical path.",
    ground: "white",
    rows: [
      { site: "Chicago, IL", path: "Lease", mw: "24.0", status: "Contracted" },
      { site: "Olds, AB", path: "Purchase", mw: "22.0", status: "LOI, lead position" },
      { site: "Calgary, AB", path: "Purchase", mw: "13.0", status: "In diligence" },
      { site: "Milton, ON", path: "Joint venture", mw: "6.6", status: "In diligence" },
      { site: "Mississauga, ON", path: "Colocation", mw: "1.2", status: "Awaiting signature" },
    ],
    total: "66.8",
    stats: [
      { value: "~925 MW", label: "LOI-stage sites in TX, PA, AL, MO and AK" },
      { value: "928 MW", label: "Power partner sites under LOI" },
    ],
  },
  {
    id: "market",
    kind: "market",
    section: "Market",
    eyebrow: "Market",
    title: "Every megawatt is worth $18.8M a year.",
    ground: "paper",
    hero: { value: "$18.8M", label: "Annual revenue per IT MW at $4.20/GPU-hr" },
    stats: [
      { value: "20–30%", label: "Customer prepayment on 24–60 month terms" },
      { value: "~$10B", label: "Volta / Bitdeer contract value on 133 MW, 6 years" },
    ],
    callout: {
      value: "~$1.26B",
      label: "Implied annual revenue capacity of ZODE's 66.8 MW critical path at contracted pricing.",
    },
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
    stack: [
      { label: "Customer prepayment", value: "25–30% of contract value" },
      { label: "Senior GPU debt", value: "Sized to 1.15x DSCR" },
      { label: "Preferred equity", value: "18% pref · 1.5x minimum" },
      { label: "ZODE residual", value: "After debt and pref" },
    ],
    example: {
      title: "Example · Chicago",
      rows: [
        { label: "Prepayment", value: "$103.6M" },
        { label: "GPU debt", value: "~$52.5M" },
        { label: "Preferred equity", value: "~$28M" },
      ],
      note: "Preliminary, per current project model.",
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
