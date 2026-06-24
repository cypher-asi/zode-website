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
  },
  {
    acronym: "SAM",
    name: "Serviceable Addressable Market",
    headline: "Reachable market",
    description: "The slice we can serve.",
  },
  {
    acronym: "SOM",
    name: "Serviceable Obtainable Market",
    headline: "Beachhead",
    description: "What we can win early.",
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

  return (
    <div className={styles.scene}>
      <header className={styles.header}>
        <p className={styles.kicker}>{section.label}</p>
        <h2 className={styles.title}>{section.title}</h2>
        {section.lede && <p className={styles.lede}>{section.lede}</p>}
      </header>

      <ol className={styles.tiers}>
        {tiers.map((tier, index) => (
          <li
            key={tier.acronym}
            className={styles.tier}
            data-tier={index}
            style={{ "--tier-index": index } as CSSProperties}
          >
            <div className={styles.card}>
              <p className={styles.cardName}>{tier.name}</p>
              <p className={styles.cardHeadline}>{tier.headline}</p>
              {tier.meta && <p className={styles.cardMeta}>{tier.meta}</p>}
              <p className={styles.cardDescription}>{tier.description}</p>
            </div>
            <div className={styles.triangle} aria-hidden="true">
              <span className={styles.acronym}>{tier.acronym}</span>
            </div>
          </li>
        ))}
      </ol>

      <Citations items={section.citations} />
    </div>
  );
}
