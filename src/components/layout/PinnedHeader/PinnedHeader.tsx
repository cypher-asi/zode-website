"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactElement,
} from "react";
import { useLogoutToast } from "@/features/account/useAccount";
import { InlineScript } from "@/features/portal/InlineScript";
import { PORTAL_THEME_SCRIPT } from "@/features/portal/theme";
import { usePortalThemeCookie } from "@/features/portal/themeStore";
import { readBackHref, stepBack, subscribeHistory } from "@/lib/historyBack";
import { ActionMenu } from "./ActionMenu";
import { headerFor, MODAL_PATHS, useRoutePathname } from "./headerRoutes";
import styles from "./PinnedHeader.module.css";
import { useHeaderSurface } from "./useHeaderSurface";

/** How long the header slides between placements; keep in step with `--move` in PinnedHeader.module.css. */
const MOVE_MS = 550;

/** Bottom-centre notice after logging out, fading in and out. */
function LogoutNotice(): ReactElement | null {
  const toast = useLogoutToast();
  if (toast === "hidden") return null;
  return (
    <p className={styles.notice} role="status" data-leaving={toast === "leaving" || undefined}>
      You&apos;re logged out
    </p>
  );
}

/**
 * Top-left wordmark and top-right split button, fixed while the page
 * scrolls. Mounted once in the root layout, so neither ever unmounts: each
 * route picks a placement (headerRoutes.ts) and they slide there, while the
 * parts a route adds or leaves out (the Back pill, the button's link, the
 * portal's OS badge) open and close in place. A modal keeps the placement of
 * the page under it. It renders outside any Suspense boundary, so it's in
 * every route's first paint.
 *
 * Once you've moved on from the page you landed on, a Back pill left of the
 * button steps back to the previous page. Each side is black over light
 * surfaces and white over dark ones: it reads the nearest `data-surface`
 * ancestor of whatever sits under its center point. Content marked with
 * `data-top-fade` is masked out as it scrolls up into the top corners, while
 * the top middle stays solid. `data-top-fade` set to "left" or "right" limits
 * the fade to that corner (the hero gallery starts under the button, so it
 * only fades under the wordmark). Section backgrounds stay unmarked so the
 * surface behind both remains solid.
 *
 * Masking content means rewriting its mask as it scrolls, a frame behind the
 * scroll itself. Over a plain surface, a `data-top-fade-cover` does the same
 * job without that lag: a sticky band of the surface colour (with
 * `mask-composite: intersect`) that's masked down to just the corners.
 */
export function PinnedHeader(): ReactElement {
  const pathname = useRoutePathname();
  const [landedAt] = useState(pathname);
  const overModal = MODAL_PATHS.has(pathname) && pathname !== landedAt;
  const routed = headerFor(pathname);
  const [underModal, setUnderModal] = useState(routed);
  if (!overModal && underModal !== routed) setUnderModal(routed);
  const route = overModal ? underModal : routed;

  /** Set for one slide whenever the placement changes, so only route changes animate, not resizing the window. */
  const placement = `${route.placement}:${route.clear}`;
  const [placedAt, setPlacedAt] = useState(placement);
  const [moving, setMoving] = useState(false);
  if (placedAt !== placement) {
    setPlacedAt(placement);
    setMoving(true);
  }
  useEffect(() => {
    if (!moving) return;
    const timer = setTimeout(() => setMoving(false), MOVE_MS + 50);
    return () => clearTimeout(timer);
  }, [moving, placedAt]);

  const brandRef = useRef<HTMLAnchorElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const theme = usePortalThemeCookie();
  const { brandTone, actionTone, actionOverMedia, resample } = useHeaderSurface(
    brandRef,
    groupRef,
    !route.portal,
  );

  const readBack = useCallback(() => readBackHref(pathname), [pathname]);
  /** The previous page in this tab, shown as the Back pill; unset on the page you landed on. */
  const back = useSyncExternalStore(subscribeHistory, readBack, () => null);
  const showBack = back !== null;
  /** Kept while the pill closes, so it doesn't change under the pointer. */
  const [lastBack, setLastBack] = useState(back);
  if (back !== null && back !== lastBack) setLastBack(back);

  useEffect(() => resample(), [pathname, showBack, route, resample]);

  /**
   * The right-hand group's width as `--header-action-width` on `<html>`, for
   * pages whose own top-right controls move aside for the Back pill.
   */
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty("--header-action-width", `${group.getBoundingClientRect().width}px`);
    });
    observer.observe(group);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--header-action-width");
    };
  }, []);

  return (
    <div
      className={styles.root}
      data-placement={route.placement}
      data-moving={moving || undefined}
      data-portal={route.portal || undefined}
      data-hidden={route.hidden || undefined}
      data-theme={route.portal ? theme : undefined}
      style={route.clear ? ({ "--header-clear": `${route.clear}px` } as CSSProperties) : undefined}
      suppressHydrationWarning
      onTransitionEnd={(event) => {
        // The fade band follows the wordmark and button, so re-measure once they've landed.
        if (event.propertyName === "translate") resample();
      }}
    >
      {route.portal ? <InlineScript html={PORTAL_THEME_SCRIPT} /> : null}
      <div className={styles.brandRow}>
        <Link
          ref={brandRef}
          className={styles.brand}
          href="/"
          aria-label="ZODE — home"
          data-tone={brandTone}
          onClick={(event) => {
            if (pathname !== "/" || event.metaKey || event.ctrlKey || event.shiftKey) return;
            event.preventDefault();
            window.scrollTo({ top: 0 });
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.wordmark} src="/wordmark.png" alt="" aria-hidden="true" />
        </Link>
        {/* The link's hover box stretches under it in the portal, so it hovers and clicks as part of the logo. */}
        <span className={styles.os} aria-hidden="true">
          OS
        </span>
      </div>
      <div
        ref={groupRef}
        className={styles.action}
        data-tone={actionTone}
        data-media={actionOverMedia || undefined}
        data-header-back={showBack || undefined}
      >
        <div className={styles.backSlot} data-shown={showBack || undefined} inert={!showBack}>
          <div className={styles.backClip}>
            <Link
              className={styles.back}
              href={back ?? lastBack ?? "/"}
              scroll={false}
              title="Back to previous page"
              aria-label="Back"
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                if (stepBack(pathname)) event.preventDefault();
              }}
            >
              <svg className={styles.backChevron} viewBox="0 0 6 10" aria-hidden="true">
                <path d="M5 1L1 5l4 4" />
              </svg>
              <span className={styles.backLabel}>Back</span>
            </Link>
          </div>
        </div>
        <ActionMenu primary={route.primary} portal={route.portal} pathname={pathname} />
      </div>
      <LogoutNotice />
    </div>
  );
}
