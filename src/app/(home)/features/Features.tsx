"use client";

import { Fragment, useRef, type CSSProperties, type ReactElement } from "react";
import { useInView } from "@/lib/useInView";
import { TerminalMenu, type TerminalMenuItem } from "@/components/TerminalMenu";
import { FeatureArt } from "./FeatureArt";
import { FEATURES } from "./features";
import styles from "./Features.module.css";

/** Desktop reading order of the grid areas, used to stagger the reveal. */
const ORDER = ["t1", "f2", "t2", "f1", "t3", "f3", "t4", "f5", "t5", "f4", "cta"];

const ACTIONS: readonly TerminalMenuItem[] = [
  { id: "rent", label: "Rent Compute", href: "/rent-compute" },
  { id: "own", label: "Own Compute", href: "/buy-compute" },
  { id: "meet", label: "Schedule Meeting", href: "/contact" },
];

const area = (name: string) => ({ gridArea: name, "--i": ORDER.indexOf(name) }) as CSSProperties;

/**
 * Checkerboard of feature cells and numbered line drawings. Each feature's
 * figure sits beside or below its text; grid areas in Features.module.css
 * place them per breakpoint.
 */
export function Features(): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useInView(ref, "0px 0px -20% 0px");

  return (
    <div className={styles.root}>
      <div ref={ref} className={styles.grid} data-shown={shown || undefined} data-top-fade>
        {FEATURES.map((feature, n) => (
          <Fragment key={feature.id}>
            <article className={styles.text} style={area(`t${n + 1}`)}>
              <h2 className={styles.title}>
                <span>{feature.title[0]}</span> <span>{feature.title[1]}</span>
              </h2>
              <p className={styles.body}>{feature.body}</p>
            </article>
            <figure className={styles.figure} style={area(`f${n + 1}`)}>
              <FeatureArt id={feature.id} />
              <figcaption className={styles.caption}>Fig. {String(n + 1).padStart(2, "0")}</figcaption>
            </figure>
          </Fragment>
        ))}

        <div className={styles.cta} style={area("cta")}>
          <h1 className={styles.ctaTitle}>From order to tokens in 90 days.</h1>
          <TerminalMenu items={ACTIONS} label="Get compute" />
        </div>
      </div>
    </div>
  );
}
