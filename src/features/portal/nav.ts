import type { PortalIconName } from "./icons";

/** Remembers whether the sidebar beside the rail is open; read by the layout, written by the toggle. */
export const SIDEBAR_COOKIE = "zode_portal_sidebar";

export type SidebarState = "open" | "collapsed";

/** Wide enough for the rail, the sidebar and a usable panel; under it the sidebar hides. Matches shell.module.css. */
export const SIDEBAR_MEDIA = "(min-width: 1101px)";

export type CountKey = "rooms" | "orders" | "contracts";

export type NavLink = {
  href: string;
  label: string;
  icon: PortalIconName;
  /** Which of the layout's counts to badge the link with. */
  count?: CountKey;
};

export type AppId = "home" | "rooms" | "orders" | "contracts" | "zrm" | "posts" | "subscribers" | "users" | "settings";

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
};

export type NavAccess = { admin: boolean; team: boolean };

const HOME: PortalApp = {
  id: "home",
  label: "Home",
  icon: "home",
  href: "/portal",
  links: [
    { href: "/buy-compute", label: "Buy compute", icon: "orders" },
    { href: "/cluster-builder", label: "Cluster builder", icon: "cluster" },
    { href: "/compute-model", label: "Compute model", icon: "chart" },
  ],
};

const ROOMS: PortalApp = { id: "rooms", label: "Data rooms", icon: "rooms", href: "/portal/data-rooms", links: [] };

const ORDERS: PortalApp = {
  id: "orders",
  label: "Orders",
  icon: "orders",
  href: "/portal/orders",
  links: [
    { href: "/portal/orders", label: "Your orders", icon: "orders", count: "orders" },
    { href: "/buy-compute", label: "Buy compute", icon: "cluster" },
  ],
};

const MY_CONTRACTS: NavLink = { href: "/portal/contracts", label: "Your contracts", icon: "contracts", count: "contracts" };

/** The ZODE team's CRM. */
const ZRM: PortalApp = {
  id: "zrm",
  label: "ZRM",
  icon: "zrm",
  href: "/portal/zrm",
  links: [
    { href: "/portal/zrm/people", label: "People", icon: "person" },
    { href: "/portal/zrm/companies", label: "Companies", icon: "rooms" },
    { href: "/portal/zrm/opportunities", label: "Opportunities", icon: "chart" },
  ],
};

/** ZODE super admins only. */
const ADMIN_APPS: readonly PortalApp[] = [
  {
    id: "posts",
    label: "Posts",
    icon: "posts",
    href: "/portal/posts",
    links: [{ href: "/portal/posts", label: "News and changelog", icon: "posts" }],
  },
  {
    id: "subscribers",
    label: "Subscribers",
    icon: "subscribers",
    href: "/portal/subscribers",
    links: [{ href: "/portal/subscribers", label: "Mailing list", icon: "subscribers" }],
  },
  {
    id: "users",
    label: "Users",
    icon: "users",
    href: "/portal/users",
    links: [{ href: "/portal/users", label: "All users", icon: "users" }],
  },
];

/**
 * The apps the viewer can open, in rail order, with Settings last for the
 * rail's foot: ZRM and Team for the ZODE team, the admin apps and everyone's
 * contracts for super admins.
 */
export function portalApps({ admin, team }: NavAccess): PortalApp[] {
  const contracts: PortalApp = {
    id: "contracts",
    label: "Contracts",
    icon: "contracts",
    href: "/portal/contracts",
    links: admin
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
    ...(team ? [ZRM] : []),
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

/** The data room the page is in, from `/portal/data-rooms/[roomId]/…`. */
export function roomIdIn(pathname: string): string | null {
  const [, portal, section, roomId] = pathname.split("/");
  return portal === "portal" && section === "data-rooms" && roomId ? roomId : null;
}
