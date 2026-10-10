"use client";

import Link from "next/link";
import {
  Fragment,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { useInView } from "@/lib/useInView";
import { FeatureArt } from "./FeatureArt";
import { FEATURES } from "./features";
import styles from "./Features.module.css";

/** Desktop reading order of the grid areas, used to stagger the reveal. */
const ORDER = ["t1", "f2", "t2", "f1", "t3", "f3", "t4", "f5", "t5", "f4", "cta"];

const ACTIONS = [
  { label: "Deploy Compute", href: "/deployments", cmd: "./deploy" },
  { label: "Buy Compute", href: "/buy-compute", cmd: "./buy" },
  { label: "Learn More", href: "#network", cmd: "man zode" },
];

const area = (name: string) => ({ gridArea: name, "--i": ORDER.indexOf(name) }) as CSSProperties;

/** Moves focus between the CTA menu's links with the arrow keys, wrapping at the ends. */
function onMenuKey(event: KeyboardEvent<HTMLElement>): void {
  const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
  if (!step) return;

  const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
  const current = links.indexOf(document.activeElement as HTMLAnchorElement);
  const next = current === -1 ? (step > 0 ? 0 : links.length - 1) : (current + step + links.length) % links.length;

  event.preventDefault();
  links[next]?.focus();
}

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
              <h3 className={styles.title}>
                <span>{feature.title[0]}</span> <span>{feature.title[1]}</span>
              </h3>
              <p className={styles.body}>{feature.body}</p>
            </article>
            <figure className={styles.figure} style={area(`f${n + 1}`)}>
              <FeatureArt id={feature.id} />
              <figcaption className={styles.caption}>Fig. {String(n + 1).padStart(2, "0")}</figcaption>
            </figure>
          </Fragment>
        ))}

        <div className={styles.cta} style={area("cta")}>
          <p className={styles.ctaTitle}>From order to tokens in 90 days.</p>
          <nav className={styles.menu} aria-label="Get started" onKeyDown={onMenuKey}>
            <p className={styles.prompt} aria-hidden="true">
              zode@sovereign:~$ <span>select --action</span>
            </p>
            <ol className={styles.items}>
              {ACTIONS.map((action, n) => (
                <li key={action.href}>
                  <Link className={styles.item} href={action.href}>
                    <span className={styles.caret} aria-hidden="true">
                      &gt;
                    </span>
                    <span className={styles.index} aria-hidden="true">
                      {String(n + 1).padStart(2, "0")}
                    </span>
                    <span className={styles.label}>
                      {action.label}
                      <span className={styles.cursor} aria-hidden="true" />
                    </span>
                    <span className={styles.cmd} aria-hidden="true">
                      {action.cmd}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </div>
  );
}
