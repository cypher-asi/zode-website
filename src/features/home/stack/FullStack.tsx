"use client";

import { useRef, useState, type CSSProperties, type ReactElement } from "react";
import { useInView } from "@/hooks/useInView";
import { LAYERS, type LayerId } from "./layers";
import { ANCHOR_X, StackArt, VIEW, labelY } from "./StackArt";
import styles from "./FullStack.module.css";

/**
 * The exploded line drawing of the six layers with labels to its right,
 * each joined to its plate by a leader line. The plates spread apart once
 * the figure scrolls into view, or with `exploded` where the host decides (a
 * deck slide becoming active). Hovering a plate highlights it and its label;
 * on touch, tapping a plate or a label toggles the highlight. Below 1200px
 * the labels restack under the drawing unless `side` keeps them beside it;
 * `className` lets a host retune the custom properties the stylesheet reads.
 */
export function StackFigure({
  exploded,
  side = false,
  className,
}: {
  exploded?: boolean;
  side?: boolean;
  className?: string;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "0px 0px -25% 0px");
  const open = exploded ?? inView;
  const [active, setActive] = useState<LayerId | null>(null);

  return (
    <div
      ref={ref}
      className={className ? `${styles.figure} ${className}` : styles.figure}
      data-exploded={open || undefined}
      data-active={active ?? undefined}
      data-side={side || undefined}
      style={
        {
          "--anchor-in": ((VIEW.x + VIEW.w - ANCHOR_X) / VIEW.w).toFixed(4),
          "--view-w": VIEW.w,
          "--ratio": VIEW.w / VIEW.h,
        } as CSSProperties
      }
    >
      <StackArt active={active} onActive={setActive} />

      <ol className={styles.labels}>
        {LAYERS.map((layer, i) => (
          <li
            key={layer.id}
            className={styles.label}
            data-on={active === layer.id || undefined}
            onPointerUp={(event) =>
              event.pointerType !== "mouse" && setActive(active === layer.id ? null : layer.id)
            }
            style={
              {
                "--y": `${(((labelY(i) - VIEW.y) / VIEW.h) * 100).toFixed(2)}%`,
                "--i": i,
              } as CSSProperties
            }
          >
            <span className={styles.labelText}>
              <span className={styles.labelHead}>
                <span className={styles.labelIndex}>
                  {String(LAYERS.length - i).padStart(2, "0")}
                </span>
                <span className={styles.labelTitle}>{layer.title}</span>
              </span>
              <span className={styles.labelBody}>{layer.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** "Full stack" section: the intro copy on the left, the stack figure to its right. */
export function FullStack(): ReactElement {
  return (
    <div className={styles.root} data-top-fade>
      <div className={styles.layout}>
        <div className={styles.intro}>
          <h2 className={styles.title}>
            Vertically integrated,
            <br />
            from dirt to tokens.
          </h2>
          <p className={styles.lede}>
            ZODE builds every layer itself, from the land and power to the
            network that delivers your tokens.
            <br />
            <br />
            Owning the stack means fewer
            parts, systems tuned for specific AI workloads, lower costs, and
            sites that deploy in months.
          </p>
        </div>

        <StackFigure />
      </div>
    </div>
  );
}
