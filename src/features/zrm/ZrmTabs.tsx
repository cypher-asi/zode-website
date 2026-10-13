"use client";

import type { ReactElement } from "react";
import styles from "@/features/data-room/room.module.css";
import { KINDS, KIND_LABELS } from "./types";
import { useZrm, ZrmLink } from "./ZrmProvider";

/** People, Companies and Opportunities, at the top right of ZRM. */
export function ZrmTabs(): ReactElement {
  const { segments } = useZrm();
  return (
    <nav className={styles.tabs} aria-label="ZRM sections">
      {KINDS.map((kind) => (
        <ZrmLink
          key={kind}
          href={`/portal/zrm/${kind}`}
          className={styles.tab}
          aria-current={segments[0] === kind ? "page" : undefined}
        >
          {KIND_LABELS[kind].plural}
        </ZrmLink>
      ))}
    </nav>
  );
}
