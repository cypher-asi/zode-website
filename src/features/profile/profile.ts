import { SLIDES, type Slide } from "@/features/deck/slides";
import type { PrincipleId } from "@/features/home/principles/principles";

/**
 * The one-page company profile's content. Figures and logos are read from the
 * investor deck's slides so the two can't drift apart, except the capacity
 * pipeline, which is live (pipeline.ts); only the profile's own copy and
 * links live here.
 */

type Of<K extends Slide["kind"]> = Extract<Slide, { kind: K }>;

function slide<K extends Slide["kind"]>(kind: K): Of<K> {
  const found = SLIDES.find((s): s is Of<K> => s.kind === kind);
  if (!found) throw new Error(`The deck has no ${kind} slide`);
  return found;
}

export const SOLUTION = slide("solution");
export const TRACTION = slide("traction");
export const TEAM = slide("team");

/** The deck's customer logos under LOI, without its prospective pipeline. */
export const CUSTOMERS = TRACTION.customers.filter((group) => group.label !== "Pipeline");

export const TAGLINE = "Sovereign Intelligence.";
export const LEDE = "ZODE manufactures rapidly deployable supercomputers.";

/** Shorter than the home page's descriptions, to keep each card to two lines. */
export const PRINCIPLE_LINES: Record<PrincipleId, string> = {
  sovereign: "Owned by the communities and countries that deploy it.",
  distributed: "Many small sites near their users, with no single point of failure.",
  sustainable: "Sited beside renewable and stranded power, in pods that move.",
  open: "Open standards and software, from the rack to orchestration.",
};

export const NETWORK_TITLE = "Strategic advisors and team members from";

/** What each of the founder's companies is, in a few words, keyed by the deck's company names. */
export const VENTURE_LINES: Record<string, string> = {
  "Wilder World": "Persistent simulation",
  "Factory ZERO": "Venture studio",
  "Curve Dental": "Cloud dental records",
};

export interface Resource {
  readonly label: string;
  /** Site paths are made absolute against the production origin, so they work from the PDF. */
  readonly href: string;
}

export const RESOURCES: readonly Resource[] = [
  { label: "Cluster builder", href: "/cluster-builder" },
  { label: "Compute model", href: "/compute-model" },
  { label: "Deck", href: "/deck" },
  { label: "Whitepaper", href: "https://cypher.net/research/the-grid" },
];

export const CONTACT = {
  email: "hello@zode.org",
  site: "/",
  engineer: "/talk-to-an-engineer",
} as const;

/** The sheet as a PDF, built by `npm run profile:pdf` (scripts/make-company-profile.mjs). */
export const PDF = { href: "/zode-company-profile.pdf", filename: "ZODE - Company profile.pdf" } as const;
