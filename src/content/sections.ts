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
  /** Single-letter monogram used as a placeholder badge. */
  readonly monogram: string;
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
    title: "The Product",
    lede: "ZODE is a rapidly deployable micro-data center.",
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
    lede: "Demand meets capacity — jobs route across ZODEs and settle in real time.",
    body: [],
    scene: "ecosystem-network",
    companies: [
      { name: "Vector Labs", monogram: "V" },
      { name: "Helix AI", monogram: "H" },
      { name: "Northwind", monogram: "N" },
      { name: "Cortex", monogram: "C" },
      { name: "Meridian", monogram: "M" },
      { name: "Orbital", monogram: "O" },
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
    id: "roadmap",
    label: "Roadmap",
    title: "Roadmap",
    lede: "From foundation to fully decentralized scale.",
    body: [
      "Near term: harden the core, expand operator onboarding, and grow the developer toolkit.",
      "Long term: progressive decentralization, broader interoperability, and ecosystem self-sustainability.",
    ],
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
];
