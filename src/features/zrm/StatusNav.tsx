"use client";

import { useMemo, type ReactElement } from "react";
import { SidebarExtra } from "@/features/portal/PortalFrame";
import sidebar from "@/features/portal/sidebar.module.css";
import type { SiteStatus } from "./types";

/**
 * Capacity's statuses, under the app's links in the portal sidebar: only those
 * some site has, furthest along first, each narrowing the list to it, and
 * again to clear. The toolbar's status filter stands in on narrow windows.
 */
export function StatusNav({
  rows,
  statuses,
  value,
  onChange,
}: {
  rows: readonly { status_id: string }[];
  statuses: readonly SiteStatus[];
  value: string;
  onChange: (value: string) => void;
}): ReactElement | null {
  const used = useMemo(() => {
    const ids = new Set(rows.map((row) => row.status_id));
    return statuses.filter((status) => ids.has(status.id));
  }, [rows, statuses]);

  if (used.length === 0) return null;

  return (
    <SidebarExtra>
      <section aria-label="Statuses">
        <h3 className={sidebar.heading}>Statuses</h3>
        <ul className={sidebar.links}>
          {used.map((status) => {
            const selected = status.id === value;
            return (
              <li key={status.id}>
                <button
                  type="button"
                  className={sidebar.link}
                  aria-pressed={selected}
                  onClick={() => onChange(selected ? "" : status.id)}
                >
                  <span className={sidebar.linkLabel}>{status.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </SidebarExtra>
  );
}
