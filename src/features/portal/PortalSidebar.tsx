"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { initials } from "@/features/account/initials";
import { LogoutButton } from "@/features/account/LogoutButton";
import { PortalIcon } from "./icons";
import { activeGroup, activeHref, navGroups, type CountKey, type NavAccess } from "./nav";
import { SidebarToggle } from "./PortalFrame";
import styles from "./sidebar.module.css";

export type SidebarAccount = { displayName: string; email: string; profileImage: string };

function Avatar({ account }: { account: SidebarAccount }): ReactElement {
  const [broken, setBroken] = useState(false);
  return (
    <span className={styles.avatar} aria-hidden="true">
      {account.profileImage && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.profileImage} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        initials(account.displayName || account.email)
      )}
    </span>
  );
}

/**
 * The labeled panel beside the rail: who's signed in, then the links of the
 * group the page is in, badged with counts where the layout has them.
 */
export function PortalSidebar({
  account,
  access,
  counts,
}: {
  account: SidebarAccount | null;
  access: NavAccess;
  counts: Partial<Record<CountKey, number>>;
}): ReactElement {
  const pathname = usePathname() ?? "/portal";
  const group = activeGroup(pathname, navGroups(access));
  const current = activeHref(pathname, group.links);

  return (
    <aside className={styles.sidebar} aria-label="Sidebar">
      <div className={styles.head}>
        {account ? (
          <Link href="/portal/settings" className={styles.account}>
            <Avatar account={account} />
            <span className={styles.who}>
              <span className={styles.name}>{account.displayName || account.email}</span>
              {account.displayName ? <span className={styles.email}>{account.email}</span> : null}
            </span>
          </Link>
        ) : (
          <span />
        )}
        <SidebarToggle placement="sidebar" className={styles.toggle} />
      </div>

      <nav className={styles.section} aria-label={group.label}>
        <h2 className={styles.heading}>{group.label}</h2>
        <ul className={styles.links}>
          {group.links.map((link) => {
            const count = link.count ? counts[link.count] : undefined;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={styles.link}
                  aria-current={link.href === current ? "page" : undefined}
                >
                  <PortalIcon name={link.icon} className={styles.linkIcon} />
                  <span className={styles.linkLabel}>{link.label}</span>
                  {count === undefined ? null : <span className={styles.count}>{count.toLocaleString("en-US")}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {account ? (
        <div className={styles.foot}>
          <LogoutButton className={styles.logout} />
        </div>
      ) : null}
    </aside>
  );
}
