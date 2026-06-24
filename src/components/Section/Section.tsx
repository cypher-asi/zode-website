import type { ReactElement } from "react";
import Image from "next/image";
import type { SectionContent } from "@/content/sections";
import { EnergyDemandChart } from "@/components/EnergyDemandChart";
import { CabinScene } from "@/components/CabinScene";
import { EcosystemScene } from "@/components/EcosystemScene";
import { MarketScene } from "@/components/MarketScene";
import { ProductScene } from "@/components/ProductScene";
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
          <ol className={styles.numberedBody}>
            {section.body.map((paragraph, index) => (
              <li key={index}>
                {paragraph}
                {index === 0 &&
                  section.citations &&
                  section.citations.length > 0 && (
                    <sup className={styles.refMarker}>a</sup>
                  )}
              </li>
            ))}
          </ol>
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
        <p className={styles.deployKicker}>{section.label}</p>
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

  if (section.scene === "ecosystem-network") {
    return (
      <section
        id={section.id}
        className={styles.feature}
        aria-label={section.label}
      >
        <EcosystemScene section={section} />
      </section>
    );
  }

  if (section.market) {
    return (
      <section
        id={section.id}
        className={styles.feature}
        aria-label={section.label}
      >
        <MarketScene section={section} />
      </section>
    );
  }

  if (section.product) {
    return (
      <section
        id={section.id}
        className={styles.feature}
        aria-label={section.label}
      >
        <ProductScene section={section} />
      </section>
    );
  }

  if (section.model === "a-frame-cabin") {
    return (
      <section
        id={section.id}
        className={styles.feature}
        aria-label={section.label}
      >
        <div className={styles.sceneMedia}>
          <CabinScene />
        </div>
        <div className={styles.sceneBand}>
          <h2 className={styles.featureTitle}>{section.title}</h2>
          <p className={styles.featureLede}>{section.lede}</p>
          <Citations items={section.citations} />
        </div>
      </section>
    );
  }

  if (section.site) {
    const { background, facts, progress } = section.site;
    const SEGMENTS = 36;
    const filled = Math.round(
      (Math.min(progress.completed, progress.stages.length) /
        progress.stages.length) *
        SEGMENTS,
    );
    // Deployment markers, positioned as percentages within the terrain band so
    // they track the artwork rather than the full panel.
    const markers = [
      { left: "31%", top: "34%" },
      { left: "39%", top: "22%" },
      { left: "27%", top: "52%" },
    ];
    return (
      <section
        id={section.id}
        className={styles.site}
        aria-label={section.label}
      >
        <div className={styles.siteMedia}>
          <Image
            src={background.src}
            alt={background.alt}
            fill
            sizes="100vw"
            priority
            unoptimized
            className={styles.siteBg}
          />
          {markers.map((m, i) => (
            <span
              key={i}
              className={styles.siteMarker}
              style={{ left: m.left, top: m.top }}
            />
          ))}
        </div>
        <header className={styles.siteHeader}>
          <p className={styles.kicker}>{section.label}</p>
          <h2 className={styles.siteTitle}>{section.title}</h2>
        </header>
        <div className={styles.siteFacts}>
          <p className={styles.siteFactsLabel}>Key Facts</p>
          <dl className={styles.siteFactsList}>
            {facts.map((fact) => (
              <div key={fact.label} className={styles.siteFactRow}>
                <dt className={styles.siteFactKey}>{fact.label}</dt>
                <dd className={styles.siteFactValue}>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className={styles.siteProgress}>
          <p className={styles.siteProgressLabel}>Progress</p>
          <div
            className={styles.siteProgressBar}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.stages.length}
            aria-valuenow={progress.completed}
          >
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <span
                key={i}
                className={`${styles.siteSegment} ${
                  i < filled ? styles.siteSegmentOn : ""
                }`}
              />
            ))}
          </div>
          <div className={styles.siteStages}>
            {progress.stages.map((stage) => (
              <span key={stage} className={styles.siteStage}>
                {stage}
              </span>
            ))}
          </div>
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
