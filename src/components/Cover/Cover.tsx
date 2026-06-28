"use client";

import type { ReactElement } from "react";
import Image from "next/image";
import { SlideLayout } from "@/components/SlideLayout";
import styles from "./Cover.module.css";

export const COVER_ID = "cover";

/** Anchor of the Investment slide the cover's primary CTA jumps to. */
const INVESTMENT_SECTION_ID = "investment";

/** When the raise opens; "Opens in N days" counts down to this date. */
const OPEN_DATE = new Date("2026-08-01T00:00:00Z");

interface TargetStat {
  readonly value: string;
  readonly caption: string;
}

const TARGET_STATS: readonly TargetStat[] = [
  { value: "9 ZODES", caption: "In Development" },
  { value: "9 MW", caption: "Power" },
  { value: "$225M/yr", caption: "Revenue" },
  { value: "46.96% ARR", caption: "Target ROE" },
];

function daysUntilOpen(): number {
  const ms = OPEN_DATE.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * The opening slide of the Invest deck: an opportunity cover headlining the
 * active ZODE 9 MW raise. A two-column hero (site artwork + funding panel)
 * sits above a TARGET SITE stats row. The primary CTA smooth-scrolls to the
 * Investment section deeper in the deck. Excluded from the numbered tick-rail.
 */
export function Cover(): ReactElement {
  const days = daysUntilOpen();

  const goToInvestment = (): void => {
    document
      .getElementById(INVESTMENT_SECTION_ID)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <SlideLayout
      id={COVER_ID}
      ariaLabel="Investment opportunity"
      top={
        <header className={styles.header}>
          <p className={styles.kicker}>ZODE Build Out (In Development)</p>
          <h1 className={styles.title}>Invest in the ZODE 9 MW site</h1>
          <p className={styles.location}>British Columbia</p>
        </header>
      }
      middle={
        <div className={styles.hero}>
          <div className={styles.media}>
            <Image
              src="/images/opportunity-cabins.png"
              alt="ZODE site: clustered cabins on a forested British Columbia hillside"
              fill
              sizes="(max-width: 900px) 100vw, 66vw"
              priority
              unoptimized
              className={styles.mediaImage}
            />
          </div>

          <aside className={styles.panel}>
            <div className={styles.raise}>
              <p className={styles.raiseLabel}>Raising</p>
              <p className={styles.raiseValue}>$50M</p>
            </div>

            <dl className={styles.meta}>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>Opens in</dt>
                <dd className={styles.metaValue}>
                  {days} {days === 1 ? "day" : "days"}
                </dd>
              </div>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>Target Deployment</dt>
                <dd className={styles.metaValue}>Dec. 2026</dd>
              </div>
            </dl>

            <button
              type="button"
              className={styles.investButton}
              onClick={goToInvestment}
            >
              Invest
            </button>
          </aside>
        </div>
      }
      bottom={
        <div className={styles.stats}>
          <p className={styles.statsKicker}>Target Site</p>
          <div className={styles.statsRow}>
            {TARGET_STATS.map((stat) => (
              <div key={stat.caption} className={styles.stat}>
                <p className={styles.statValue}>{stat.value}</p>
                <p className={styles.statCaption}>{stat.caption}</p>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}
