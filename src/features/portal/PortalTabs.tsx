"use client";

import { startTransition, useLayoutEffect, useOptimistic, useRef, type ReactElement } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "@/features/data-room/room.module.css";
import { PortalIcon, type PortalIconName } from "./icons";
import { activeApp, portalApps } from "./nav";

export interface PortalTab {
  href: string;
  label: string;
  /** Shown in place of the label, which becomes the tab's accessible name and tooltip. */
  icon?: PortalIconName;
}

/**
 * The tab that's open: the one last clicked while its page is on its way,
 * else `current`. `select` navigates to a tab, moving the chip at once.
 */
export function useTabNavigation(current: string | undefined, { scroll = true }: { scroll?: boolean } = {}) {
  const router = useRouter();
  const [active, setActive] = useOptimistic(current);
  const select = (href: string) =>
    startTransition(() => {
      setActive(href);
      router.push(href, { scroll });
    });
  return [active, select] as const;
}

/**
 * Whether the sidebar lists exactly these tabs' pages, as the links of the
 * app the page is in. Every app's fullest links serve, since the apps only
 * show their tabs to the accounts that get them all.
 */
function listedInSidebar(tabs: readonly PortalTab[], pathname: string): boolean {
  const links = new Set(activeApp(pathname, portalApps({ admin: true, team: true })).links.map(({ href }) => href));
  return tabs.length === links.size && tabs.every(({ href }) => links.has(href));
}

/**
 * The segmented control at the top right of a portal app. The white chip is
 * one element that slides to the open tab, so it moves the moment a tab is
 * clicked rather than when the page arrives. Before hydration the open tab
 * draws its own chip, in the same place. Where the sidebar shows and lists the
 * same pages, the tabs step aside rather than repeat it.
 */
export function PortalTabs({
  tabs,
  label,
  active,
  onSelect,
}: {
  tabs: readonly PortalTab[];
  label: string;
  active: string | undefined;
  /** Takes over plain clicks; without it the tabs navigate as links. */
  onSelect?: (href: string) => void;
}): ReactElement {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const chip = chipRef.current;
    if (!nav || !chip) return;
    const tab = nav.querySelector<HTMLElement>(':scope > [aria-current="page"]');
    if (!tab) {
      delete nav.dataset.chip;
      return;
    }
    const place = () => {
      chip.style.translate = `${tab.offsetLeft}px ${tab.offsetTop}px`;
      chip.style.width = `${tab.offsetWidth}px`;
      chip.style.height = `${tab.offsetHeight}px`;
    };
    place();
    const glide = "chip" in nav.dataset && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    nav.dataset.chip = "";
    if (nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({
        left: tab.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2,
        behavior: glide ? "smooth" : "instant",
      });
    }
    // Tabs reflow as the window narrows and as the font arrives.
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    for (const child of nav.children) observer.observe(child);
    return () => observer.disconnect();
  }, [active]);

  return (
    <nav
      ref={navRef}
      className={styles.tabs}
      aria-label={label}
      data-in-sidebar={listedInSidebar(tabs, pathname) || undefined}
    >
      <span ref={chipRef} className={styles.chip} aria-hidden="true" />
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={tab.icon ? `${styles.tab} ${styles.iconTab}` : styles.tab}
          aria-current={tab.href === active ? "page" : undefined}
          aria-label={tab.icon ? tab.label : undefined}
          title={tab.icon ? tab.label : undefined}
          onNavigate={
            onSelect
              ? (event) => {
                  event.preventDefault();
                  onSelect(tab.href);
                }
              : undefined
          }
        >
          {tab.icon ? <PortalIcon name={tab.icon} className={styles.tabIcon} /> : tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** Tabs that are pages, the open one matching the path. */
export function RouteTabs({ tabs, label }: { tabs: readonly PortalTab[]; label: string }): ReactElement {
  const pathname = usePathname();
  const [active, select] = useTabNavigation(tabs.find((tab) => tab.href === pathname)?.href);
  return <PortalTabs tabs={tabs} label={label} active={active} onSelect={select} />;
}
