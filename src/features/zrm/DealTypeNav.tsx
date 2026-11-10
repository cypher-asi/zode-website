"use client";

import { useMemo, type ReactElement } from "react";
import { SidebarExtra } from "@/features/portal/PortalFrame";
import sidebar from "@/features/portal/sidebar.module.css";
import { OPPORTUNITY_DEAL_TYPES, type OpportunityDealType } from "./fields";
import type { OpportunityKind } from "./types";

/**
 * A pipeline's deal types, under the app's links in the portal sidebar: only
 * those some opportunity has, in the pipeline's order, each narrowing the list
 * to it, and again to clear. The toolbar's deal type filter stands in on
 * narrow windows.
 */
export function DealTypeNav({
  kind,
  rows,
  value,
  onChange,
}: {
  kind: OpportunityKind;
  rows: readonly { deal_type: OpportunityDealType }[];
  value: string;
  onChange: (value: string) => void;
}): ReactElement | null {
  const used = useMemo(() => {
    const types = new Set(rows.map((row) => row.deal_type));
    return OPPORTUNITY_DEAL_TYPES[kind].filter((type) => types.has(type));
  }, [kind, rows]);

  if (used.length === 0) return null;

  return (
    <SidebarExtra>
      <section aria-label="Deal types">
        <h3 className={sidebar.heading}>Deal types</h3>
        <ul className={sidebar.links}>
          {used.map((type) => {
            const selected = type === value;
            return (
              <li key={type}>
                <button
                  type="button"
                  className={sidebar.link}
                  aria-pressed={selected}
                  onClick={() => onChange(selected ? "" : type)}
                >
                  <span className={sidebar.linkLabel}>{type}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </SidebarExtra>
  );
}
