"use client";

import type { ReactElement } from "react";
import styles from "@/features/data-room/room.module.css";
import { Icon } from "./bits";
import { useStored } from "./stored";
import { isOpportunityKind, type RecordKind } from "./types";
import { useZrmData, useZrmRoute } from "./ZrmProvider";
import zrm from "./zrm.module.css";

export type ListView = "list" | "kanban";

const VIEWS = [
  { id: "list", label: "List", icon: "list" },
  { id: "kanban", label: "Kanban", icon: "board" },
] as const;

/** How a list shows its records, remembered per browser. Only opportunities have a kanban, by stage. */
export function useListView(kind: RecordKind | undefined): [ListView, (view: ListView) => void] {
  const [stored, setStored] = useStored(`zode:zrm:view:${kind ?? ""}`);
  const view: ListView = kind && isOpportunityKind(kind) && stored === "kanban" ? "kanban" : "list";
  return [view, setStored];
}

/** List or kanban, for the open pipeline, at the top right of ZRM. */
export function ZrmViewSwitch(): ReactElement | null {
  const { kinds } = useZrmData();
  const { segments } = useZrmRoute();
  const kind = kinds.find((k) => k === segments[0]);
  const [view, setView] = useListView(kind);
  if (!kind || !isOpportunityKind(kind)) return null;
  return (
    <div className={styles.tabs} role="group" aria-label="View">
      {VIEWS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`${styles.tab} ${styles.iconTab} ${zrm.viewTab}`}
          aria-pressed={view === option.id}
          aria-label={option.label}
          title={option.label}
          onClick={() => setView(option.id)}
        >
          <Icon name={option.icon} className={`${styles.tabIcon} ${zrm.viewIcon}`} />
        </button>
      ))}
    </div>
  );
}
