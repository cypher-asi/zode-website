"use client";

import { useEffect, useRef, type CSSProperties, type ReactElement } from "react";
import { useInView } from "@/hooks/useInView";
import { PrincipleArt } from "./PrincipleArt";
import { PRINCIPLES } from "./principles";
import styles from "./Principles.module.css";

/**
 * Four numbered principle cards in a row, each a line drawing over its title.
 * Hovering or focusing a card plays its drawing and slides its description up
 * under the title. Touch screens show every description, and play a drawing
 * while its card sits in the middle of the viewport.
 */
export function Principles(): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useInView(ref, "0px 0px -20% 0px");

  useEffect(() => {
    const grid = ref.current;
    if (!grid || !window.matchMedia("(hover: none)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entry.target.toggleAttribute("data-playing", entry.isIntersecting);
      },
      { rootMargin: "-35% 0px -35% 0px" },
    );
    for (const card of grid.children) observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.root}>
      <div ref={ref} className={styles.grid} data-shown={shown || undefined} data-top-fade>
        {PRINCIPLES.map((principle, i) => (
          <article
            key={principle.id}
            className={styles.card}
            tabIndex={0}
            style={{ "--i": i } as CSSProperties}
          >
            <div className={styles.head}>
              <span className={styles.index}>{String(i + 1).padStart(2, "0")}</span>
              <span className={styles.plus} aria-hidden="true" />
            </div>
            <div className={styles.figure}>
              <PrincipleArt id={principle.id} />
            </div>
            <div className={styles.copy}>
              <h2 className={styles.title}>{principle.title}</h2>
              <div className={styles.reveal}>
                <p className={styles.body}>{principle.body}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
