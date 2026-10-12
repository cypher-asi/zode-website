export type PrincipleId = "sovereign" | "sustainable" | "distributed" | "open";

export interface Principle {
  id: PrincipleId;
  title: string;
  body: string;
}

/** In card order: the nth principle is numbered 0n. */
export const PRINCIPLES: readonly Principle[] = [
  {
    id: "distributed",
    title: "Distributed",
    body: "Many smaller sites instead of one giant campus, close to their users, with no single point of failure.",
  },
  {
    id: "sustainable",
    title: "Sustainable",
    body: "Sited beside renewable and stranded power. Factory-built pods move instead of being torn down.",
  },
  {
    id: "sovereign",
    title: "Sovereign",
    body: "Rapidly deployable AI, owned by the companies, communities, and countries that deploy it.",
  },
  {
    id: "open",
    title: "Open Source",
    body: "Open standards and open software, from the rack to the orchestration layer. No lock-in.",
  },
];
