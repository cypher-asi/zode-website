"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import Image from "next/image";
import { SlideLayout } from "@/components/SlideLayout";
import styles from "./Cover.module.css";

export const COVER_ID = "cover";

/** Anchor of the next slide the cover's primary CTA jumps to. */
const NEXT_SECTION_ID = "summary";

/** When the raise opens; the "Opens in" countdown ticks down to this date. */
const OPEN_DATE = new Date("2026-08-15T00:00:00");

interface TargetStat {
  readonly value: string;
  /** Smaller trailing unit; the leading separator is baked in. */
  readonly unit: string;
  readonly caption: string;
}

const TARGET_STATS: readonly TargetStat[] = [
  { value: "9", unit: " ZODES", caption: "In Development" },
  { value: "9", unit: " MW", caption: "Power" },
  { value: "$225M", unit: "/yr", caption: "Revenue" },
  { value: "46.96%", unit: " ARR", caption: "Target ROE" },
];

interface Countdown {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

function getCountdown(targetMs: number): Countdown {
  const total = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * The opening slide of the Invest deck: an opportunity cover headlining the
 * active ZODE 9 MW raise. A two-column hero (site artwork + funding panel)
 * sits above a TARGET SITE stats row. The primary CTA smooth-scrolls to the
 * Investment section deeper in the deck. Excluded from the numbered tick-rail.
 */
export function Cover(): ReactElement {
  // Null until mounted so the server and first client render match; the
  // live time is only known on the client.
  const [countdown, setCountdown] = useState<Countdown | null>(null);

  // Fade the hero artwork in once it has actually decoded, so navigating to
  // the deck never flashes a half-painted image.
  const [imageReady, setImageReady] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const targetMs = OPEN_DATE.getTime();
    const tick = (): void => setCountdown(getCountdown(targetMs));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);

  // A cached image can finish before React attaches `onLoad`; catch that here.
  useEffect(() => {
    if (imageRef.current?.complete) setImageReady(true);
  }, []);

  const goToNext = (): void => {
    document
      .getElementById(NEXT_SECTION_ID)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <SlideLayout
      id={COVER_ID}
      ariaLabel="Investment opportunity"
      top={
        <header className={styles.header}>
          <div className={styles.kickerRow}>
            <p className={styles.kicker}>ZODE Build Out</p>
            <span className={styles.tag}>In Development</span>
          </div>
            <h1 className={styles.title}>Invest in ZODE SITE I</h1>
            <p className={styles.location}>
              British Columbia, Canada &middot; 200+ acres &middot; 9 MW &middot; 4,230 GPUs
            </p>
        </header>
      }
      middle={
        <div className={styles.hero}>
          <div className={styles.media}>
            <Image
              ref={imageRef}
              src="/images/opportunity-cabins.png"
              alt="ZODE site: clustered units on a forested British Columbia hillside"
              fill
              sizes="(max-width: 900px) 100vw, 66vw"
              priority
              unoptimized
              className={styles.mediaImage}
              data-ready={imageReady ? "true" : "false"}
              onLoad={() => setImageReady(true)}
            />
          </div>

          <aside className={styles.panel}>
            <div className={styles.raise}>
              <p className={styles.raiseLabel}>Raising</p>
              <p className={styles.raiseValue}>$45M</p>
            </div>

            <dl className={styles.meta}>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>Opens in</dt>
                <dd className={styles.metaValue}>
                  <span
                    className={styles.countdown}
                    data-ready={countdown ? "true" : "false"}
                    suppressHydrationWarning
                  >
                    {([
                      ["days", countdown?.days],
                      ["hrs", countdown?.hours],
                      ["min", countdown?.minutes],
                      ["sec", countdown?.seconds],
                    ] as const).map(([unit, value]) => (
                      <span key={unit} className={styles.countdownUnit}>
                        <span className={styles.countdownNumber}>
                          {value === undefined ? "--" : pad(value)}
                        </span>
                        <span className={styles.countdownLabel}>{unit}</span>
                      </span>
                    ))}
                  </span>
                </dd>
              </div>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>Partner</dt>
                <dd className={styles.metaValue}>
                  <a
                    className={styles.metaLink}
                    href="https://republic.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Republic.com
                  </a>{" "}
                  + Private
                </dd>
              </div>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>Structure</dt>
                <dd className={styles.metaValue}>
                  Corporate Equity + Participating Profit Units (PPUs) in Site
                </dd>
              </div>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>Target Deployment</dt>
                <dd className={styles.metaValue}>December 2026</dd>
              </div>
            </dl>

            <button
              type="button"
              className={styles.investButton}
              onClick={goToNext}
            >
              Learn More
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
                <p className={styles.statValue}>
                  {stat.value}
                  <span className={styles.statUnit}>{stat.unit}</span>
                </p>
                <p className={styles.statCaption}>{stat.caption}</p>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}
