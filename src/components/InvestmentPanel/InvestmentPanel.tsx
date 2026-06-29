"use client";

import type { ReactElement } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { SectionContent } from "@/content/sections";
import { ListCard, CardBulletList } from "@/components/Card";
import { SlideLayout } from "@/components/SlideLayout";
import { Deferred } from "@/components/Deferred";
import { TAN_SERIES } from "@/lib/theme/chartPalette";
import styles from "./InvestmentPanel.module.css";

/**
 * Slice colors for the Use of Proceeds pie. Ordered for maximum contrast
 * between adjacent slices while staying within the shared tan palette.
 */
const SLICE_COLORS = [
  TAN_SERIES[0],
  TAN_SERIES[4],
  TAN_SERIES[1],
  TAN_SERIES[2],
  TAN_SERIES[3],
  TAN_SERIES[5],
] as const;

interface LegendEntry {
  readonly value?: string | number;
  readonly color?: string;
}

/**
 * Custom legend that lays the slices out in a fixed grid so the labels stay
 * balanced across two rows instead of wrapping unevenly by available width.
 */
function ProceedsLegend({
  payload,
}: {
  payload?: readonly LegendEntry[];
}): ReactElement {
  return (
    <ul className={styles.legend}>
      {payload?.map((entry) => (
        <li key={String(entry.value)} className={styles.legendItem}>
          <span
            className={styles.legendSwatch}
            style={{ background: entry.color }}
          />
          <span>{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function InvestmentPanel({
  section,
}: {
  section: SectionContent;
}): ReactElement | null {
  const data = section.investment;
  if (!data) return null;

  const { bulletGroups, useOfProceeds, whyInvestNow } = data;
  const total = useOfProceeds.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <SlideLayout
      id={section.id}
      ariaLabel={section.label}
      className={styles.slide}
      top={
        <header className={styles.header}>
          <p className={styles.kicker}>{section.label}</p>
          <h2 className={styles.title}>{section.title}</h2>
        </header>
      }
      middle={
        <div className={styles.grid}>
        <div className={styles.left}>
          {bulletGroups.map((group) => (
            <ListCard key={group.title} title={group.title}>
              <CardBulletList items={group.bullets} />
            </ListCard>
          ))}
        </div>

        <div className={styles.right}>
          <ListCard title="Use of Proceeds">
            <Deferred className={styles.chart}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={useOfProceeds as unknown as Record<string, number>[]}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius="45%"
                    outerRadius="78%"
                    paddingAngle={2}
                    stroke="var(--color-bg-elevated)"
                    strokeWidth={2}
                    isAnimationActive
                  >
                    {useOfProceeds.map((slice, index) => (
                      <Cell
                        key={slice.label}
                        fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-bg-elevated)",
                      border: "1px solid var(--color-border-strong)",
                      borderRadius: 8,
                      color: "var(--color-text-primary)",
                    }}
                    labelStyle={{ color: "var(--color-text-secondary)" }}
                    formatter={(value, name) => [
                      `${Math.round((Number(value) / total) * 100)}%`,
                      name,
                    ]}
                  />
                  <Legend
                    content={<ProceedsLegend />}
                    wrapperStyle={{
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Deferred>
          </ListCard>

          <ListCard title={whyInvestNow.title}>
            <CardBulletList items={whyInvestNow.bullets} />
          </ListCard>
        </div>
        </div>
      }
    />
  );
}
