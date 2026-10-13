import { MAILING_LISTS } from "@/features/mailing-list/types";
import { ROLE_LABELS, ROLE_SLUGS, USER_ROLES, type UserRole } from "@/features/users/types";
import type { PortalIconName } from "./icons";

/** Wide enough for the rail, the sidebar and a usable panel; under it the sidebar hides. Matches shell.module.css. */
export const SIDEBAR_MEDIA = "(min-width: 1101px)";

/** How many apps the phone's tab bar holds before the rest move into More. */
export const TAB_BAR_APPS = 4;

export type NavLink = {
  href: string;
  label: string;
  icon: PortalIconName;
};

export type AppId =
  | "home"
  | "rooms"
  | "orders"
  | "contracts"
  | "zrm"
  | "capacity"
  | "posts"
  | "subscribers"
  | "users"
  | "settings";

/**
 * One of the portal's apps: an icon on the rail, and the links the sidebar
 * lists while you're in it. Data rooms lists the rooms themselves instead.
 */
export type PortalApp = {
  id: AppId;
  label: string;
  icon: PortalIconName;
  href: string;
  links: readonly NavLink[];
  /** A ZODE team app, set apart from everyone's apps on the rail. */
  team?: boolean;
  /** A shorter name for the phone's tab bar, where `label` wouldn't fit. */
  tabLabel?: string;
};

export type NavAccess = { admin: boolean; team: boolean };

/** The site's tools, listed under Home. */
export const TOOL_LINKS: readonly NavLink[] = [
  { href: "/buy-compute", label: "Buy compute", icon: "orders" },
  { href: "/cluster-builder", label: "Cluster builder", icon: "cluster" },
  { href: "/compute-model", label: "Compute model", icon: "chart" },
];

const HOME: PortalApp = {
  id: "home",
  label: "Home",
  icon: "home",
  href: "/portal",
  links: TOOL_LINKS,
};

/** Each order type's page in the Orders app, `/portal/orders/<id>`. */
export const ORDER_MODES: readonly { id: "buy" | "rent"; label: string; icon: PortalIconName }[] = [
  { id: "buy", label: "Purchases", icon: "cluster" },
  { id: "rent", label: "Rentals", icon: "recurring" },
];

const ROOMS: PortalApp = {
  id: "rooms",
  label: "Data rooms",
  tabLabel: "Rooms",
  icon: "rooms",
  href: "/portal/data-rooms",
  links: [],
};

const ORDERS: PortalApp = {
  id: "orders",
  label: "Orders",
  icon: "orders",
  href: "/portal/orders",
  links: [
    { href: "/portal/orders", label: "All orders", icon: "orders" },
    ...ORDER_MODES.map((mode): NavLink => ({ href: `/portal/orders/${mode.id}`, label: mode.label, icon: mode.icon })),
  ],
};

const MY_CONTRACTS: NavLink = { href: "/portal/contracts", label: "Your contracts", icon: "contracts" };

/** The ZODE team's CRM. */
const ZRM: PortalApp = {
  id: "zrm",
  label: "ZRM",
  icon: "zrm",
  href: "/portal/zrm",
  team: true,
  links: [
    { href: "/portal/zrm/people", label: "People", icon: "person" },
    { href: "/portal/zrm/companies", label: "Companies", icon: "rooms" },
    { href: "/portal/zrm/opportunities", label: "Opportunities", icon: "chart" },
  ],
};

/** The ZODE team's data center sites, linked into ZRM. */
const CAPACITY: PortalApp = {
  id: "capacity",
  label: "Capacity",
  icon: "capacity",
  href: "/portal/capacity",
  team: true,
  links: [{ href: "/portal/capacity/sites", label: "Sites", icon: "capacity" }],
};

/** News and changelog for the public site, written by the ZODE team. */
const POSTS: PortalApp = {
  id: "posts",
  label: "Posts",
  icon: "posts",
  href: "/portal/posts",
  team: true,
  links: [
    { href: "/portal/posts", label: "All posts", icon: "posts" },
    { href: "/portal/posts/news", label: "News", icon: "news" },
    { href: "/portal/posts/changelog", label: "Changelog", icon: "changelog" },
  ],
};

const ROLE_ICONS: Record<UserRole, PortalIconName> = { member: "person", team: "badge", super_admin: "shield" };

/** ZODE super admins only. */
const ADMIN_APPS: readonly PortalApp[] = [
  {
    id: "subscribers",
    label: "Subscribers",
    icon: "subscribers",
    href: "/portal/subscribers",
    team: true,
    links: [
      { href: "/portal/subscribers", label: "All lists", icon: "subscribers" },
      ...MAILING_LISTS.map(
        (list): NavLink => ({ href: `/portal/subscribers/${list.id}`, label: list.label, icon: list.id }),
      ),
    ],
  },
  {
    id: "users",
    label: "Users",
    icon: "users",
    href: "/portal/users",
    team: true,
    links: [
      { href: "/portal/users", label: "All users", icon: "users" },
      ...USER_ROLES.map(
        (role): NavLink => ({ href: `/portal/users/${ROLE_SLUGS[role]}`, label: ROLE_LABELS[role], icon: ROLE_ICONS[role] }),
      ),
    ],
  },
];

/**
 * The apps the viewer can open, in rail order, with Settings last for the
 * rail's foot: ZRM, Capacity, Posts, Team and everyone's contracts for the ZODE team, the
 * admin apps for super admins.
 */
export function portalApps({ admin, team }: NavAccess): PortalApp[] {
  const contracts: PortalApp = {
    id: "contracts",
    label: "Contracts",
    icon: "contracts",
    href: "/portal/contracts",
    links: team
      ? [MY_CONTRACTS, { href: "/portal/contracts/all", label: "All contracts", icon: "contracts" }]
      : [MY_CONTRACTS],
  };
  const settings: PortalApp = {
    id: "settings",
    label: "Settings",
    icon: "settings",
    href: "/portal/settings",
    links: [
      { href: "/portal/settings", label: "Account", icon: "person" },
      ...(team ? [{ href: "/portal/settings/team", label: "Team", icon: "users" } as const] : []),
    ],
  };
  return [
    HOME,
    ROOMS,
    ORDERS,
    contracts,
    ...(team ? [ZRM, CAPACITY, POSTS] : []),
    ...(admin ? ADMIN_APPS : []),
    settings,
  ];
}

const matches = (pathname: string, href: string): boolean =>
  href === "/portal" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

/** The href the page is under, by longest match, so All contracts wins over Your contracts on its own page. */
export function activeHref(pathname: string, hrefs: readonly string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (matches(pathname, href) && (!best || href.length > best.length)) best = href;
  }
  return best;
}

/** The app the page belongs to, falling back to Home. */
export function activeApp(pathname: string, apps: readonly PortalApp[]): PortalApp {
  const href = activeHref(
    pathname,
    apps.map((app) => app.href),
  );
  return apps.find((app) => app.href === href) ?? apps[0];
}

/**
 * Where a page's back button leads: the page it sits under in its app, for
 * pages deeper than the app's own links (a post in the editor, a data room),
 * or `null` on those links themselves and on pages outside every app.
 */
export function parentHref(pathname: string, apps: readonly PortalApp[]): string | null {
  const appHref = activeHref(
    pathname,
    apps.map((app) => app.href),
  );
  const app = apps.find((candidate) => candidate.href === appHref);
  if (!app) return null;
  if (roomIdIn(pathname)) return app.href;
  const base =
    activeHref(
      pathname,
      app.links.map(({ href }) => href),
    ) ?? app.href;
  return pathname === base ? null : base;
}

/** The data room the page is in, from `/portal/data-rooms/[roomId]/…`. */
export function roomIdIn(pathname: string): string | null {
  const [, portal, section, roomId] = pathname.split("/");
  return portal === "portal" && section === "data-rooms" && roomId ? roomId : null;
}
