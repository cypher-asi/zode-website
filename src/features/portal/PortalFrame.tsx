"use client";

import {
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { SIDEBAR_MEDIA } from "./nav";
import styles from "./shell.module.css";
import { PORTAL_THEME_COOKIE, PORTAL_THEME_SCRIPT, readPortalTheme, type PortalTheme } from "./theme";

type SidebarContextValue = {
  /** Whether the window is wide enough to show the sidebar at all. */
  wide: boolean;
  /** The sidebar's slot for the page's own explorer, e.g. a data room's files. */
  dock: HTMLElement | null;
  setDock: (element: HTMLElement | null) => void;
  /** The sidebar's slot under the app's links, for a page's own section, e.g. ZRM's types. */
  extra: HTMLElement | null;
  setExtra: (element: HTMLElement | null) => void;
};

const SidebarContext = createContext<SidebarContextValue>({
  wide: false,
  dock: null,
  setDock: () => {},
  extra: null,
  setExtra: () => {},
});

const ThemeContext = createContext<{ theme: PortalTheme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(SIDEBAR_MEDIA);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** The theme cookie as a store; the cookie has no change event, so `toggleTheme` notifies. */
const themeListeners = new Set<() => void>();

const subscribeTheme = (onChange: () => void) => {
  themeListeners.add(onChange);
  return () => {
    themeListeners.delete(onChange);
  };
};

const toggleTheme = () => {
  const next = readPortalTheme(document.cookie) === "dark" ? "light" : "dark";
  document.cookie = `${PORTAL_THEME_COOKIE}=${next}; Max-Age=31536000; Path=/; SameSite=Lax`;
  themeListeners.forEach((listener) => listener());
};

/**
 * An inline script that runs as a hard load's HTML is parsed. Rendered in the
 * browser, which wouldn't run it, it's `text/plain` so React doesn't warn.
 */
function InlineScript({ html }: { html: string }): ReactElement {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Wraps the portal shell, tracks where pages can dock their explorer in the
 * sidebar, and carries the light or dark theme (globals.css) for everything
 * inside, the pinned header included. The server renders light; an inline
 * script switches a hard load to dark before it paints. The browser's theme
 * colour (the status bar, in the installed app) follows along.
 */
export function PortalFrame({ children }: { children: ReactNode }): ReactElement {
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const [extra, setExtra] = useState<HTMLElement | null>(null);
  const theme = useSyncExternalStore(
    subscribeTheme,
    () => readPortalTheme(document.cookie),
    (): PortalTheme => "light",
  );
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

  const themeValue = useMemo(() => ({ theme, toggle: toggleTheme }), [theme]);
  const sidebarValue = useMemo(() => ({ wide, dock, setDock, extra, setExtra }), [wide, dock, extra]);

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
  const { dock } = use(SidebarContext);
  return useDocked() && dock ? createPortal(children, dock) : children;
}

/** The ref callback for the sidebar's slot under the app's links. */
export function useExtraRef(): (element: HTMLElement | null) => void {
  return use(SidebarContext).setExtra;
}

/** Renders `children` in the sidebar under the app's links while it's showing, and nowhere on narrow windows. */
export function SidebarExtra({ children }: { children: ReactNode }): ReactNode {
  const { wide, extra } = use(SidebarContext);
  return wide && extra ? createPortal(children, extra) : null;
}
