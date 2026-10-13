"use client";

import { createContext, use, useState, useSyncExternalStore, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SIDEBAR_MEDIA } from "./nav";
import styles from "./shell.module.css";
import { PORTAL_THEME_COOKIE, type PortalTheme } from "./theme";

type SidebarContextValue = {
  /** Whether the window is wide enough to show the sidebar at all. */
  wide: boolean;
  /** The sidebar's slot for the page's own explorer, e.g. a data room's files. */
  dock: HTMLElement | null;
  setDock: (element: HTMLElement | null) => void;
};

const SidebarContext = createContext<SidebarContextValue>({ wide: false, dock: null, setDock: () => {} });

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
 * inside, the pinned header included.
 */
export function PortalFrame({
  initialTheme,
  children,
}: {
  initialTheme: PortalTheme;
  children: ReactNode;
}): ReactElement {
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const [theme, setTheme] = useState(initialTheme);
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(SIDEBAR_MEDIA).matches,
    () => false,
  );

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.cookie = `${PORTAL_THEME_COOKIE}=${next}; Max-Age=31536000; Path=/; SameSite=Lax`;
  };

  return (
    <ThemeContext value={{ theme, toggle }}>
      <SidebarContext value={{ wide, dock, setDock }}>
        <div className={styles.frame} data-theme={theme}>
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
