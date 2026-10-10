"use client";

import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { ASSUMPTIONS, usd, type Quote } from "./config";
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

const { downPayment, months, apr } = ASSUMPTIONS.financing;
const TERMS = `${Math.round(downPayment * 100)}% down · ${months} mo · ${(apr * 100).toFixed(1)}% APR`;

/**
 * Bottom bar: the configuration summary on the left; the estimated monthly
 * payment on the right, flashing when it changes. The total cost stays out
 * of the bar until the chevron opens it, with the itemized breakdown, above.
 */
export function PriceBar({ quote, summary }: { quote: Quote; summary: string }): ReactElement {
  const monthly = useTweened(quote.monthly);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

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
    <div ref={rootRef} className={styles.bar} data-surface="light">
      <div className={styles.summary}>
        <p className={styles.name}>Your ZODE</p>
        <p className={styles.config} title={summary}>
          {summary}
        </p>
      </div>

      <div className={styles.figures} aria-live="polite">
        <div className={styles.figure}>
          <span key={quote.monthly} className={`${styles.amount} ${styles.monthly}`}>
            {usd(monthly)}
            <span className={styles.unit}> /mo</span>
          </span>
          <span className={styles.caption}>
            Est. monthly<span className={styles.terms}> · {TERMS}</span>
          </span>
        </div>

        <button
          type="button"
          className={styles.toggle}
          aria-label={open ? "Hide total cost and breakdown" : "Show total cost and breakdown"}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <svg className={styles.chevron} viewBox="0 0 10 6" aria-hidden="true">
            <path d="M1 5l4-4 4 4" />
          </svg>
        </button>
      </div>

      {open ? (
        <div id={panelId} className={styles.breakdown} role="region" aria-label="Price breakdown">
          <p className={styles.breakdownTitle}>Est. total cost</p>
          <p className={styles.total}>{usd(quote.total)}</p>
          <dl className={styles.rows}>
            {quote.lineItems.map((item) => (
              <div key={item.label} className={styles.row}>
                <dt>
                  {item.label}
                  <span className={styles.rowDetail}>{item.detail}</span>
                </dt>
                <dd>{item.amount ? usd(item.amount) : "Included"}</dd>
              </div>
            ))}
            <div className={`${styles.row} ${styles.rowTotal}`}>
              <dt>Total</dt>
              <dd>{usd(quote.total)}</dd>
            </div>
            <div className={styles.row}>
              <dt>Due at signing ({Math.round(downPayment * 100)}%)</dt>
              <dd>{usd(quote.downPayment)}</dd>
            </div>
            <div className={styles.row}>
              <dt>
                Monthly
                <span className={styles.rowDetail}>
                  {months} mo at {(apr * 100).toFixed(1)}% APR
                </span>
              </dt>
              <dd>{usd(quote.monthly)}</dd>
            </div>
          </dl>
          <p className={styles.fineprint}>
            Placeholder estimates for planning only. Excludes site work, taxes, power and shipping.
          </p>
        </div>
      ) : null}
    </div>
  );
}
