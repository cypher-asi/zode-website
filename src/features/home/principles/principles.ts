export type PrincipleId = "sovereign" | "sustainable" | "distributed" | "open";

export interface Principle {
  id: PrincipleId;
  title: string;
  body: string;
}

/** In card order: the nth principle is numbered 0n. */
export const PRINCIPLES: readonly Principle[] = [
  {
    id: "sovereign",
    title: "Sovereign",
    body: "Your models, your data, your hardware, on land you control. A ZODE is owned outright, not rented by the hour.",
  },
  {
    id: "sustainable",
    title: "Sustainable",
    body: "Sited beside renewable and stranded power. Factory-built pods cut construction waste and can be moved instead of torn down.",
  },
  {
    id: "distributed",
    title: "Distributed",
    body: "Many smaller sites instead of one giant campus. Compute runs close to its users, and no single outage takes the network down.",
  },
  {
    id: "open",
    title: "Open Source",
    body: "Built on open standards and open software, from the rack to the orchestration layer. Nothing proprietary between you and your compute.",
  },
];
