import type { TerminalMenuItem } from "@/components/TerminalMenu";

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
