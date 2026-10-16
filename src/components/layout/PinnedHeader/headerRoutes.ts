import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { useContext } from "react";
import { isPortalPath } from "@/features/account/useAccount";
import { INVEST_ACTION } from "@/lib/navigation";

/**
 * Where the header sits on a route; each maps to an `--edge-*` token
 * (globals.css) shared with that route's own content.
 */
export type HeaderPlacement = "wide" | "tight" | "flush" | "deck";

export type HeaderAction = { readonly label: string; readonly href: string; readonly scroll?: boolean };

export type HeaderRoute = {
  readonly placement: HeaderPlacement;
  /** The split button's link; `null` leaves just the menu toggle, e.g. on the page it links to. */
  readonly primary: HeaderAction | null;
  /**
   * Width of a full-height panel in the top-right corner above 900px, so the
   * right-hand group sits beside it rather than over its close button.
   */
  readonly clear: number;
  /** Folds the Back pill down to its arrow, as on the home page. */
  readonly compactBack: boolean;
  readonly portal: boolean;
  /** Pages with branding of their own (the standalone log in), where the header fades out. */
  readonly hidden: boolean;
};

export const BUY_COMPUTE: HeaderAction = { label: "Buy Compute", href: "/buy-compute" };

const SITE: HeaderRoute = {
  placement: "wide",
  primary: BUY_COMPUTE,
  clear: 0,
  compactBack: false,
  portal: false,
  hidden: false,
};
const HOME: HeaderRoute = { ...SITE, compactBack: true };
const DECK: HeaderRoute = { ...SITE, placement: "deck", primary: INVEST_ACTION };
const PORTAL: HeaderRoute = { ...SITE, placement: "flush", portal: true };
const HIDDEN: HeaderRoute = { ...SITE, hidden: true };

/** Full-window tools: tucked into the corners, beside their settings panel. */
const TOOLS: Record<string, HeaderRoute> = {
  "/buy-compute": { ...SITE, placement: "tight", primary: null, clear: 460 },
  "/compute-model": { ...SITE, placement: "tight", primary: null, clear: 440 },
  "/cluster-builder": { ...SITE, placement: "tight", primary: null, clear: 440 },
};

const HIDDEN_PATHS = ["/login", "/register", "/dev"];

/** Routes `app/@modal` intercepts: a link to one opens it over the current page; only a hard load shows it as a page. */
export const MODAL_PATHS: ReadonlySet<string> = new Set(["/invest", "/talk-to-an-engineer", "/login", "/register"]);

/**
 * The current pathname, as `usePathname()` reads it but without the hook's
 * prerender hang on routes whose params aren't known at build time, which
 * would hold the header out of their static shell (and a Suspense boundary
 * around it would stream it in after the page). A route's placement only
 * depends on the segments its pattern already fixes.
 */
export function useRoutePathname(): string {
  return useContext(PathnameContext) ?? "/";
}

function under(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** The header for `pathname`; the same object for routes that share one, so callers can compare by identity. */
export function headerFor(pathname: string): HeaderRoute {
  if (pathname === "/") return HOME;
  if (isPortalPath(pathname)) return PORTAL;
  if (under(pathname, "/deck")) return DECK;
  const tool = Object.keys(TOOLS).find((path) => under(pathname, path));
  if (tool) return TOOLS[tool];
  if (HIDDEN_PATHS.some((path) => under(pathname, path))) return HIDDEN;
  return SITE;
}
