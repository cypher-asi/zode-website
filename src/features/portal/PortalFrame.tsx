"use client";

import {
  createContext,
  use,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { PortalIcon } from "./icons";
import { SIDEBAR_COOKIE, SIDEBAR_MEDIA, type SidebarState } from "./nav";
import styles from "./shell.module.css";

type SidebarContextValue = {
  state: SidebarState;
  toggle: () => void;
  /** Whether the window is wide enough to show the sidebar at all. */
  wide: boolean;
  /** The sidebar's slot for the page's own explorer, e.g. a data room's files. */
  dock: HTMLElement | null;
  setDock: (element: HTMLElement | null) => void;
};

const SidebarContext = createContext<SidebarContextValue>({
  state: "open",
  toggle: () => {},
  wide: false,
  dock: null,
  setDock: () => {},
});

const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(SIDEBAR_MEDIA);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/**
 * Wraps the portal shell and owns whether the labeled sidebar is open. The
 * layout reads the cookie so the first paint already matches; toggling
 * rewrites it for the next visit.
 */
export function PortalFrame({ initial, children }: { initial: SidebarState; children: ReactNode }): ReactElement {
  const [state, setState] = useState(initial);
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(SIDEBAR_MEDIA).matches,
    () => false,
  );

  const toggle = () => {
    const next = state === "open" ? "collapsed" : "open";
    setState(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/portal; max-age=31536000; samesite=lax`;
  };

  return (
    <SidebarContext value={{ state, toggle, wide, dock, setDock }}>
      <div className={styles.frame} data-sidebar={state}>
        {children}
      </div>
    </SidebarContext>
  );
}

/** The ref callback for the sidebar's dock slot. */
export function useDockRef(): (element: HTMLElement | null) => void {
  return use(SidebarContext).setDock;
}

/** Whether a page's explorer is docked in the sidebar: it's open, the window is wide enough, and its slot is mounted. */
export function useDocked(): boolean {
  const { state, wide, dock } = use(SidebarContext);
  return state === "open" && wide && dock !== null;
}

/**
 * Renders `children` in the sidebar while it's showing, and in place
 * otherwise (collapsed, or a narrow window); `useDocked` says which. State
 * stays with the page either way, since a portal keeps its React parent.
 */
export function SidebarDock({ children }: { children: ReactNode }): ReactNode {
  const { dock } = use(SidebarContext);
  return useDocked() && dock ? createPortal(children, dock) : children;
}

/**
 * Shows or hides the sidebar. One sits in the sidebar's corner and one on the
 * rail; only the one for the current state is shown, so focus hops to it.
 */
export function SidebarToggle({
  placement,
  className,
  iconClassName,
  labelClassName,
}: {
  placement: "rail" | "sidebar";
  className: string;
  iconClassName?: string;
  /** Renders the label as a visible tooltip span instead of an `aria-label`. */
  labelClassName?: string;
}): ReactElement {
  const { state, toggle } = use(SidebarContext);
  const label = state === "open" ? "Hide sidebar" : "Show sidebar";

  return (
    <button
      type="button"
      className={className}
      aria-expanded={state === "open"}
      aria-label={labelClassName ? undefined : label}
      data-sidebar-toggle={placement}
      onClick={() => {
        toggle();
        const other = placement === "rail" ? "sidebar" : "rail";
        requestAnimationFrame(() => {
          document.querySelector<HTMLElement>(`[data-sidebar-toggle="${other}"]`)?.focus();
        });
      }}
    >
      <PortalIcon name="sidebar" className={iconClassName} />
      {labelClassName ? <span className={labelClassName}>{label}</span> : null}
    </button>
  );
}
