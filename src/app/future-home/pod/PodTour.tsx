"use client";

import { useRef, useState, type CSSProperties, type ReactElement } from "react";
import { TerminalMenu, type TerminalMenuItem } from "@/components/TerminalMenu";
import { useInView } from "@/lib/useInView";
import { ANCHORS, CabinArt, VIEW } from "./CabinArt";
import { POD_TOURS, SHELL_HOTSPOTS, type PodId } from "./podTour";
import styles from "./PodTour.module.css";

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

const POD_ITEMS: readonly TerminalMenuItem[] = POD_TOURS.map(({ id, label }) => ({ id, label }));

/**
 * "A rapidly deployable supercompute.": a line drawing of a ZODE cabin whose equipment
 * highlights on hover, wired into two diverse fiber routes that run out to
 * both screen edges. A terminal menu on the left picks the pod on display;
 * the list on the right mirrors the drawing's hover points.
 */
export function PodTour(): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useInView(ref, "0px 0px -20% 0px");
  const [pod, setPod] = useState<PodId>("compute");
  const [active, setActive] = useState<string | null>(null);

  const tour = POD_TOURS.find((t) => t.id === pod) ?? POD_TOURS[0];
  const hotspots = [...tour.hotspots, ...SHELL_HOTSPOTS];
  const leave = (id: string) => setActive((on) => (on === id ? null : on));

  const choosePod = (id: string) => {
    const next = POD_TOURS.find((t) => t.id === id);
    if (!next) return;
    setPod(next.id);
    setActive(null);
  };

  return (
    <div className={styles.root}>
      <h2 className={styles.title} data-top-fade>
        A rapidly deployable supercompute.
      </h2>

      <div className={styles.panel}>
        <div
          ref={ref}
          className={styles.figure}
          data-shown={shown || undefined}
          data-active={active ?? undefined}
          style={{ "--ratio": VIEW.w / VIEW.h } as CSSProperties}
        >
          <CabinArt pod={pod} active={active} onActive={setActive} />
          <ol className={styles.markers} aria-hidden="true">
            {hotspots.map((spot, i) => (
              <li
                key={spot.id}
                className={styles.marker}
                data-on={active === spot.id || undefined}
                style={{ left: pct(ANCHORS[spot.id].x), top: pct(ANCHORS[spot.id].y), "--i": i } as CSSProperties}
              />
            ))}
          </ol>
        </div>

        <div className={styles.pods} data-top-fade>
          <p className={styles.eyebrow}>Pod</p>
          <TerminalMenu
            items={POD_ITEMS}
            label="ZODE pods"
            size="sm"
            current={pod}
            selected={pod}
            onSelect={choosePod}
          />
        </div>

        <div className={styles.side} data-top-fade>
          <p className={styles.eyebrow}>Explore</p>
          <ul className={styles.spots} aria-label={`${tour.title} features`}>
            {hotspots.map((spot) => (
              <li
                key={spot.id}
                className={styles.spot}
                data-on={active === spot.id || undefined}
                tabIndex={0}
                onMouseEnter={() => setActive(spot.id)}
                onMouseLeave={() => leave(spot.id)}
                onFocus={() => setActive(spot.id)}
                onBlur={() => leave(spot.id)}
              >
                <span className={styles.spotDot} aria-hidden="true" />
                {spot.title}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
