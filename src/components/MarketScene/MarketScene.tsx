import type { CSSProperties, ReactElement } from "react";
import type { MarketTier, SectionContent } from "@/content/sections";
import { Citations } from "@/components/Citations";
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

  // Largest tier defines the full-size triangle; the rest scale relative to it.
  const maxWeight = Math.max(...tiers.map((t) => t.weight ?? 1));

  return (
    <div className={styles.scene}>
      <header className={styles.header}>
        <p className={styles.kicker}>{section.label}</p>
        <h2 className={styles.title}>{section.title}</h2>
        {section.lede && <p className={styles.lede}>{section.lede}</p>}
      </header>

      <div className={styles.pyramid} aria-hidden="true">
        {tiers.map((tier, index) => {
          const w = (tier.weight ?? 1 - index * 0.34) / maxWeight;
          return (
            <div
              key={tier.acronym}
              className={styles.triangle}
              data-tier={index}
              style={{ "--w": w, zIndex: index + 1 } as CSSProperties}
            />
          );
        })}
        {tiers.map((tier, index) => {
          const w = (tier.weight ?? 1 - index * 0.34) / maxWeight;
          return (
            <span
              key={tier.acronym}
              className={styles.acronym}
              data-tier={index}
              style={{ "--w": w } as CSSProperties}
            >
              {tier.acronym}
            </span>
          );
        })}
      </div>

      <ol className={styles.cards}>
        {tiers.map((tier, index) => (
          <li
            key={tier.acronym}
            className={styles.card}
            data-tier={index}
            style={{ "--tier-index": index } as CSSProperties}
          >
            <p className={styles.cardName}>
              <span className={styles.cardAcronym}>{tier.acronym}</span>
              {tier.name}
            </p>
            <p className={styles.cardHeadline}>{tier.headline}</p>
            {tier.meta && <p className={styles.cardMeta}>{tier.meta}</p>}
            <p className={styles.cardDescription}>{tier.description}</p>
          </li>
        ))}
      </ol>

      <Citations items={section.citations} />
    </div>
  );
}
