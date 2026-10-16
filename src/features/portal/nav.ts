import { FACTORY_FLOWS } from "@/features/factory/model/flows";
import { LEAD_TYPES } from "@/features/leads/types";
import { MAILING_LISTS } from "@/features/mailing-list/types";
import { ROLE_LABELS, ROLE_SLUGS, USER_ROLES, type UserRole } from "@/features/users/types";
import { RESOURCE_LINKS as SITE_RESOURCE_LINKS } from "@/lib/navigation";
import type { PortalIconName } from "./icons";

/** Wide enough for the rail, the sidebar and a usable panel; under it the sidebar hides. Matches shell.module.css. */
export const SIDEBAR_MEDIA = "(min-width: 1101px)";

/** How many apps the phone's tab bar holds before the rest move into More. */
export const TAB_BAR_APPS = 4;

export type NavLink = {
  href: string;
  label: string;
  icon: PortalIconName;
  /** Opens in a new tab. */
  external?: boolean;
};

export type AppId =
  | "home"
  | "rooms"
  | "orders"
  | "contracts"
  | "deployments"
  | "zrm"
  | "leads"
  | "capacity"
  | "factory"
  | "posts"
  | "analytics"
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

const RESOURCE_ICONS: Record<string, PortalIconName> = {
  "/news": "news",
  "/changelog": "changelog",
  "https://cypher.net/research/the-grid": "paper",
  "/styleguide": "palette",
};

/** The site footer's resources, listed under Home's tools. */
export const RESOURCE_LINKS: readonly NavLink[] = SITE_RESOURCE_LINKS.map((link) => ({
  href: link.href,
  label: link.label,
  icon: RESOURCE_ICONS[link.href] ?? "site",
  external: link.external,
}));

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
  label: "Data Rooms",
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

/** Buy compute, rent compute and invest inquiries from the site's forms, for the ZODE team. */
const LEADS: PortalApp = {
  id: "leads",
  label: "Leads",
  icon: "leads",
  href: "/portal/leads",
  team: true,
  links: [
    { href: "/portal/leads", label: "All leads", icon: "leads" },
    ...LEAD_TYPES.map((type): NavLink => ({ href: `/portal/leads/${type.id}`, label: type.label, icon: type.icon })),
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

/** The compute pod factory, simulated, for the ZODE team: its main flows, in the order material moves. */
const FACTORY: PortalApp = {
  id: "factory",
  label: "Factory",
  icon: "factory",
  href: "/portal/factory",
  team: true,
  links: FACTORY_FLOWS.map((flow): NavLink => ({ href: flow.href, label: flow.label, icon: flow.icon })),
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

/** The site's and portal's traffic and conversions, for the ZODE team. */
const ANALYTICS: PortalApp = {
  id: "analytics",
  label: "Analytics",
  icon: "analytics",
  href: "/portal/analytics",
  team: true,
  links: [
    { href: "/portal/analytics", label: "Overview", icon: "analytics" },
    { href: "/portal/analytics/pages", label: "Pages", icon: "paper" },
    { href: "/portal/analytics/sources", label: "Sources", icon: "site" },
    { href: "/portal/analytics/audience", label: "Audience", icon: "users" },
    { href: "/portal/analytics/events", label: "Events & goals", icon: "target" },
    { href: "/portal/analytics/realtime", label: "Realtime", icon: "pulse" },
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
      { href: "/portal/users/invites", label: "Invites", icon: "invite" },
    ],
  },
];

/**
 * The apps the viewer can open, in rail order, with Settings last for the
 * rail's foot: ZRM, Leads, Capacity, Factory, Posts, Analytics, Team and everyone's contracts for the
 * ZODE team, the admin apps for super admins.
 */
export function portalApps({ admin, team }: NavAccess): PortalApp[] {
  const deployments: PortalApp = {
    id: "deployments",
    label: "Deployments",
    icon: "deployments",
    href: "/portal/deployments",
    links: [
      { href: "/portal/deployments", label: "Active", icon: "deployments" },
      { href: "/portal/deployments/all", label: "All deployments", icon: "cluster" },
    ],
  };
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
    deployments,
    ...(team ? [ZRM, LEADS, CAPACITY, FACTORY, POSTS, ANALYTICS] : []),
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
