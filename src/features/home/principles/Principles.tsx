"use client";

import { useEffect, useRef, type CSSProperties, type ReactElement } from "react";
import { useInView } from "@/hooks/useInView";
import { PrincipleArt } from "./PrincipleArt";
import { PRINCIPLES, type Principle } from "./principles";
import styles from "./Principles.module.css";

/**
 * One numbered principle card: a line drawing over its title. Hovering or
 * focusing it plays the drawing and slides the description up under the
 * title. `headingLevel` drops the title to an H3 where the card sits under
 * a section's own H2.
 */
function PrincipleCard({
  principle,
  index,
  headingLevel,
}: {
  principle: Principle;
  index: number;
  headingLevel: 2 | 3;
}): ReactElement {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <article className={styles.card} tabIndex={0} style={{ "--i": index } as CSSProperties}>
      <div className={styles.head}>
        <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
        <span className={styles.plus} aria-hidden="true" />
      </div>
      <div className={styles.figure}>
        <PrincipleArt id={principle.id} />
      </div>
      <div className={styles.copy}>
        <Heading className={styles.title}>{principle.title}</Heading>
        <div className={styles.reveal}>
          <p className={styles.body}>{principle.body}</p>
        </div>
      </div>
    </article>
  );
}

/**
 * Four numbered principle cards in a row. Touch screens show every
 * description, and play a drawing while its card sits in the middle of the
 * viewport. The cards rise in once scrolled into view, or with `shown` where
 * the host decides (a deck slide becoming active); `className` lets a host
 * retune the custom properties the stylesheet reads.
 */
export function Principles({
  shown,
  headingLevel = 2,
  className,
}: {
  shown?: boolean;
  headingLevel?: 2 | 3;
  className?: string;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "0px 0px -20% 0px");
  const rise = shown ?? inView;

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
    <div className={className ? `${styles.root} ${className}` : styles.root}>
      <div ref={ref} className={styles.grid} data-shown={rise || undefined} data-top-fade>
        {PRINCIPLES.map((principle, i) => (
          <PrincipleCard key={principle.id} principle={principle} index={i} headingLevel={headingLevel} />
        ))}
      </div>
    </div>
  );
}
