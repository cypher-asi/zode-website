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
import type {
  InvestmentBulletGroup,
  SectionContent,
} from "@/content/sections";
import styles from "./InvestmentPanel.module.css";

/** Slice colors for the Use of Proceeds pie, reusing the deck accent palette. */
const SLICE_COLORS = [
  "#48c79a",
  "#5b9dff",
  "#e0a93b",
  "#d4658f",
  "#7b6ff0",
  "#5fb0c9",
] as const;

function BulletGroup({ group }: { group: InvestmentBulletGroup }): ReactElement {
  return (
    <div className={styles.group}>
      <p className={styles.groupTitle}>{group.title}</p>
      <ul className={styles.bullets}>
        {group.bullets.map((bullet) => {
          if (typeof bullet === "string") {
            return <li key={bullet}>{bullet}</li>;
          }
          return (
            <li key={bullet.text}>
              {bullet.text}
              <ul className={styles.subBullets}>
                {bullet.subBullets.map((sub) => (
                  <li key={sub}>{sub}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
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
    <div className={styles.panel}>
      <header className={styles.header}>
        <p className={styles.kicker}>{section.label}</p>
        <h2 className={styles.title}>{section.title}</h2>
      </header>

      <div className={styles.grid}>
        <div className={styles.left}>
          {bulletGroups.map((group) => (
            <BulletGroup key={group.title} group={group} />
          ))}
        </div>

        <div className={styles.right}>
          <div className={styles.card}>
            <p className={styles.cardTitle}>Use of Proceeds</p>
            <div className={styles.chart}>
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
                    wrapperStyle={{
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.card}>
            <BulletGroup group={whyInvestNow} />
          </div>
        </div>
      </div>
    </div>
  );
}
