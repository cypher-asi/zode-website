import type { PortalIconName } from "./icons";

/** Remembers whether the sidebar beside the rail is open; read by the layout, written by the toggle. */
export const SIDEBAR_COOKIE = "zode_portal_sidebar";

export type SidebarState = "open" | "collapsed";

export type CountKey = "rooms" | "orders" | "contracts";

export type NavLink = {
  href: string;
  label: string;
  icon: PortalIconName;
  /** Which of the layout's counts to badge the link with. */
  count?: CountKey;
  /** Left off the icon-only rail, where it would repeat another section's icon. */
  hideInRail?: boolean;
};

export type NavGroup = {
  id: "workspace" | "admin" | "settings";
  label: string;
  icon: PortalIconName;
  links: readonly NavLink[];
};

export type NavAccess = { admin: boolean; team: boolean };

const WORKSPACE: NavGroup = {
  id: "workspace",
  label: "Workspace",
  icon: "home",
  links: [
    { href: "/portal", label: "Home", icon: "home" },
    { href: "/portal/data-rooms", label: "Data rooms", icon: "rooms", count: "rooms" },
    { href: "/portal/orders", label: "Orders", icon: "orders", count: "orders" },
    { href: "/portal/contracts", label: "Contracts", icon: "contracts", count: "contracts" },
  ],
};

/** ZODE super admins only. */
const ADMIN: NavGroup = {
  id: "admin",
  label: "Admin",
  icon: "admin",
  links: [
    { href: "/portal/posts", label: "Posts", icon: "posts" },
    { href: "/portal/subscribers", label: "Subscribers", icon: "subscribers" },
    { href: "/portal/users", label: "Users", icon: "users" },
    { href: "/portal/contracts/all", label: "All contracts", icon: "contracts", hideInRail: true },
  ],
};

const ACCOUNT: NavLink = { href: "/portal/settings", label: "Account", icon: "person" };
const TEAM: NavLink = { href: "/portal/settings/team", label: "Team", icon: "users" };

/** The groups the viewer can open: Workspace, Admin for super admins, and Settings with Team for the ZODE team. */
export function navGroups({ admin, team }: NavAccess): NavGroup[] {
  const settings: NavGroup = {
    id: "settings",
    label: "Settings",
    icon: "settings",
    links: team ? [ACCOUNT, TEAM] : [ACCOUNT],
  };
  return admin ? [WORKSPACE, ADMIN, settings] : [WORKSPACE, settings];
}

/** Every section but Settings as one list, for the rail when the sidebar is hidden. */
export function railLinks(groups: readonly NavGroup[]): NavLink[] {
  return groups.filter((group) => group.id !== "settings").flatMap((group) => group.links.filter((link) => !link.hideInRail));
}

const matches = (pathname: string, href: string): boolean =>
  href === "/portal" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

/** The link the page is under, by longest match, so All contracts wins over Contracts on its own page. */
export function activeHref(pathname: string, links: readonly NavLink[]): string | null {
  let best: string | null = null;
  for (const { href } of links) {
    if (matches(pathname, href) && (!best || href.length > best.length)) best = href;
  }
  return best;
}

/** The group the page belongs to, falling back to the first. */
export function activeGroup(pathname: string, groups: readonly NavGroup[]): NavGroup {
  const href = activeHref(
    pathname,
    groups.flatMap((group) => group.links),
  );
  return groups.find((group) => group.links.some((link) => link.href === href)) ?? groups[0];
}
