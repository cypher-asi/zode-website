"use client";

import { useState, type ReactElement } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GREEN_SERIES } from "@/lib/theme/chartPalette";
import styles from "./OpenSourceChart.module.css";

type View = "frontier" | "hugging-face";

/**
 * Best aggregate-benchmark score (%) of the leading closed-weight vs leading
 * open-weight model by year. Illustrative values that track the well-documented
 * convergence of open models on the closed frontier.
 */
const FRONTIER: ReadonlyArray<{
  year: number;
  closed: number;
  open: number;
}> = [
  { year: 2022, closed: 70, open: 45 },
  { year: 2023, closed: 80, open: 63 },
  { year: 2024, closed: 87, open: 80 },
  { year: 2025, closed: 91, open: 88 },
  { year: 2026, closed: 93, open: 92 },
];

/** Total models hosted on Hugging Face by year (the open-source long tail). */
const HUGGING_FACE: ReadonlyArray<{ year: number; models: number }> = [
  { year: 2021, models: 30_000 },
  { year: 2022, models: 90_000 },
  { year: 2023, models: 350_000 },
  { year: 2024, models: 1_000_000 },
  { year: 2025, models: 1_800_000 },
  { year: 2026, models: 2_600_000 },
];

const CLOSED_COLOR = GREEN_SERIES[4];
const OPEN_COLOR = GREEN_SERIES[0];
const LONG_TAIL_COLOR = GREEN_SERIES[0];

const VIEWS: readonly { id: View; label: string }[] = [
  { id: "frontier", label: "Frontier" },
  { id: "hugging-face", label: "Hugging Face" },
];

const axisTick = { fill: "var(--color-text-secondary)", fontSize: 12 };
const tooltipContentStyle = {
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 8,
  color: "var(--color-text-primary)",
} as const;
const tooltipLabelStyle = { color: "var(--color-text-secondary)" } as const;
const tooltipItemStyle = { color: "var(--color-text-primary)" } as const;

function formatModels(value: number): string {
  if (value >= 1e6) {
    return `${(value / 1e6).toLocaleString(undefined, {
      maximumFractionDigits: 1,
    })}M`;
  }
  return `${Math.round(value / 1e3)}K`;
}

export function OpenSourceChart(): ReactElement {
  const [view, setView] = useState<View>("frontier");
  const isFrontier = view === "frontier";

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        {isFrontier
          ? "Best open vs closed model, aggregate benchmark, 2022-2026"
          : "Open-source models hosted on Hugging Face, 2021-2026"}
      </figcaption>

      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          {isFrontier ? (
            <LineChart
              data={FRONTIER}
              margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="year"
                tick={axisTick}
                stroke="var(--color-border-strong)"
                tickLine={false}
                tickFormatter={(year) => `'${String(year).slice(-2)}`}
              />
              <YAxis
                width={52}
                domain={[40, 100]}
                tick={axisTick}
                stroke="var(--color-border-strong)"
                tickLine={false}
                tickFormatter={(value) => `${Math.round(value)}%`}
              />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                formatter={(value, name) => [`${value}%`, name]}
              />
              <Line
                type="monotone"
                dataKey="closed"
                name="Best closed model"
                stroke={CLOSED_COLOR}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive
              />
              <Line
                type="monotone"
                dataKey="open"
                name="Best open model"
                stroke={OPEN_COLOR}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive
              />
            </LineChart>
          ) : (
            <AreaChart
              data={HUGGING_FACE}
              margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
            >
              <defs>
                <linearGradient id="osLongTail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={LONG_TAIL_COLOR} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={LONG_TAIL_COLOR} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="year"
                tick={axisTick}
                stroke="var(--color-border-strong)"
                tickLine={false}
                tickFormatter={(year) => `'${String(year).slice(-2)}`}
              />
              <YAxis
                width={52}
                tick={axisTick}
                stroke="var(--color-border-strong)"
                tickLine={false}
                tickFormatter={formatModels}
              />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                formatter={(value) => [
                  `${Number(value).toLocaleString()} models`,
                  "Hosted models",
                ]}
              />
              <Area
                type="monotone"
                dataKey="models"
                name="Hosted models"
                stroke={LONG_TAIL_COLOR}
                strokeWidth={2}
                fill="url(#osLongTail)"
                isAnimationActive
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className={styles.footer}>
        <ul className={styles.legend} aria-label="Chart series">
          {isFrontier ? (
            <>
              <li className={styles.legendItem}>
                <span
                  className={styles.legendSwatch}
                  style={{ background: CLOSED_COLOR }}
                  aria-hidden="true"
                />
                Best closed model
              </li>
              <li className={styles.legendItem}>
                <span
                  className={styles.legendSwatch}
                  style={{ background: OPEN_COLOR }}
                  aria-hidden="true"
                />
                Best open model
              </li>
            </>
          ) : (
            <li className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{ background: LONG_TAIL_COLOR }}
                aria-hidden="true"
              />
              Hosted models
            </li>
          )}
        </ul>

        <div className={styles.toggle} role="group" aria-label="Chart view">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={styles.toggleButton}
              data-active={v.id === view ? "true" : "false"}
              aria-pressed={v.id === view}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </figure>
  );
}
