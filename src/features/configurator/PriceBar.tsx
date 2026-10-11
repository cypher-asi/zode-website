"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { usd, type PriceView, type Stat } from "./buyConfig";
import styles from "./PriceBar.module.css";

const TWEEN_MS = 450;

/** Eases the shown value toward `target` whenever it changes. */
function useTweened(target: number): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = from.current;
    if (start === target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      setShown(target);
      return;
    }
    const t0 = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - t0) / TWEEN_MS);
      const value = start + (target - start) * (1 - (1 - t) ** 3);
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

function Stats({ label, stats, className }: { label: string; stats: Stat[]; className: string }): ReactElement {
  return (
    <dl className={className} aria-label={label}>
      {stats.map((s) => (
        <div key={s.label} className={styles.stat}>
          <dt className={styles.statLabel}>{s.label}</dt>
          <dd className={styles.statValue}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Floating price panel: the configured choices above the cluster figures,
 * sharing one column grid, with the headline price (the monthly payment when
 * buying, the all-in GPU-hour rate when renting) beside them, flashing when
 * it changes. The itemized breakdown stays out of the panel until the
 * chevron opens it above. On phones the panel narrows to the prices alone
 * and the cluster figures move into the breakdown.
 */
export function PriceBar({ view }: { view: PriceView }): ReactElement {
  const { headline, secondary, breakdown, summary } = view;
  const shown = useTweened(headline.value);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // The drawing panel keeps its contents clear of however tall this panel lays out, and on
  // phones the page leaves room for it at the bottom, so the height goes on the shared
  // `data-price-host` ancestor where both can read it.
  useLayoutEffect(() => {
    const dock = rootRef.current;
    const host = dock?.closest<HTMLElement>("[data-price-host]") ?? dock?.parentElement;
    if (!dock || !host) return;
    const bar = dock.firstElementChild as HTMLElement;
    const observer = new ResizeObserver(() => host.style.setProperty("--price-panel-h", `${bar.offsetHeight}px`));
    observer.observe(bar);
    return () => {
      observer.disconnect();
      host.style.removeProperty("--price-panel-h");
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.dock} data-surface="light">
      <div className={styles.bar}>
        <div className={styles.stats}>
          <Stats label="Configuration" stats={summary.choices} className={`${styles.statRow} ${styles.spec}`} />
          <Stats label="Cluster" stats={summary.cluster} className={styles.statRow} />
        </div>

        <div className={styles.figures} aria-live="polite">
          {secondary ? (
            <div className={styles.figure}>
              <span key={secondary.value} className={styles.amount}>
                {secondary.value}
                <span className={styles.unit}> {secondary.unit}</span>
              </span>
              <span className={styles.caption}>{secondary.caption}</span>
            </div>
          ) : null}

          <div className={styles.figure}>
            <span key={headline.value} className={`${styles.amount} ${styles.headline}`}>
              {headline.format(shown)}
              <span className={styles.unit}> {headline.unit}</span>
            </span>
            <span className={styles.caption}>
              {headline.caption}
              {headline.terms ? <span className={styles.terms}> · {headline.terms}</span> : null}
            </span>
          </div>

          <button
            type="button"
            className={styles.toggle}
            aria-label={open ? "Hide price breakdown" : "Show price breakdown"}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            <svg className={styles.chevron} viewBox="0 0 10 6" aria-hidden="true">
              <path d="M1 5l4-4 4 4" />
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div id={panelId} className={styles.breakdown} role="region" aria-label="Price breakdown">
          <p className={styles.breakdownTitle}>{breakdown.title}</p>
          <p className={styles.total}>{breakdown.total}</p>
          <Stats label="Cluster" stats={summary.cluster} className={styles.breakdownStats} />
          <dl className={styles.rows}>
            {breakdown.rows.map((item) => (
              <div key={item.label} className={styles.row}>
                <dt>
                  {item.label}
                  <span className={styles.rowDetail}>{item.detail}</span>
                </dt>
                <dd>{item.amount ? usd(item.amount) : "Included"}</dd>
              </div>
            ))}
            {breakdown.footer.map((row) => (
              <div key={row.label} className={row.total ? `${styles.row} ${styles.rowTotal}` : styles.row}>
                <dt>
                  {row.label}
                  {row.detail ? <span className={styles.rowDetail}>{row.detail}</span> : null}
                </dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.fineprint}>{breakdown.fineprint}</p>
        </div>
      ) : null}
    </div>
  );
}
