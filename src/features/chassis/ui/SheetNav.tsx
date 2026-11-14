"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactElement } from "react";
import { PortalIcon } from "@/features/portal/icons";
import sidebar from "@/features/portal/sidebar.module.css";
import type { Sheet } from "../model/schema";
import { useDesign } from "../store";
import { CHASSIS_HREF, DATA_VIEWS, sheetHref, viewHref } from "../types";
import styles from "../chassis.module.css";

const DISCIPLINES: { id: Sheet["discipline"]; label: string }[] = [
  { id: "G", label: "General" },
  { id: "E", label: "Electrical" },
  { id: "M", label: "Mechanical" },
];

/**
 * The design's sheets, in drawing-set order or by discipline, then its data
 * pages. `docked` in the portal sidebar, it takes the sidebar's look and
 * leads with the way back to all designs, which it stands in for there.
 */
export function SheetNav({ designId, docked }: { designId: string; docked: boolean }): ReactElement {
  const pathname = usePathname();
  const sheets = useDesign((s) => s.data.sheets.sheets);
  const failing = useDesign((s) => s.derived.checks.filter((c) => c.status === "fail").length);
  const [mode, setMode] = useState<"set" | "discipline">("set");
  const indexed = sheets.map((sheet, i) => ({ sheet, n: i + 1 }));
  const linkClass = docked ? `${sidebar.link} ${styles.dockLink}` : styles.navLink;
  const headingClass = docked ? `${sidebar.heading} ${styles.dockHeading}` : styles.group;

  const link = ({ sheet, n }: { sheet: Sheet; n: number }) => {
    const href = sheetHref(designId, sheet.id);
    return (
      <Link key={sheet.id} href={href} className={linkClass} aria-current={pathname === href ? "page" : undefined}>
        <span className={styles.navNumber}>{String(n).padStart(2, "0")}</span>
        <span className={styles.navId}>{sheet.id}</span>
        <span className={styles.navLabel}>{sheet.title}</span>
      </Link>
    );
  };

  return (
    <nav className={styles.nav} data-docked={docked || undefined} aria-label="Sheets">
      {docked ? (
        <Link href={CHASSIS_HREF} className={sidebar.link}>
          <PortalIcon name="chassis" className={sidebar.linkIcon} />
          <span className={sidebar.linkLabel}>All designs</span>
        </Link>
      ) : null}
      <div className={styles.navHead}>
        <span className={docked ? sidebar.heading : styles.navTitle}>Sheets</span>
        <div className={styles.segmented}>
          {(["set", "discipline"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === "set" ? "Set order" : "Discipline"}
            </button>
          ))}
        </div>
      </div>
      {mode === "set"
        ? indexed.map(link)
        : DISCIPLINES.map((d) => (
            <div key={d.id}>
              <div className={headingClass}>{d.label}</div>
              {indexed.filter((x) => x.sheet.discipline === d.id).map(link)}
            </div>
          ))}

      <div className={headingClass}>Data</div>
      {DATA_VIEWS.map((view) => {
        const href = viewHref(designId, view.id);
        return (
          <Link key={view.id} href={href} className={linkClass} aria-current={pathname === href ? "page" : undefined}>
            <span className={styles.navLabel}>{view.label}</span>
            {view.id === "checks" && failing > 0 ? <span className={styles.count}>{failing}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
