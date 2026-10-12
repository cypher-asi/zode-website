import type { TerminalMenuItem } from "@/components/ui/TerminalMenu";

/** Lead calls to action, in the same order and wording on every home page menu. */
export const COMPUTE_ACTIONS = [
  { id: "buy", label: "Buy Compute", href: "/buy-compute" },
  { id: "rent", label: "Rent Compute", href: "/buy-compute?mode=rent" },
] as const satisfies readonly TerminalMenuItem[];

/** Opens over the current page as a modal (see app/@modal), so it keeps the scroll position. */
export const ENGINEER_ACTION = {
  id: "engineer",
  label: "Talk to an Engineer",
  href: "/talk-to-an-engineer",
  scroll: false,
} as const satisfies TerminalMenuItem;

export interface NavLink {
  readonly label: string;
  readonly href: string;
  /** Opens in a new tab. */
  readonly external?: boolean;
}

/** Shared by the footer's Resources column and the header menu's Resources flyout. */
export const RESOURCE_LINKS: readonly NavLink[] = [
  { label: "News", href: "/news" },
  { label: "Changelog", href: "/changelog" },
  { label: "Whitepaper", href: "https://cypher.net/research/the-grid", external: true },
  { label: "Cluster configurator", href: "/cluster-configurator" },
  { label: "Compute model", href: "/compute-model" },
  { label: "Styleguide", href: "/styleguide" },
  { label: "Mutual NDA", href: "/mnda" },
];
