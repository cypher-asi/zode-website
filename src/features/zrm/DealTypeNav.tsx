"use client";

import type { ReactElement } from "react";
import { SidebarExtra } from "@/features/portal/PortalFrame";
import sidebar from "@/features/portal/sidebar.module.css";
import { OPPORTUNITY_DEAL_TYPES } from "./fields";
import type { OpportunityKind } from "./types";

/**
 * A pipeline's deal types, under the app's links in the portal sidebar: all
 * of them, in the pipeline's order, so a pipeline shows its types before it
 * has opportunities. Each narrows the list to it, and again to clear. The
 * toolbar's deal type filter stands in on narrow windows.
 */
export function DealTypeNav({
  kind,
  value,
  onChange,
}: {
  kind: OpportunityKind;
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <SidebarExtra>
      <section aria-label="Deal types">
        <h3 className={sidebar.heading}>Deal types</h3>
        <ul className={sidebar.links}>
          {OPPORTUNITY_DEAL_TYPES[kind].map((type) => {
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
