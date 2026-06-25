import type { ReactElement } from "react";
import { GridLogo } from "@/components/GridLogo";
import { SlideLayout } from "@/components/SlideLayout";
import styles from "./Cover.module.css";

export const COVER_ID = "cover";

/**
 * The opening slide: the large GridLogo mark centered on the dark shell.
 * It is the first full-panel slide but is intentionally excluded from the
 * numbered tick-rail navigation (the rail's logo button returns here).
 */
export function Cover(): ReactElement {
  return (
    <SlideLayout
      id={COVER_ID}
      ariaLabel="Cover"
      middleClassName={styles.cover}
      middle={<GridLogo showWordmark={false} size="cover" />}
    />
  );
}
