"use client";

import { useState, type ReactElement } from "react";
import type { SectionContent } from "@/content/sections";
import { CabinScene } from "@/components/CabinScene";
import styles from "./ProductScene.module.css";

export function ProductScene({
  section,
}: {
  section: SectionContent;
}): ReactElement {
  const modules = section.product?.modules ?? [];
  const specs = section.product?.specs ?? [];
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className={styles.scene}>
      <header className={styles.header}>
        <p className={styles.kicker}>{section.title}</p>
        <p className={styles.lede}>{section.lede}</p>
      </header>

      <div className={styles.explorer}>
        <div className={styles.sceneViewport}>
          <CabinScene />
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
                        <span className={styles.moduleNumber}>{mod.number}</span>
                        {mod.name}
                      </span>
                      <span className={styles.moduleCode}>{mod.code}</span>
                    </span>
                    {isActive && (
                      <p className={styles.moduleDescription}>{mod.description}</p>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      <div className={styles.specCards}>
        {specs.map((spec) => (
          <article key={spec.title} className={styles.specCard}>
            <h3 className={styles.specTitle}>{spec.title}</h3>
            <ul className={styles.specList}>
              {spec.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
