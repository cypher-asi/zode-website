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
   * When set, the section renders the "site" layout: cleaned terrain artwork
   * as a full-bleed background, a centered header, a Key Facts card on the
   * right, and a segmented green progress bar centered near the bottom.
   */
  readonly site?: SiteContent;
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
    title: "Deploy in months not years.",
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
        label: "Resilient",
        stat: "1 MW",
        description: "Harness existing clean energy sources with ease.",
      },
      {
        label: "Sustainable",
        stat: "0 carbon",
        description: "Contribute to people, communities, and the planet.",
      },
    ],
  },
  {
    id: "ecosystem",
    label: "The Network",
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
    id: "business-model",
    label: "Business Model",
    title: "Business Model",
    lede: "Usage-based economics that scale with the network.",
    body: [
      "Revenue is generated from network usage, premium services, and value-added tooling layered on the core protocol.",
      "Costs fall as the network scales, expanding margins while keeping pricing competitive for builders.",
    ],
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
    id: "platform",
    label: "Platform",
    title: "Platform",
    lede: "The tools and primitives developers build on.",
    body: [
      "A coherent platform of SDKs, APIs, and managed primitives makes the network easy to adopt and hard to leave.",
      "Everything is composable, observable, and secure by default.",
    ],
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
  {
    id: "opportunity",
    label: "Opportunity",
    title: "Opportunity",
    lede: "A foundational layer for the next era of compute.",
    body: [
      "The shift toward decentralized, verifiable infrastructure is early and large. THE GRID is positioned at its center.",
      "Join us in building the connective tissue for a more open and secure network.",
    ],
  },
];
