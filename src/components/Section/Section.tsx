import type { ReactElement } from "react";
import Image from "next/image";
import type { SectionContent } from "@/content/sections";
import { EnergyDemandChart } from "@/components/EnergyDemandChart";
import { Citations } from "@/components/Citations";
import styles from "./Section.module.css";

export function Section({ section }: { section: SectionContent }): ReactElement {
  if (section.chart === "energy-demand") {
    return (
      <section
        id={section.id}
        className={styles.split}
        aria-label={section.label}
      >
        <div className={styles.splitText}>
          <p className={styles.kicker}>{section.label}</p>
          <h2 className={styles.title}>{section.title}</h2>
          <div className={styles.body}>
            {section.body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          {section.footnote && (
            <p className={styles.footnote}>{section.footnote}</p>
          )}
          <Citations items={section.citations} />
        </div>
        <div className={styles.splitChart}>
          <EnergyDemandChart />
        </div>
      </section>
    );
  }

  if (section.cards) {
    return (
      <section
        id={section.id}
        className={styles.deploy}
        aria-label={section.label}
      >
        <h2 className={styles.deployHeader}>{section.title}</h2>
        <div className={styles.deployStage}>
          {section.media && (
            <Image
              src={section.media.src}
              alt={section.media.alt}
              fill
              sizes="100vw"
              priority
              unoptimized
              className={styles.deployImage}
            />
          )}
        </div>
        <div className={styles.deployCards}>
          {section.cards.map((card) => (
            <div key={card.label} className={styles.card}>
              <p className={styles.cardLabel}>{card.label}</p>
              <p className={styles.cardStat}>{card.stat}</p>
              <p className={styles.cardDescription}>{card.description}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (section.media) {
    return (
      <section
        id={section.id}
        className={styles.feature}
        aria-label={section.label}
      >
        <div className={styles.media}>
          <Image
            src={section.media.src}
            alt={section.media.alt}
            fill
            sizes="100vw"
            priority
            unoptimized
            className={styles.mediaImage}
          />
        </div>
        <div className={styles.band}>
          <h2 className={styles.featureTitle}>{section.title}</h2>
          <p className={styles.featureLede}>{section.lede}</p>
          <Citations items={section.citations} />
        </div>
      </section>
    );
  }

  return (
    <section id={section.id} className={styles.section} aria-label={section.label}>
      <div className={styles.inner}>
        <p className={styles.kicker}>{section.label}</p>
        <h2 className={styles.title}>{section.title}</h2>
        <p className={styles.lede}>{section.lede}</p>
        <div className={styles.body}>
          {section.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <Citations items={section.citations} />
      </div>
    </section>
  );
}
