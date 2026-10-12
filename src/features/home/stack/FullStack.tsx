"use client";

import { useRef, useState, type CSSProperties, type ReactElement } from "react";
import { useInView } from "@/hooks/useInView";
import { LAYERS, type LayerId } from "./layers";
import { ANCHOR_X, StackArt, VIEW, labelY } from "./StackArt";
import styles from "./FullStack.module.css";

/**
 * "Full stack" section: the intro copy on the left, and an exploded line
 * drawing of the six layers with labels to its right, each joined to its
 * plate by a leader line. The plates spread apart once the figure scrolls
 * into view, and hovering a plate highlights it and its label; on touch,
 * tapping a plate or a label toggles the highlight.
 */
export function FullStack(): ReactElement {
  const figureRef = useRef<HTMLDivElement>(null);
  const exploded = useInView(figureRef, "0px 0px -25% 0px");
  const [active, setActive] = useState<LayerId | null>(null);

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

        <div
          ref={figureRef}
          className={styles.figure}
          data-exploded={exploded || undefined}
          data-active={active ?? undefined}
          style={
            {
              "--anchor-in": ((VIEW.x + VIEW.w - ANCHOR_X) / VIEW.w).toFixed(4),
              "--view-w": VIEW.w,
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
                    <span className={styles.labelTitle}>{layer.title}</span>
                    <span className={styles.labelIndex}>
                      Layer {String(LAYERS.length - i).padStart(2, "0")}
                    </span>
                  </span>
                  <span className={styles.labelBody}>{layer.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
