"use client";

import type { ReactElement } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  BuildOutRow,
  FinancialsTable,
  SectionContent,
} from "@/content/sections";
import styles from "./FinancialsPanel.module.css";

const REVENUE_ACCENT = "#48c79a";

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const compactCurrency = new Intl.NumberFormat("en-US", {
  notation: "compact",
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
});

const axisCurrency = new Intl.NumberFormat("en-US", {
  notation: "compact",
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCell(value: number, format: BuildOutRow["format"]): string {
  switch (format) {
    case "decimal":
      return value.toFixed(2);
    case "compact":
      return compactNumber.format(value);
    case "currency":
      return compactCurrency.format(value);
    default:
      return value.toLocaleString("en-US");
  }
}

function formatAxis(value: number): string {
  return axisCurrency.format(value);
}

function formatFull(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function Table({ table }: { table: FinancialsTable }): ReactElement {
  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>{table.title}</p>
      <dl className={styles.rows}>
        {table.rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className={styles.row}
            data-emphasis={row.emphasis ? "true" : undefined}
            data-indent={row.indent ? "true" : undefined}
            data-muted={row.muted ? "true" : undefined}
          >
            <dt className={styles.rowLabel}>{row.label}</dt>
            {row.value != null && (
              <dd className={styles.rowValue}>{row.value}</dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}

export function FinancialsPanel({
  section,
}: {
  section: SectionContent;
}): ReactElement | null {
  const data = section.financials;
  if (!data) return null;

  const { unitEconomics, capitalStructure, buildOut, revenueSeries } = data;

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <p className={styles.kicker}>{section.label}</p>
        <h2 className={styles.title}>{section.title}</h2>
      </header>

      <div className={styles.grid}>
        <div className={styles.col}>
          <Table table={unitEconomics} />
          <Table table={capitalStructure} />
        </div>

        <div className={styles.col}>
          <div className={styles.card}>
            <p className={styles.cardTitle}>{buildOut.title}</p>
            <div className={styles.buildOutWrap}>
              <table className={styles.buildOut}>
                <thead>
                  <tr>
                    <th scope="col" aria-label="Metric" />
                    {buildOut.columns.map((column) => (
                      <th
                        key={column.year}
                        scope="colgroup"
                        colSpan={column.halves.length}
                        className={styles.yearHead}
                      >
                        {column.year}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th scope="col" aria-label="Metric" />
                    {buildOut.columns.flatMap((column) =>
                      column.halves.map((half) => (
                        <th
                          key={`${column.year}-${half}`}
                          scope="col"
                          className={styles.halfHead}
                        >
                          {half}
                        </th>
                      )),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {buildOut.rows.map((row) => (
                    <tr
                      key={row.label}
                      data-emphasis={row.emphasis ? "true" : undefined}
                    >
                      <th scope="row" className={styles.buildOutLabel}>
                        {row.label}
                      </th>
                      {row.cells.map((cell, index) => (
                        <td key={index} className={styles.buildOutCell}>
                          {formatCell(cell, row.format)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitle}>3 Year Build Out — Revenue</p>
            <div className={styles.chart}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={revenueSeries as { period: string; revenue: number }[]}
                  margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="period"
                    tick={{
                      fill: "var(--color-text-secondary)",
                      fontSize: 11,
                    }}
                    stroke="var(--color-border-strong)"
                    tickLine={false}
                  />
                  <YAxis
                    width={52}
                    tick={{
                      fill: "var(--color-text-secondary)",
                      fontSize: 11,
                    }}
                    stroke="var(--color-border-strong)"
                    tickLine={false}
                    tickFormatter={formatAxis}
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
                    formatter={(value) => [formatFull(Number(value)), "Revenue"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke={REVENUE_ACCENT}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: REVENUE_ACCENT, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
