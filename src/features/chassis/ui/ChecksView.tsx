"use client";

import type { ReactElement } from "react";
import type { CheckStatus } from "../model/calc";
import { useDesign } from "../store";
import styles from "../chassis.module.css";

const STATUSES: readonly CheckStatus[] = ["pass", "warn", "fail", "info"];

/** Every design check, recomputed on each edit; a check about a BOM line, part or rack opens it in the inspector. */
export function ChecksView(): ReactElement {
  const checks = useDesign((s) => s.derived.checks);
  const select = useDesign((s) => s.select);
  const groups = [...new Set(checks.map((c) => c.group))];

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <div className={styles.pageHead}>
          <div>
            <h2 className={styles.pageTitle}>Design checks</h2>
            <p className={styles.pageText}>
              Recomputed from the design on every edit. A check tied to a BOM line, part or rack opens it in the
              inspector.
            </p>
          </div>
          <div className={styles.pageTools}>
            {STATUSES.map((status) => (
              <span key={status} className={styles.badge} data-status={status}>
                {checks.filter((c) => c.status === status).length} {status}
              </span>
            ))}
          </div>
        </div>
        {groups.map((group) => (
          <section key={group} className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>{group}</h3>
            </div>
            <div className={styles.tableWrap}>
              {checks
                .filter((c) => c.group === group)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.checkRow}
                    data-linked={c.ref ? "" : undefined}
                    disabled={!c.ref}
                    onClick={() => c.ref && select(c.ref)}
                  >
                    <span className={styles.badge} data-status={c.status}>
                      {c.status}
                    </span>
                    <span>
                      {c.label}
                      {c.detail ? <span className={styles.checkDetail}>{c.detail}</span> : null}
                    </span>
                    <span className={`${styles.mono} ${styles.num}`}>{c.value}</span>
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
