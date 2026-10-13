"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/features/account/LogoutButton";
import { PortalIcon } from "./icons";
import { TOOL_LINKS, type AppId, type PortalApp } from "./nav";
import { usePortalTheme } from "./PortalFrame";
import styles from "./more.module.css";

/** Exit animation length; keep in step with `sheet-out` in more.module.css. */
const EXIT_MS = 200;
/** A downward drag on the handle further than this dismisses the sheet. */
const DISMISS_DRAG = 80;

/**
 * The phone tab bar's More: the apps that don't fit in the bar, Settings and
 * the theme, the site's tools, and the way out. A bottom sheet on the native
 * `<dialog>`, which traps focus and closes on Escape; it also closes on a
 * backdrop tap, a drag down on its handle, or as soon as a link lands.
 */
export function PortalMoreSheet({
  apps,
  current,
  onClose,
}: {
  /** The apps beyond the tab bar's, Settings last. */
  apps: readonly PortalApp[];
  current: AppId;
  onClose: () => void;
}): ReactElement {
  const pathname = usePathname();
  const { theme, toggle } = usePortalTheme();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(pathname);
  const leaving = useRef(false);
  const pressedBackdrop = useRef(false);
  const drag = useRef<{ id: number; startY: number; dy: number } | null>(null);
  const [closing, setClosing] = useState(false);
  const settings = apps.find(({ id }) => id === "settings");
  const tiles = apps.filter(({ id }) => id !== "settings");
  const dark = theme === "dark";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (pathname !== openedAt.current) dialogRef.current?.close();
  }, [pathname]);

  const close = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    setClosing(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => dialogRef.current?.close(), reduced ? 0 : EXIT_MS);
  }, []);

  const onHandleDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, startY: event.clientY, dy: 0 };
    panelRef.current?.setAttribute("data-dragging", "");
  };

  const onHandleMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const panel = panelRef.current;
    if (!state || state.id !== event.pointerId || !panel) return;
    state.dy = Math.max(0, event.clientY - state.startY);
    panel.style.transform = `translateY(${state.dy}px)`;
  };

  const onHandleUp = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const panel = panelRef.current;
    if (!state || state.id !== event.pointerId || !panel) return;
    drag.current = null;
    panel.removeAttribute("data-dragging");
    if (state.dy > DISMISS_DRAG) close();
    else panel.style.transform = "";
  };

  /** A link to the page you're already on lands nowhere, so close the sheet on the tap itself. */
  const closeIfHere = (href: string) => () => {
    if (href === pathname) close();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-label="More"
      data-closing={closing || undefined}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={onClose}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) close();
        pressedBackdrop.current = false;
      }}
    >
      <div ref={panelRef} className={styles.panel} tabIndex={-1}>
        <div
          className={styles.handle}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          aria-hidden="true"
        >
          <span />
        </div>

        {tiles.length ? (
          <ul className={styles.tiles}>
            {tiles.map((app) => (
              <li key={app.id}>
                <Link
                  href={app.href}
                  className={styles.tile}
                  aria-current={app.id === current ? "page" : undefined}
                  onClick={closeIfHere(app.href)}
                >
                  <span className={styles.tileIcon}>
                    <PortalIcon name={app.icon} />
                  </span>
                  <span className={styles.tileLabel}>{app.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <ul className={styles.group}>
          {settings ? (
            <li>
              <Link
                href={settings.href}
                className={styles.row}
                aria-current={current === "settings" ? "page" : undefined}
                onClick={closeIfHere(settings.href)}
              >
                <PortalIcon name="settings" className={styles.rowIcon} />
                <span className={styles.rowLabel}>Settings</span>
                <Chevron />
              </Link>
            </li>
          ) : null}
          <li>
            <button type="button" className={styles.row} role="switch" aria-checked={dark} onClick={toggle}>
              <PortalIcon name="moon" className={styles.rowIcon} />
              <span className={styles.rowLabel}>Dark mode</span>
              <span className={styles.switch} aria-hidden="true" />
            </button>
          </li>
        </ul>

        <h2 className={styles.heading}>Tools</h2>
        <ul className={styles.group}>
          {TOOL_LINKS.map((link) => (
            <li key={link.href}>
              {/* The site's tools, e.g. the cluster builder's 3D bundle, aren't worth warming up from the portal. */}
              <Link href={link.href} prefetch={false} className={styles.row}>
                <PortalIcon name={link.icon} className={styles.rowIcon} />
                <span className={styles.rowLabel}>{link.label}</span>
                <Chevron />
              </Link>
            </li>
          ))}
        </ul>

        <ul className={styles.group}>
          <li>
            <Link href="/" prefetch={false} className={styles.row}>
              <PortalIcon name="site" className={styles.rowIcon} />
              <span className={styles.rowLabel}>ZODE website</span>
              <Chevron />
            </Link>
          </li>
          <li>
            <LogoutButton className={`${styles.row} ${styles.logout}`} />
          </li>
        </ul>
      </div>
    </dialog>
  );
}

function Chevron(): ReactElement {
  return (
    <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}
