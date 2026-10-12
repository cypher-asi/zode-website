"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PortalIcon, type PortalIconName } from "./icons";
import styles from "./shell.module.css";

type Section = { href: string; label: string; exact: boolean; icon: PortalIconName };

const SECTIONS: readonly Section[] = [
  { href: "/portal", label: "Home", exact: true, icon: "home" },
  { href: "/portal/data-rooms", label: "Data rooms", exact: false, icon: "rooms" },
  { href: "/portal/orders", label: "Orders", exact: false, icon: "orders" },
  { href: "/portal/contracts", label: "Contracts", exact: false, icon: "contracts" },
];

/** Sections only ZODE admins see. */
const ADMIN_SECTIONS: readonly Section[] = [
  { href: "/portal/posts", label: "Posts", exact: false, icon: "posts" },
  { href: "/portal/subscribers", label: "Subscribers", exact: false, icon: "subscribers" },
];

const SETTINGS: Section = { href: "/portal/settings", label: "Settings", exact: false, icon: "settings" };

function isActive(pathname: string, { href, exact }: Section): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function RailItem({ section, active }: { section: Section; active: boolean }): ReactElement {
  return (
    <Link href={section.href} className={styles.item} aria-current={active ? "page" : undefined}>
      <PortalIcon name={section.icon} className={styles.icon} />
      <span className={styles.tooltip}>{section.label}</span>
    </Link>
  );
}

/**
 * The portal's sections down a black rail on the left, with Settings and the
 * account avatar at its foot; a bar along the bottom on phones.
 */
export function PortalNav({ admin = false }: { admin?: boolean }): ReactElement {
  const pathname = usePathname() ?? "/portal";
  const sections = admin ? [...SECTIONS, ...ADMIN_SECTIONS] : SECTIONS;

  return (
    <nav className={styles.rail} aria-label="Portal">
      <div className={styles.group}>
        {sections.map((section) => (
          <RailItem key={section.href} section={section} active={isActive(pathname, section)} />
        ))}
      </div>
      <div className={styles.group}>
        <RailItem section={SETTINGS} active={isActive(pathname, SETTINGS)} />
        {/* Initials come from the `<html>` flags in CSS, as in PinnedHeader, so they never pop in at hydration. */}
        <Link href={SETTINGS.href} className={styles.avatar}>
          <PortalIcon name="person" className={styles.avatarGlyph} />
          <span className={styles.tooltip}>Account</span>
        </Link>
      </div>
    </nav>
  );
}
