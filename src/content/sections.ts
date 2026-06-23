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
   * When set, the section renders a split layout: copy on the left and the
   * named interactive chart on the right. Currently only "energy-demand".
   */
  readonly chart?: string;
  /** Optional small print rendered beneath the split-layout copy. */
  readonly footnote?: string;
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
    media: {
      src: "/images/zode-one.jpg",
      alt: "Zode One data center rendering",
    },
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
    footnote: "Total global energy supply: ~160,000 - 170,000 TWh/year",
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
    title: "The Solution",
    lede: "A decentralized network with verifiable trust built in.",
    body: [
      "THE GRID distributes compute and storage across an open network, with cryptographic guarantees instead of blind trust.",
      "Workloads run where they are most efficient, while users retain ownership and control of their data end to end.",
    ],
  },
  {
    id: "ecosystem",
    label: "The Ecosystem",
    title: "The Ecosystem",
    lede: "An open ecosystem of operators, builders, and users.",
    body: [
      "Operators contribute capacity, builders ship applications, and users access services — all coordinated by the protocol.",
      "Aligned incentives keep the network growing, decentralized, and durable over time.",
    ],
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
    title: "Traction",
    lede: "Early signal across operators, developers, and usage.",
    body: [
      "Growing operator capacity, an expanding developer base, and increasing on-network activity demonstrate momentum.",
      "Replace this section with concrete metrics: active nodes, throughput, retention, and pipeline.",
    ],
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
