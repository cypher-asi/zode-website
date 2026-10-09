"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type ReactElement } from "react";
import { useInView } from "@/lib/useInView";
import { LAYERS, type LayerId } from "./layers";
import { StackArt, VIEW, labelY } from "./StackArt";
import styles from "./FullStack.module.css";

/**
 * "Full stack" section: an exploded line drawing of the six layers with
 * labels alternating either side. The plates spread apart once the figure
 * scrolls into view, and hovering a plate or its label highlights the pair.
 */
export function FullStack(): ReactElement {
  const figureRef = useRef<HTMLDivElement>(null);
  const exploded = useInView(figureRef, "0px 0px -25% 0px");
  const [active, setActive] = useState<LayerId | null>(null);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.intro}>
          <p className={styles.pill}>Full stack</p>
          <h2 className={styles.title}>The full stack, from land to network.</h2>
          <p className={styles.helper}>
            Every layer a sovereign AI deployment needs, built and operated as one system.
          </p>
        </div>
        <Link className={styles.cta} href="/buy-compute">
          Deploy Compute
          <svg
            className={styles.ctaArrow}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 8h10M8.5 3.5 13 8l-4.5 4.5" />
          </svg>
        </Link>
      </header>

      <div
        ref={figureRef}
        className={styles.figure}
        data-exploded={exploded || undefined}
        data-active={active ?? undefined}
      >
        <StackArt active={active} onActive={setActive} />

        <ol className={styles.labels}>
          {LAYERS.map((layer, i) => (
            <li
              key={layer.id}
              className={styles.label}
              data-side={layer.side}
              data-on={active === layer.id || undefined}
              style={
                {
                  "--y": `${(((labelY(i) - VIEW.y) / VIEW.h) * 100).toFixed(2)}%`,
                  "--i": i,
                } as CSSProperties
              }
              onPointerEnter={() => setActive(layer.id)}
              onPointerLeave={() => setActive(null)}
            >
              <span className={styles.labelTitle}>{layer.title}</span> - {layer.body}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
