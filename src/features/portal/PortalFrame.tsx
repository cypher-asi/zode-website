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
import styles from "./shell.module.css";
import { PORTAL_THEME_SCRIPT, type PortalTheme } from "./theme";
import { togglePortalTheme, usePortalThemeCookie } from "./themeStore";

type SidebarContextValue = {
  /** Whether the window is wide enough to show the sidebar at all. */
  wide: boolean;
  /** The sidebar's slot for the page's own explorer, e.g. a data room's files. */
  dock: HTMLElement | null;
  setDock: (element: HTMLElement | null) => void;
  /** The sidebar's slot under the app's links, for a page's own section, e.g. ZRM's types. */
  extra: HTMLElement | null;
  setExtra: (element: HTMLElement | null) => void;
  /**
   * Whether a showing page fills each slot. A page that navigation keeps
   * hidden (in an Activity) leaves its hidden nodes in the slot, so the slot
   * being empty doesn't say.
   */
  filled: SlotsFilled;
  claimDock: () => () => void;
  claimExtra: () => () => void;
};

export type SlotsFilled = { dock: boolean; extra: boolean };

const SidebarContext = createContext<SidebarContextValue>({
  wide: false,
  dock: null,
  setDock: () => {},
  extra: null,
  setExtra: () => {},
  filled: { dock: false, extra: false },
  claimDock: () => () => {},
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

const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(SIDEBAR_MEDIA);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/**
 * Wraps the portal shell, tracks where pages can dock their explorer in the
 * sidebar, and carries the light or dark theme (globals.css) for everything
 * inside; the pinned header, mounted above it, follows the same cookie. The
 * server renders light; an inline script switches a hard load to dark before
 * it paints. The browser's theme colour (the status bar, in the installed
 * app) follows along.
 */
export function PortalFrame({ children }: { children: ReactNode }): ReactElement {
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const [extra, setExtra] = useState<HTMLElement | null>(null);
  const [dockFilled, claimDock] = useClaims();
  const [extraFilled, claimExtra] = useClaims();
  const theme = usePortalThemeCookie();
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

  const themeValue = useMemo(() => ({ theme, toggle: togglePortalTheme }), [theme]);
  const sidebarValue = useMemo(
    () => ({
      wide,
      dock,
      setDock,
      extra,
      setExtra,
      filled: { dock: dockFilled, extra: extraFilled },
      claimDock,
      claimExtra,
    }),
    [wide, dock, extra, dockFilled, extraFilled, claimDock, claimExtra],
  );

  return (
    <ThemeContext value={themeValue}>
      <SidebarContext value={sidebarValue}>
        <div ref={frameRef} className={styles.frame} data-theme={theme} suppressHydrationWarning>
          <InlineScript html={PORTAL_THEME_SCRIPT} />
          {children}
        </div>
      </SidebarContext>
    </ThemeContext>
  );
}

/** The portal's current theme, and a toggle that flips it and remembers the choice. */
export function usePortalTheme(): { theme: PortalTheme; toggle: () => void } {
  return use(ThemeContext);
}

/** The ref callback for the sidebar's dock slot. */
export function useDockRef(): (element: HTMLElement | null) => void {
  return use(SidebarContext).setDock;
}

/** Whether a showing page fills the sidebar's dock and extra slots. */
export function useSlotsFilled(): SlotsFilled {
  return use(SidebarContext).filled;
}

/** Holds a slot while `target` is set; the layout effect's cleanup also runs when Activity hides the page. */
function useClaim(target: HTMLElement | null, claim: () => () => void): void {
  const active = target !== null;
  useLayoutEffect(() => (active ? claim() : undefined), [active, claim]);
}

/** Whether a page's explorer is docked in the sidebar: the window is wide enough to show it, and its slot is mounted. */
export function useDocked(): boolean {
  const { wide, dock } = use(SidebarContext);
  return wide && dock !== null;
}

/**
 * Renders `children` in the sidebar while it's showing, and in place on
 * narrow windows; `useDocked` says which. State stays with the page either
 * way, since a portal keeps its React parent.
 */
export function SidebarDock({ children }: { children: ReactNode }): ReactNode {
  const { dock, claimDock } = use(SidebarContext);
  const target = useDocked() ? dock : null;
  useClaim(target, claimDock);
  return target ? createPortal(children, target) : children;
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
