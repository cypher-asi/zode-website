"use client";

import { useMemo, type ReactElement } from "react";
import { SidebarExtra } from "@/features/portal/PortalFrame";
import sidebar from "@/features/portal/sidebar.module.css";
import type { SiteGroup } from "./types";

/**
 * Capacity's groups, under the app's links in the portal sidebar: only those
 * some site is in, in pipeline order, each narrowing the list to it, and
 * again to clear. The toolbar's group filter stands in on narrow windows.
 */
export function GroupNav({
  rows,
  groups,
  value,
  onChange,
}: {
  rows: readonly { group_id: string | null }[];
  groups: readonly SiteGroup[];
  value: string;
  onChange: (value: string) => void;
}): ReactElement | null {
  const used = useMemo(() => {
    const ids = new Set(rows.map((row) => row.group_id));
    return groups.filter((group) => ids.has(group.id));
  }, [rows, groups]);

  if (used.length === 0) return null;

  return (
    <SidebarExtra>
      <section aria-label="Groups">
        <h3 className={sidebar.heading}>Groups</h3>
        <ul className={sidebar.links}>
          {used.map((group) => {
            const selected = group.id === value;
            return (
              <li key={group.id}>
                <button
                  type="button"
                  className={sidebar.link}
                  aria-pressed={selected}
                  onClick={() => onChange(selected ? "" : group.id)}
                >
                  <span className={sidebar.linkLabel}>{group.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </SidebarExtra>
  );
}
