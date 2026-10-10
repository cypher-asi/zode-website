"use client";

import { useState, type ReactElement } from "react";
import { CabinArt } from "../future-home/pod/CabinArt";
import { POD_TOURS, type PodId } from "../future-home/pod/podTour";
import type { Focus, Quote } from "./config";
import styles from "./ZodePreview.module.css";

/** Pod outlines drawn under the count before the rest collapse into "+N". */
const MAX_PIPS = 24;

/**
 * The ZODE line drawing over a light panel. The configurator's current focus
 * picks the pod on display and warms up the matching part; hovering the
 * drawing itself, or picking a pod below it, overrides that until the focus
 * next changes.
 */
export function ZodePreview({ focus, quote }: { focus: Focus; quote: Quote }): ReactElement {
  const [override, setOverride] = useState<PodId | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [lastFocus, setLastFocus] = useState(focus);

  if (lastFocus !== focus) {
    setLastFocus(focus);
    setOverride(null);
  }

  const pod = override ?? focus.pod;
  const tour = POD_TOURS.find((t) => t.id === pod) ?? POD_TOURS[0];
  const active = hovered ?? (override ? null : focus.zone);

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Viewing</p>
          <h2 className={styles.title}>{tour.title}</h2>
        </div>
        <div className={styles.count} aria-label={`${quote.zodes} ZODE${quote.zodes === 1 ? "" : "s"}`}>
          <span className={styles.countValue}>× {quote.zodes}</span>
          <span className={styles.pips} aria-hidden="true">
            {Array.from({ length: Math.min(quote.zodes, MAX_PIPS) }, (_, i) => (
              <span key={i} className={styles.pip} />
            ))}
            {quote.zodes > MAX_PIPS ? <span className={styles.more}>+{quote.zodes - MAX_PIPS}</span> : null}
          </span>
        </div>
      </header>

      <div className={styles.figure}>
        <CabinArt pod={pod} active={active} onActive={setHovered} />
      </div>

      <div className={styles.pods} role="group" aria-label="Pod on display">
        {POD_TOURS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={styles.pod}
            aria-pressed={t.id === pod}
            onClick={() => setOverride(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
