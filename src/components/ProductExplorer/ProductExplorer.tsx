"use client";

import { useState, type ReactElement } from "react";
import { CabinScene } from "@/components/CabinScene";
import { SECTIONS } from "@/content/sections";
import styles from "./ProductExplorer.module.css";

const PRODUCT = SECTIONS.find((section) => section.id === "product");
const MODULES = PRODUCT?.product?.modules ?? [];
const KICKER = PRODUCT?.label ?? "Product";
const TITLE = PRODUCT?.title ?? "A rapidly deployable micro-data center.";

/**
 * Product-page take on the investor "Product" slide: a centered header above
 * an interactive cabin explorer. Selecting a module lights its zone in the 3D
 * scene. Sized to its content for the normal-scroll page (no spec cards).
 */
export function ProductExplorer(): ReactElement {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeZone = MODULES[activeIndex]?.zone ?? null;

  return (
    <section className={styles.section} aria-label={KICKER}>
      <header className={styles.header}>
        <p className={styles.kicker}>{KICKER}</p>
        <h2 className={styles.title}>{TITLE}</h2>
      </header>

      <div className={styles.explorer}>
        <div className={styles.sceneViewport}>
          <CabinScene
            matchPageBackground
            interactive={false}
            isometric
            twin
            highlight={activeZone}
          />
        </div>
        <nav className={styles.moduleNav} aria-label="ZODE modules">
          <ol className={styles.moduleList}>
            {MODULES.map((mod, index) => {
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
    </section>
  );
}
