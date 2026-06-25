"use client";

import { useState, type ReactElement } from "react";
import type { MarketTier, SectionContent } from "@/content/sections";
import { Citations } from "@/components/Citations";
import { FeatureCard } from "@/components/Card";
import { SlideLayout } from "@/components/SlideLayout";
import styles from "./MarketScene.module.css";

const FALLBACK_TIERS: readonly MarketTier[] = [
  {
    acronym: "TAM",
    name: "Total Addressable Market",
    headline: "Total market",
    description: "The full market opportunity.",
    weight: 1,
  },
  {
    acronym: "SAM",
    name: "Serviceable Addressable Market",
    headline: "Reachable market",
    description: "The slice we can serve.",
    weight: 0.62,
  },
  {
    acronym: "SOM",
    name: "Serviceable Obtainable Market",
    headline: "Beachhead",
    description: "What we can win early.",
    weight: 0.32,
  },
];

export function MarketScene({
  section,
}: {
  section: SectionContent;
}): ReactElement {
  const tiers =
    section.market && section.market.length > 0
      ? section.market
      : FALLBACK_TIERS;

  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <SlideLayout
      id={section.id}
      ariaLabel={section.label}
      className={styles.slide}
      top={
        <header className={styles.header}>
          <p className={styles.kicker}>{section.label}</p>
          <h2 className={styles.title}>{section.title}</h2>
          {section.lede && <p className={styles.lede}>{section.lede}</p>}
        </header>
      }
      middle={
        <div className={styles.rings} aria-hidden="true">
          {tiers.map((tier, index) => (
            <div
              key={tier.acronym}
              className={styles.ring}
              data-tier={index}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() =>
                setHovered((prev) => (prev === index ? null : prev))
              }
            >
              <span className={styles.ringLabel}>{tier.acronym}</span>
            </div>
          ))}
        </div>
      }
      bottom={
        <div className={styles.bottomBand}>
          <p className={styles.horizon}>by 2030</p>

          <ol className={styles.cards}>
            {tiers.map((tier, index) => (
              <li key={tier.acronym} data-tier={index}>
                <FeatureCard
                  align="center"
                  label={tier.name}
                  value={tier.headline}
                  description={tier.description}
                  highlight={hovered === index}
                />
              </li>
            ))}
          </ol>

          <Citations items={section.citations} />
        </div>
      }
    />
  );
}
