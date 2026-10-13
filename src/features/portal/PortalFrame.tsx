"use client";

import { createContext, use, useState, type ReactElement, type ReactNode } from "react";
import { PortalIcon } from "./icons";
import { SIDEBAR_COOKIE, type SidebarState } from "./nav";
import styles from "./shell.module.css";

const SidebarContext = createContext<{ state: SidebarState; toggle: () => void }>({
  state: "open",
  toggle: () => {},
});

/**
 * Wraps the portal shell and owns whether the labeled sidebar is open. The
 * layout reads the cookie so the first paint already matches; toggling
 * rewrites it for the next visit.
 */
export function PortalFrame({ initial, children }: { initial: SidebarState; children: ReactNode }): ReactElement {
  const [state, setState] = useState(initial);

  const toggle = () => {
    const next = state === "open" ? "collapsed" : "open";
    setState(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/portal; max-age=31536000; samesite=lax`;
  };

  return (
    <SidebarContext value={{ state, toggle }}>
      <div className={styles.frame} data-sidebar={state}>
        {children}
      </div>
    </SidebarContext>
  );
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
