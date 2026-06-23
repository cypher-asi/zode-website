export interface SectionContent {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly lede: string;
  readonly body: readonly string[];
}

/**
 * The ten pitch sections rendered as one continuous scrolling page.
 * `id` is used as the scroll anchor and the tick-rail navigation key;
 * `label` is the short name shown in the rail's expanded menu. Copy is
 * placeholder and meant to be replaced.
 */
export const SECTIONS: readonly SectionContent[] = [
  {
    id: "overview",
    label: "Overview",
    title: "Overview",
    lede: "THE GRID is the connective layer for a decentralized, secure compute network.",
    body: [
      "THE GRID unifies fragmented infrastructure into a single, programmable fabric where data and compute flow freely and securely.",
      "This overview frames the opportunity, the thesis, and how the pieces fit together across the rest of this deck.",
    ],
  },
  {
    id: "problem",
    label: "The Problem",
    title: "The Problem",
    lede: "Today's infrastructure is centralized, opaque, and brittle.",
    body: [
      "Builders depend on a handful of providers, accepting lock-in, rising costs, and single points of failure.",
      "Sensitive data is concentrated, trust is assumed rather than verified, and resilience is an afterthought.",
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
