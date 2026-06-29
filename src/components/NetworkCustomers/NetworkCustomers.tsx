"use client";

import { useEffect, useState, type ReactElement } from "react";
import styles from "./NetworkCustomers.module.css";

/** How long each segment stays active before advancing (and the fill duration). */
const SLIDE_DURATION_MS = 6000;

interface Customer {
  readonly tab: string;
  readonly challenge: string;
  readonly solution: string;
  readonly alt: string;
}

const CUSTOMERS: readonly Customer[] = [
  {
    tab: "AI Startups",
    challenge:
      "Frontier training runs stall waiting on scarce GPU capacity, and on-demand cloud pricing burns through a seed round before the first model ships.",
    solution:
      "Burst onto pooled GRID capacity in minutes, scaling clusters up for a run and back down overnight without long-term commitments or idle spend.",
    alt: "Placeholder image for the AI startups customer story.",
  },
  {
    tab: "Labs",
    challenge:
      "Research teams need reproducible, isolated environments for sensitive datasets, but shared public cloud makes provenance and access hard to guarantee.",
    solution:
      "Dedicated, sovereign nodes keep each experiment isolated and auditable, so results stay reproducible and data never leaves an approved boundary.",
    alt: "Placeholder image for the research labs customer story.",
  },
  {
    tab: "Hyperscalers",
    challenge:
      "Demand spikes outpace data-center build timelines, leaving regions capacity-constrained exactly when customers need the most compute.",
    solution:
      "Tap rapidly deployable GRID sites as elastic overflow, absorbing peak load near the edge while permanent capacity comes online.",
    alt: "Placeholder image for the hyperscaler customer story.",
  },
  {
    tab: "Governments",
    challenge:
      "Mandates require workloads and citizen data to remain inside national borders, which rules out most global cloud regions.",
    solution:
      "Run on in-country, sovereign infrastructure with full control over data residency, access, and the underlying open-source stack.",
    alt: "Placeholder image for the government customer story.",
  },
];

const EYEBROW = "Who runs on THE GRID";
const TITLE = "Built for teams that can't compromise on sovereignty";

/**
 * Customer-stories band on the Network page: an eyebrow + heading, a row of
 * selectable customer segments, and a Challenge/Solution writeup beside a media
 * panel. Copy and imagery are mock placeholders for now. Prev/next controls
 * cycle the active segment.
 */
export function NetworkCustomers(): ReactElement {
  const [active, setActive] = useState(0);
  const current = CUSTOMERS[active] ?? CUSTOMERS[0];

  const step = (direction: 1 | -1): void => {
    setActive((index) => (index + direction + CUSTOMERS.length) % CUSTOMERS.length);
  };

  // Auto-advance on a loop. Keyed on `active`, so a manual click or arrow press
  // restarts the clock (and the underline fill) from the newly selected tab.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setActive((index) => (index + 1) % CUSTOMERS.length);
    }, SLIDE_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [active]);

  return (
    <section className={styles.section} aria-label="Customer stories">
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>{EYEBROW}</p>
          <h2 className={styles.title}>{TITLE}</h2>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Customer segments">
          {CUSTOMERS.map((customer, index) => (
            <button
              key={customer.tab}
              type="button"
              role="tab"
              aria-selected={index === active}
              className={`${styles.tab} ${index === active ? styles.tabActive : ""}`}
              onClick={() => setActive(index)}
            >
              {customer.tab}
              {index === active ? (
                <span className={styles.progress} aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          <div className={styles.block}>
            <p className={styles.blockLabel}>
              <Dots />
              Challenge
            </p>
            <p className={styles.blockText}>{current.challenge}</p>
          </div>
          <div className={styles.block}>
            <p className={styles.blockLabel}>
              <Dots />
              Solution
            </p>
            <p className={styles.blockText}>{current.solution}</p>
          </div>
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.control}
            onClick={() => step(-1)}
            aria-label="Previous customer"
          >
            <Arrow direction="left" />
          </button>
          <button
            type="button"
            className={styles.control}
            onClick={() => step(1)}
            aria-label="Next customer"
          >
            <Arrow direction="right" />
          </button>
        </div>
      </div>
    </section>
  );
}

function Dots(): ReactElement {
  return (
    <svg
      className={styles.dots}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden="true"
    >
      {[1, 5, 9].map((y) =>
        [1, 5, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />),
      )}
    </svg>
  );
}

function Arrow({ direction }: { readonly direction: "left" | "right" }): ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === "right" ? "M5 12h14M13 6l6 6-6 6" : "M19 12H5M11 6l-6 6 6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
