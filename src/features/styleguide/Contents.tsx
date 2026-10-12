"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import styles from "./Styleguide.module.css";

/** How long the scroll has to rest before a clicked link hands back to tracking. */
const SETTLE_MS = 150;

/**
 * The guide's contents, marking the section being read: the last one whose
 * top has passed a line a third of the way down the viewport (or the anchor
 * line, if lower). A clicked link stays marked while the smooth scroll runs
 * past the sections in between.
 */
export function Contents({ sections }: { sections: readonly { id: string; title: string }[] }): ReactElement {
  const [active, setActive] = useState<string | null>(null);
  const clicked = useRef(false);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const nodes = sections.flatMap((s) => document.getElementById(s.id) ?? []);
    if (!nodes.length) return;
    let frame = 0;

    const sample = () => {
      frame = 0;
      if (clicked.current) return;
      const line = Math.max(innerHeight / 3, parseFloat(getComputedStyle(nodes[0]).scrollMarginTop) + 1);
      let current: string | null = null;
      for (const node of nodes) {
        if (node.getBoundingClientRect().top > line) break;
        current = node.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (clicked.current) {
        clearTimeout(settle.current);
        settle.current = setTimeout(() => {
          clicked.current = false;
          sample();
        }, SETTLE_MS);
        return;
      }
      if (!frame) frame = requestAnimationFrame(sample);
    };

    sample();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  const onClick = (id: string) => {
    clicked.current = true;
    setActive(id);
    // Released here too in case the section is already in place and nothing scrolls.
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      clicked.current = false;
    }, SETTLE_MS);
  };

  return (
    <nav className={styles.toc} aria-label="On this page">
      <ol>
        {sections.map((s, i) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "location" : undefined}
              onClick={() => onClick(s.id)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
