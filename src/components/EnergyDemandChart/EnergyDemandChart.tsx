"use client";

import { useMemo, useState, type ReactElement } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./EnergyDemandChart.module.css";

/** Base-case data-center electricity demand, in TWh per year. */
const DEMAND_TWH: ReadonlyArray<{ year: number; twh: number }> = [
  { year: 2024, twh: 415 },
  { year: 2025, twh: 476 },
  { year: 2026, twh: 546 },
  { year: 2027, twh: 626 },
  { year: 2028, twh: 718 },
  { year: 2029, twh: 824 },
  { year: 2030, twh: 945 },
  { year: 2031, twh: 991 },
  { year: 2032, twh: 1040 },
  { year: 2033, twh: 1091 },
  { year: 2034, twh: 1144 },
  { year: 2035, twh: 1200 },
];

/**
 * Conversion assumptions used to reframe TWh into more relatable units.
 * - Homes: an average US home uses ~10,500 kWh/yr, so 1 TWh (1e9 kWh)
 *   powers ~95,238 homes.
 * - Dollars: at ~$0.13/kWh, 1 TWh is worth ~$130M.
 */
const HOMES_PER_TWH = 1e9 / 10_500;
const USD_PER_TWH = 1e9 * 0.13;

type Unit = "twh" | "homes" | "usd";

interface UnitConfig {
  readonly id: Unit;
  readonly label: string;
  readonly seriesName: string;
  readonly accent: string;
  /** Convert a TWh value into this unit's display value. */
  readonly toValue: (twh: number) => number;
  /** Format an axis tick (compact). */
  readonly formatAxis: (value: number) => string;
  /** Format a tooltip value (richer). */
  readonly formatTooltip: (value: number) => string;
}

const UNITS: readonly UnitConfig[] = [
  {
    id: "twh",
    label: "TWh",
    seriesName: "Electricity demand (TWh/yr)",
    accent: "#01d892",
    toValue: (twh) => twh,
    formatAxis: (value) => `${Math.round(value)}`,
    formatTooltip: (value) => `${value.toLocaleString()} TWh`,
  },
  {
    id: "homes",
    label: "Homes",
    seriesName: "Homes powered (proxy)",
    accent: "#5b9dff",
    toValue: (twh) => twh * HOMES_PER_TWH,
    formatAxis: (value) => `${(value / 1e6).toFixed(0)}M`,
    formatTooltip: (value) =>
      `${(value / 1e6).toLocaleString(undefined, {
        maximumFractionDigits: 1,
      })}M homes`,
  },
  {
    id: "usd",
    label: "$",
    seriesName: "Approx. energy value (USD/yr)",
    accent: "#e0a93b",
    toValue: (twh) => twh * USD_PER_TWH,
    formatAxis: (value) => `$${(value / 1e9).toFixed(0)}B`,
    formatTooltip: (value) =>
      `$${(value / 1e9).toLocaleString(undefined, {
        maximumFractionDigits: 1,
      })}B`,
  },
];

export function EnergyDemandChart(): ReactElement {
  const [unit, setUnit] = useState<Unit>("twh");
  const [hidden, setHidden] = useState<boolean>(false);

  const config = UNITS.find((u) => u.id === unit) ?? UNITS[0];

  const data = useMemo(
    () =>
      DEMAND_TWH.map(({ year, twh }) => ({
        year,
        value: config.toValue(twh),
      })),
    [config],
  );

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        Global data-center electricity demand, 2024-2035
      </figcaption>

      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              vertical={false}
            />
            <XAxis
              dataKey="year"
              tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
              stroke="var(--color-border-strong)"
              tickLine={false}
            />
            <YAxis
              width={52}
              tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
              stroke="var(--color-border-strong)"
              tickLine={false}
              tickFormatter={config.formatAxis}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-border-strong)" }}
              contentStyle={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 8,
                color: "var(--color-text-primary)",
              }}
              labelStyle={{ color: "var(--color-text-secondary)" }}
              formatter={(value) => [
                config.formatTooltip(Number(value)),
                config.seriesName,
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={config.seriesName}
              stroke={config.accent}
              strokeWidth={2.5}
              dot={{ r: 3, fill: config.accent, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              hide={hidden}
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.footer}>
        <ul className={styles.legend} aria-label="Chart series (click to toggle)">
          <li>
            <button
              type="button"
              className={styles.legendItem}
              data-hidden={hidden ? "true" : "false"}
              aria-pressed={!hidden}
              onClick={() => setHidden((prev) => !prev)}
            >
              <span
                className={styles.legendSwatch}
                style={{ background: config.accent }}
                aria-hidden="true"
              />
              {config.seriesName}
            </button>
          </li>
        </ul>

        <div className={styles.toggle} role="group" aria-label="Display unit">
          {UNITS.map((u) => (
            <button
              key={u.id}
              type="button"
              className={styles.toggleButton}
              data-active={u.id === unit ? "true" : "false"}
              aria-pressed={u.id === unit}
              onClick={() => setUnit(u.id)}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>
    </figure>
  );
}
