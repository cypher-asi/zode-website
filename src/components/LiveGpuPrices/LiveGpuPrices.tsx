"use client";

import { useState, type ReactElement } from "react";
import styles from "./LiveGpuPrices.module.css";

type Availability = "high" | "medium" | "low";
type Range = "30D" | "90D" | "180D";

interface Gpu {
  readonly name: string;
  readonly arch: string;
  readonly vram: string;
  readonly availability: Availability;
  readonly price: number;
  readonly low: number;
  readonly high: number;
  /** Line color: orange for volatile/rising, teal for declining. */
  readonly trend: "orange" | "teal";
  /** Representative price history per time window (oldest to newest). */
  readonly history: Readonly<Record<Range, readonly number[]>>;
}

const RANGES: readonly Range[] = ["30D", "90D", "180D"];

const AVAILABILITY_LABEL: Readonly<Record<Availability, string>> = {
  high: "High",
  medium: "Med",
  low: "Low",
};

const AVAILABILITY_BARS: Readonly<Record<Availability, number>> = {
  high: 3,
  medium: 2,
  low: 1,
};

const GPUS: readonly Gpu[] = [
  {
    name: "B300",
    arch: "Blackwell Ultra",
    vram: "288GB VRAM",
    availability: "low",
    price: 6.06,
    low: 5.0,
    high: 6.88,
    trend: "orange",
    history: {
      "30D": [5.9, 6.0, 5.95, 6.1, 6.0, 6.05, 5.98, 6.06],
      "90D": [5.4, 5.6, 5.7, 5.85, 5.8, 5.95, 6.0, 6.06],
      "180D": [5.0, 5.2, 5.5, 5.7, 6.2, 6.4, 6.1, 6.06],
    },
  },
  {
    name: "B200",
    arch: "Blackwell",
    vram: "192GB VRAM",
    availability: "medium",
    price: 4.34,
    low: 3.44,
    high: 5.94,
    trend: "orange",
    history: {
      "30D": [4.3, 4.32, 4.31, 4.35, 4.33, 4.34, 4.32, 4.34],
      "90D": [4.1, 4.2, 4.25, 4.3, 4.28, 4.32, 4.33, 4.34],
      "180D": [5.9, 5.2, 4.6, 4.2, 3.5, 3.9, 4.2, 4.34],
    },
  },
  {
    name: "H200",
    arch: "Hopper",
    vram: "141GB VRAM",
    availability: "high",
    price: 3.29,
    low: 2.76,
    high: 7.89,
    trend: "orange",
    history: {
      "30D": [3.3, 3.32, 3.28, 3.0, 2.8, 3.1, 3.27, 3.29],
      "90D": [3.4, 3.35, 3.2, 2.9, 3.0, 3.2, 3.28, 3.29],
      "180D": [7.8, 5.4, 4.2, 3.6, 3.1, 2.8, 3.2, 3.29],
    },
  },
  {
    name: "H200 NVL",
    arch: "Hopper",
    vram: "141GB VRAM",
    availability: "low",
    price: 2.95,
    low: 1.52,
    high: 8.0,
    trend: "orange",
    history: {
      "30D": [2.8, 3.0, 2.85, 3.05, 2.9, 3.0, 2.88, 2.95],
      "90D": [2.6, 2.75, 2.9, 2.8, 3.0, 2.85, 2.92, 2.95],
      "180D": [7.9, 5.2, 3.8, 2.4, 1.6, 2.2, 2.7, 2.95],
    },
  },
  {
    name: "H100 SXM",
    arch: "Hopper",
    vram: "80GB VRAM",
    availability: "medium",
    price: 2.0,
    low: 1.47,
    high: 13.33,
    trend: "orange",
    history: {
      "30D": [2.0, 2.02, 1.98, 2.01, 1.99, 2.0, 1.97, 2.0],
      "90D": [2.1, 2.05, 2.0, 1.95, 1.98, 2.0, 1.99, 2.0],
      "180D": [13.0, 8.0, 5.0, 3.2, 2.4, 1.6, 1.9, 2.0],
    },
  },
  {
    name: "H100 NVL",
    arch: "Hopper",
    vram: "94GB VRAM",
    availability: "low",
    price: 1.99,
    low: 1.33,
    high: 4.67,
    trend: "teal",
    history: {
      "30D": [4.6, 4.5, 2.1, 2.0, 1.99, 2.0, 1.98, 1.99],
      "90D": [4.6, 3.4, 2.6, 2.1, 2.0, 1.99, 1.98, 1.99],
      "180D": [4.6, 4.0, 3.2, 2.6, 2.0, 1.6, 1.4, 1.99],
    },
  },
  {
    name: "RTX PRO 6000 S",
    arch: "Blackwell",
    vram: "96GB VRAM",
    availability: "medium",
    price: 1.39,
    low: 0.82,
    high: 13.33,
    trend: "teal",
    history: {
      "30D": [1.0, 1.4, 1.9, 1.6, 2.0, 1.5, 1.4, 1.39],
      "90D": [0.9, 1.6, 2.1, 1.4, 1.8, 1.5, 1.42, 1.39],
      "180D": [13.0, 6.0, 3.0, 1.8, 2.1, 1.5, 1.3, 1.39],
    },
  },
];

const formatPrice = (value: number): string => `$${value.toFixed(2)}`;

/** Build an SVG polyline `points` string from a value series within the viewBox. */
function toPoints(series: readonly number[], width: number, height: number): string {
  if (series.length < 2) return "";
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const stepX = width / (series.length - 1);
  return series
    .map((value, index) => {
      const x = index * stepX;
      // Invert y so higher prices sit toward the top, with a little padding.
      const y = height - 4 - ((value - min) / span) * (height - 8);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function Sparkline({
  series,
  color,
}: {
  readonly series: readonly number[];
  readonly color: "orange" | "teal";
}): ReactElement {
  const width = 300;
  const height = 56;
  const stroke = color === "teal" ? "#10b981" : "#f0531c";
  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={toPoints(series, width, height)}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Live GPU Prices band: a vast.ai-style snapshot of flagship GPU rates. Black
 * cards each show availability, a price sparkline, the current rate, and the
 * observed price range. A time-range toggle swaps the sparkline window.
 */
export function LiveGpuPrices(): ReactElement {
  const [range, setRange] = useState<Range>("30D");

  return (
    <section className={styles.section} aria-label="Live GPU Prices">
      <div className={styles.inner}>
        <header className={styles.head}>
          <h2 className={styles.heading}>Live GPU Prices</h2>
          <p className={styles.sub}>
            Real-time pricing from across the Vast.ai platform. Click any card
            for detailed specs and history.
          </p>
        </header>

        <div className={styles.bar}>
          <div className={styles.legend}>
            <span className={styles.legendLabel}>Availability:</span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotHigh}`} />
              High (120+)
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotMed}`} />
              Medium (40–119)
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotLow}`} />
              Low (&lt;40)
            </span>
          </div>

          <div className={styles.toggle} role="group" aria-label="Price history range">
            {RANGES.map((value) => (
              <button
                key={value}
                type="button"
                className={`${styles.toggleBtn} ${
                  range === value ? styles.toggleBtnActive : ""
                }`}
                aria-pressed={range === value}
                onClick={() => setRange(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.groupRow}>
          <span className={styles.groupLabel}>Flagship</span>
          <span className={styles.groupCount}>{GPUS.length} GPUs</span>
        </div>

        <div className={styles.grid}>
          {GPUS.map((gpu) => (
            <article key={gpu.name} className={styles.card}>
              <div className={styles.cardHead}>
                <h3 className={styles.name}>{gpu.name}</h3>
                <div className={styles.avail}>
                  <span className={styles.bars} aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={`${styles.barSeg} ${
                          i < AVAILABILITY_BARS[gpu.availability]
                            ? styles.barSegOn
                            : ""
                        }`}
                      />
                    ))}
                  </span>
                  <span className={styles.availLabel}>
                    {AVAILABILITY_LABEL[gpu.availability]}
                  </span>
                </div>
              </div>

              <div className={styles.meta}>
                <span className={styles.arch}>{gpu.arch}</span>
                <span className={styles.vram}>{gpu.vram}</span>
              </div>

              <Sparkline series={gpu.history[range]} color={gpu.trend} />

              <div className={styles.priceRow}>
                <span className={styles.price}>{formatPrice(gpu.price)}</span>
                <span className={styles.per}>/hr</span>
              </div>

              <div className={styles.footer}>
                <span className={styles.range}>
                  {formatPrice(gpu.low)} — {formatPrice(gpu.high)}/hr range
                </span>
                <a
                  className={styles.rent}
                  href="https://cloud.vast.ai/"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Rent
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
