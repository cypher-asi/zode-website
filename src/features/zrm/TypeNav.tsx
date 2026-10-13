"use client";

import { useMemo, type ReactElement } from "react";
import { SidebarExtra } from "@/features/portal/PortalFrame";
import sidebar from "@/features/portal/sidebar.module.css";
import type { ZrmType } from "./types";

/**
 * The open list's types, under the app's links in the portal sidebar: only
 * those some row has, each narrowing the list to it, and again to clear.
 * The toolbar's type filter stands in on windows too narrow for the sidebar.
 */
export function TypeNav({
  rows,
  types,
  value,
  onChange,
}: {
  rows: readonly { type_ids: string[] }[];
  types: readonly ZrmType[];
  value: string;
  onChange: (value: string) => void;
}): ReactElement | null {
  const used = useMemo(() => {
    const ids = new Set(rows.flatMap((row) => row.type_ids));
    return types.filter((type) => ids.has(type.id));
  }, [rows, types]);

  if (used.length === 0) return null;

  return (
    <SidebarExtra>
      <section aria-label="Types">
        <h3 className={sidebar.heading}>Types</h3>
        <ul className={sidebar.links}>
          {used.map((type) => {
            const selected = type.id === value;
            return (
              <li key={type.id}>
                <button
                  type="button"
                  className={sidebar.link}
                  aria-pressed={selected}
                  onClick={() => onChange(selected ? "" : type.id)}
                >
                  <span className={sidebar.swatch} style={{ background: type.color }} aria-hidden="true" />
                  <span className={sidebar.linkLabel}>{type.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </SidebarExtra>
  );
}
