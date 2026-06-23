import type { ReactElement } from "react";
import Image from "next/image";
import type { SectionContent } from "@/content/sections";
import { EnergyDemandChart } from "@/components/EnergyDemandChart";
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
        </div>
        <div className={styles.splitChart}>
          <EnergyDemandChart />
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
      </div>
    </section>
  );
}
