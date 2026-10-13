"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import styles from "@/features/data-room/room.module.css";
import { KINDS, KIND_LABELS } from "./types";

/** People, Companies and Opportunities, at the top right of ZRM. */
export function ZrmTabs(): ReactElement {
  const current = useSelectedLayoutSegment();
  return (
    <nav className={styles.tabs} aria-label="ZRM sections">
      {KINDS.map((kind) => (
        <Link
          key={kind}
          href={`/portal/zrm/${kind}`}
          className={styles.tab}
          aria-current={current === kind ? "page" : undefined}
        >
          {KIND_LABELS[kind].plural}
        </Link>
      ))}
    </nav>
  );
}
