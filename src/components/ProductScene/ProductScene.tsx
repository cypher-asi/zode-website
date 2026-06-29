"use client";

import { useState, type ReactElement } from "react";
import type { SectionContent } from "@/content/sections";
import { LazyCabinScene } from "@/components/CabinScene";
import { ListCard, CardBulletList } from "@/components/Card";
import { SlideLayout } from "@/components/SlideLayout";
import styles from "./ProductScene.module.css";

export function ProductScene({
  section,
}: {
  section: SectionContent;
}): ReactElement {
  const modules = section.product?.modules ?? [];
  const specs = section.product?.specs ?? [];
  const [activeIndex, setActiveIndex] = useState(0);
  const activeZone = modules[activeIndex]?.zone ?? null;

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
        <div className={styles.explorer}>
          <div className={styles.sceneViewport}>
            <LazyCabinScene
            matchPageBackground
            interactive={false}
            isometric
            twin
            highlight={activeZone}
          />
          </div>
          <nav className={styles.moduleNav} aria-label="ZODE modules">
            <ol className={styles.moduleList}>
              {modules.map((mod, index) => {
                const isActive = index === activeIndex;
                return (
                  <li key={mod.code} className={styles.moduleItem}>
                    <button
                      type="button"
                      className={styles.moduleButton}
                      data-active={isActive || undefined}
                      aria-expanded={isActive}
                      onClick={() => setActiveIndex(index)}
                    >
                      <span className={styles.moduleRow}>
                        <span className={styles.moduleName}>
                          <span className={styles.moduleNumber}>
                            {mod.number}
                          </span>
                          {mod.name}
                        </span>
                        <span className={styles.moduleCode}>{mod.code}</span>
                      </span>
                      {isActive && (
                        <p className={styles.moduleDescription}>
                          {mod.description}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      }
      bottom={
        <div className={styles.specCards}>
          {specs.map((spec) => (
            <ListCard key={spec.title} title={spec.title}>
              <CardBulletList items={spec.bullets} />
            </ListCard>
          ))}
        </div>
      }
    />
  );
}
