export type LayerId = "network" | "routing" | "compute" | "pods" | "power" | "land";

export interface StackLayer {
  id: LayerId;
  title: string;
  body: string;
}

/** Top to bottom, in the order the plates are stacked. */
export const LAYERS: readonly StackLayer[] = [
  {
    id: "network",
    title: "Network",
    body: "Low-latency fiber and satellite uplinks connecting every site to the people and models it serves.",
  },
  {
    id: "routing",
    title: "Edge Routing",
    body: "Software that places each workload on the best available pod, balancing latency, cost, and capacity.",
  },
  {
    id: "compute",
    title: "Compute",
    body: "Dense, liquid-cooled GPU clusters ready for training and inference from day one.",
  },
  {
    id: "pods",
    title: "ZODE Pods",
    body: "Factory-built modules that ship, stack, and come online in weeks, not years.",
  },
  {
    id: "power",
    title: "Power",
    body: "On-site generation and storage that keeps every pod running independently of the grid.",
  },
  {
    id: "land",
    title: "Land",
    body: "Sites chosen for power, cooling, and sovereignty: the foundation everything stands on.",
  },
];
