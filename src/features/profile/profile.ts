import { SLIDES, type Slide } from "@/features/deck/slides";

/**
 * The one-page company profile's content. Figures, sites and logos are read
 * from the investor deck's slides so the two can't drift apart; only the
 * profile's own copy and links live here.
 */

type Of<K extends Slide["kind"]> = Extract<Slide, { kind: K }>;

function slide<K extends Slide["kind"]>(kind: K): Of<K> {
  const found = SLIDES.find((s): s is Of<K> => s.kind === kind);
  if (!found) throw new Error(`The deck has no ${kind} slide`);
  return found;
}

export const COVER = slide("cover");
export const SOLUTION = slide("solution");
export const PIPELINE = slide("pipeline");
export const TRACTION = slide("traction");
export const TEAM = slide("team");

export const ABOUT =
  "Factory-made in North America and installed in buildings that already have power, a 4 MW cluster of 2,048 NVIDIA GPUs goes from order to production in 90 days. ZODE builds only once a customer has signed.";

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
