"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { InlineScript } from "./InlineScript";
import { SIDEBAR_MEDIA } from "./nav";
import { PORTAL_RAIL_SCRIPT } from "./rail";
import { togglePortalRail, usePortalRailCookie } from "./railStore";
import styles from "./shell.module.css";
import { PORTAL_THEME_SCRIPT, type PortalTheme } from "./theme";
import { togglePortalTheme, usePortalThemeCookie } from "./themeStore";

type SidebarContextValue = {
  /** Whether the window is wide enough to show the sidebar at all. */
  wide: boolean;
  /** The sidebar's slot under the app's links, for a page's own section, e.g. ZRM's types. */
  extra: HTMLElement | null;
  setExtra: (element: HTMLElement | null) => void;
  /**
   * Whether a showing page fills each slot. A page that navigation keeps
   * hidden (in an Activity) leaves its hidden nodes in the slot, so the slot
   * being empty doesn't say.
   */
  filled: SlotsFilled;
  claimExtra: () => () => void;
};

export type SlotsFilled = { extra: boolean };

const SidebarContext = createContext<SidebarContextValue>({
  wide: false,
  extra: null,
  setExtra: () => {},
  filled: { extra: false },
  claimExtra: () => () => {},
});

/** A count of the pages filling a slot; claiming returns the release. */
function useClaims(): [boolean, () => () => void] {
  const [count, setCount] = useState(0);
  const claim = useCallback(() => {
    setCount((n) => n + 1);
    return () => setCount((n) => n - 1);
  }, []);
  return [count > 0, claim];
}

const ThemeContext = createContext<{ theme: PortalTheme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

const RailContext = createContext<{ expanded: boolean; toggle: () => void }>({
  expanded: false,
  toggle: () => {},
});

const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(SIDEBAR_MEDIA);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/**
 * Wraps the portal shell, tracks where pages can add their own section to
 * the sidebar, and carries the light or dark theme (globals.css) for everything
 * inside; the pinned header, mounted above it, follows the same cookie. The
 * server renders light; an inline script switches a hard load to dark before
 * it paints. The browser's theme colour (the status bar, in the installed
 * app) follows along. The rail's expanded or collapsed state rides on its own
 * cookie and script the same way.
 */
export function PortalFrame({ children }: { children: ReactNode }): ReactElement {
  const [extra, setExtra] = useState<HTMLElement | null>(null);
  const [extraFilled, claimExtra] = useClaims();
  const theme = usePortalThemeCookie();
  const rail = usePortalRailCookie();
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(SIDEBAR_MEDIA).matches,
    () => false,
  );

  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const frame = frameRef.current;
    if (!meta || !frame) return;
    const previous = meta.content;
    meta.content = getComputedStyle(frame).getPropertyValue("--color-bg").trim();
    return () => {
      meta.content = previous;
    };
  }, [theme]);

  /*
   * Collapsing, each name turns back into a hidden tooltip, which would fade
   * out beside the rail; the frame holds `data-rail-collapsing` through the
   * style change so the tooltips skip their transition.
   */
  const shownRail = useRef(rail);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const collapsing = shownRail.current === "expanded" && rail === "collapsed";
    shownRail.current = rail;
    if (!frame || !collapsing) return;
    frame.dataset.railCollapsing = "";
    frame.getBoundingClientRect();
    delete frame.dataset.railCollapsing;
  }, [rail]);

  const themeValue = useMemo(() => ({ theme, toggle: togglePortalTheme }), [theme]);
  const railValue = useMemo(() => ({ expanded: rail === "expanded", toggle: togglePortalRail }), [rail]);
  const sidebarValue = useMemo(
    () => ({
      wide,
      extra,
      setExtra,
      filled: { extra: extraFilled },
      claimExtra,
    }),
    [wide, extra, extraFilled, claimExtra],
  );

  return (
    <ThemeContext value={themeValue}>
      <RailContext value={railValue}>
        <SidebarContext value={sidebarValue}>
          <div
            ref={frameRef}
            className={styles.frame}
            data-theme={theme}
            data-rail={rail}
            suppressHydrationWarning
          >
            {/* One script: React's hydration can't match two sibling inline scripts. */}
            <InlineScript html={`${PORTAL_THEME_SCRIPT};${PORTAL_RAIL_SCRIPT}`} />
            {children}
          </div>
        </SidebarContext>
      </RailContext>
    </ThemeContext>
  );
}

/** The portal's current theme, and a toggle that flips it and remembers the choice. */
export function usePortalTheme(): { theme: PortalTheme; toggle: () => void } {
  return use(ThemeContext);
}

/** Whether the rail shows its apps' names, and a toggle that flips it and remembers the choice. */
export function usePortalRail(): { expanded: boolean; toggle: () => void } {
  return use(RailContext);
}

/** Whether a showing page fills the sidebar's extra slot. */
export function useSlotsFilled(): SlotsFilled {
  return use(SidebarContext).filled;
}

/** Holds a slot while `target` is set; the layout effect's cleanup also runs when Activity hides the page. */
function useClaim(target: HTMLElement | null, claim: () => () => void): void {
  const active = target !== null;
  useLayoutEffect(() => (active ? claim() : undefined), [active, claim]);
}

/** The ref callback for the sidebar's slot under the app's links. */
export function useExtraRef(): (element: HTMLElement | null) => void {
  return use(SidebarContext).setExtra;
}

/** Renders `children` in the sidebar under the app's links while it's showing, and nowhere on narrow windows. */
export function SidebarExtra({ children }: { children: ReactNode }): ReactNode {
  const { wide, extra, claimExtra } = use(SidebarContext);
  const target = wide ? extra : null;
  useClaim(target, claimExtra);
  return target ? createPortal(children, target) : null;
}
