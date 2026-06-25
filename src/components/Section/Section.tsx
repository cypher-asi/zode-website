import type { ReactElement } from "react";
import Image from "next/image";
import type { SectionContent } from "@/content/sections";
import { EnergyDemandChart } from "@/components/EnergyDemandChart";
import { CabinScene } from "@/components/CabinScene";
import { EcosystemScene } from "@/components/EcosystemScene";
import { MarketScene } from "@/components/MarketScene";
import { ProductScene } from "@/components/ProductScene";
import { FinancialsPanel } from "@/components/FinancialsPanel";
import { InvestmentPanel } from "@/components/InvestmentPanel";
import { TeamPanel } from "@/components/TeamPanel";
import { ContactPanel } from "@/components/ContactPanel";
import { Citations } from "@/components/Citations";
import { FeatureCard, ListCard, CardBulletList } from "@/components/Card";
import { SlideLayout } from "@/components/SlideLayout";
import styles from "./Section.module.css";

export function Section({ section }: { section: SectionContent }): ReactElement {
  if (section.chart === "energy-demand") {
    return (
      <SlideLayout
        id={section.id}
        ariaLabel={section.label}
        middleClassName={styles.splitGrid}
        middle={
          <>
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
          </>
        }
      />
    );
  }

  if (section.cards) {
    return (
      <SlideLayout
        id={section.id}
        ariaLabel={section.label}
        top={
          <div className={styles.deployHeaderBand}>
            <p className={styles.deployKicker}>{section.label}</p>
            <h2 className={styles.deployHeader}>{section.title}</h2>
          </div>
        }
        middle={
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
        }
        bottom={
          <div className={styles.deployCards}>
            {section.cards.map((card) => (
              <FeatureCard
                key={card.label}
                label={card.label}
                value={card.stat}
                description={card.description}
              />
            ))}
          </div>
        }
      />
    );
  }

  if (section.scene === "ecosystem-network") {
    return <EcosystemScene section={section} />;
  }

  if (section.market) {
    return <MarketScene section={section} />;
  }

  if (section.product) {
    return <ProductScene section={section} />;
  }

  if (section.model === "a-frame-cabin") {
    return (
      <SlideLayout
        id={section.id}
        ariaLabel={section.label}
        middle={
          <div className={styles.featureBlock}>
            <div className={styles.sceneMedia}>
              <CabinScene matchPageBackground />
            </div>
            <div className={styles.band}>
              <h2 className={styles.featureTitle}>{section.title}</h2>
              <p className={styles.featureLede}>{section.lede}</p>
              <Citations items={section.citations} />
            </div>
          </div>
        }
      />
    );
  }

  if (section.financials) {
    return <FinancialsPanel section={section} />;
  }

  if (section.investment) {
    return <InvestmentPanel section={section} />;
  }

  if (section.team) {
    return <TeamPanel section={section} />;
  }

  if (section.contact) {
    return <ContactPanel section={section} />;
  }

  if (section.site) {
    const { background, cards } = section.site;
    // Deployment markers, positioned as percentages within the framed
    // container so they track the artwork rather than the full panel.
    const markers = [
      { left: "31%", top: "34%" },
      { left: "39%", top: "22%" },
      { left: "27%", top: "52%" },
      { left: "20%", top: "62%" },
      { left: "33%", top: "68%" },
      { left: "43%", top: "60%" },
    ];
    return (
      <SlideLayout
        id={section.id}
        ariaLabel={section.label}
        top={
          <div className={styles.siteHeaderBand}>
            <header className={styles.siteHeader}>
              <p className={styles.kicker}>{section.label}</p>
              <h2 className={styles.siteTitle}>{section.title}</h2>
            </header>
          </div>
        }
        middle={
          <div className={styles.siteFrame}>
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
        }
        bottom={
          <div className={styles.siteCards}>
            {cards.map((card) => (
              <ListCard key={card.title} title={card.title}>
                <CardBulletList items={card.bullets} />
              </ListCard>
            ))}
          </div>
        }
      />
    );
  }

  if (section.media) {
    return (
      <SlideLayout
        id={section.id}
        ariaLabel={section.label}
        middle={
          <div className={styles.featureBlock}>
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
          </div>
        }
      />
    );
  }

  return (
    <SlideLayout
      id={section.id}
      ariaLabel={section.label}
      middle={
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
      }
    />
  );
}
