export type FeatureId = "rapid" | "redundant" | "weather" | "nvidia" | "tokens";

export interface Feature {
  id: FeatureId;
  /** Rendered on two lines at desktop widths. */
  title: readonly [string, string];
  body: string;
}

/** In figure order: the nth feature is captioned 0n. */
export const FEATURES: readonly Feature[] = [
  {
    id: "rapid",
    title: ["Rapid", "Deployment"],
    body: "Production in 90 days from order, anywhere in the world. Factory-built ZODEs ship complete and come online on arrival.",
  },
  {
    id: "redundant",
    title: ["Fully", "Redundant"],
    body: "Built to Tier III standards with N+1 redundancy across power and cooling, so maintenance never takes compute offline.",
  },
  {
    id: "weather",
    title: ["Weather", "Resistant"],
    body: "Sealed, climate-hardened enclosures run as well through an Alaskan winter as they do through a Texas summer.",
  },
  {
    id: "nvidia",
    title: ["NVIDIA", "Reference"],
    body: "Built on NVIDIA reference architecture, so every cluster is validated, supported, and ready for the latest GPUs.",
  },
  {
    id: "tokens",
    title: ["Token", "Ready"],
    body: "Power, cooling, and networking delivered all the way to the GPU. Bring your workload and start producing tokens.",
  },
];
