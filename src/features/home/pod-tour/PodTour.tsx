"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { TerminalMenu, type TerminalMenuItem } from "@/components/ui/TerminalMenu";
import { useInView } from "@/hooks/useInView";
import { ANCHORS, CabinArt, DROP, VIEW } from "@/features/zode-drawings/CabinArt";
import { POD_TOURS, SHELL_HOTSPOTS, type PodId } from "@/features/zode-drawings/podTour";
import styles from "./PodTour.module.css";

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

const POD_ITEMS: readonly TerminalMenuItem[] = POD_TOURS.map(({ id, label }) => ({ id, label }));

/**
 * "A rapidly deployable supercomputer.": a line drawing of a ZODE cabin whose equipment
 * highlights on hover, wired by two diverse fiber routes that drop from its
 * middle into the page's circuit grid below. The heading and a terminal menu
 * that picks the pod on display sit in the left column, over a switch that
 * lifts the roof off the hall; the list on the right mirrors the drawing's
 * hover points.
 */
export function PodTour(): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const shown = useInView(ref, "0px 0px -20% 0px");
  const [pod, setPod] = useState<PodId>("compute");
  const [active, setActive] = useState<string | null>(null);
  const [cutaway, setCutaway] = useState(false);
  const [dropTop, setDropTop] = useState<number | null>(null);

  // Offsets ignore the figure's slide-in, so the drops start where the cabin comes to rest.
  useEffect(() => {
    const root = rootRef.current;
    const figure = ref.current;
    if (!root || !figure) return;
    const measure = () => setDropTop(Math.round(figure.offsetTop + DROP.y * figure.offsetHeight));
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(figure);
    return () => observer.disconnect();
  }, []);

  const tour = POD_TOURS.find((t) => t.id === pod) ?? POD_TOURS[0];
  const hotspots = [...tour.hotspots, ...SHELL_HOTSPOTS];
  const cut = cutaway || hotspots.some((spot) => spot.overhead && spot.id === active);
  const leave = (id: string) => setActive((on) => (on === id ? null : on));
  const toggle = (id: string) => setActive((on) => (on === id ? null : id));

  const choosePod = (id: string) => {
    const next = POD_TOURS.find((t) => t.id === id);
    if (!next) return;
    setPod(next.id);
    setActive(null);
  };

  return (
    <div ref={rootRef} className={styles.root} style={{ "--ratio": VIEW.w / VIEW.h } as CSSProperties}>
      {dropTop !== null &&
        (["a", "b"] as const).map((route) => (
          <span
            key={route}
            className={styles.drop}
            data-route={route}
            data-shown={shown || undefined}
            data-on={active === `fiber-${route}` || undefined}
            style={{ top: dropTop }}
            aria-hidden="true"
          />
        ))}
      <div className={styles.panel}>
        <div
          ref={ref}
          className={styles.figure}
          data-shown={shown || undefined}
          data-active={active ?? undefined}
        >
          <CabinArt pod={pod} cutaway={cut} active={active} onActive={setActive} />
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

        <div className={styles.lead}>
          <h2 className={styles.title} data-top-fade>
            A rapidly deployable
            <br />
            supercomputer.
          </h2>
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
            <button
              type="button"
              className={styles.cutaway}
              aria-pressed={cutaway}
              onClick={() => setCutaway((on) => !on)}
            >
              <span className={styles.switch} aria-hidden="true" />
              Roof cutaway
            </button>
          </div>
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
                onPointerEnter={(event) => event.pointerType === "mouse" && setActive(spot.id)}
                onPointerLeave={(event) => event.pointerType === "mouse" && leave(spot.id)}
                onPointerUp={(event) => event.pointerType !== "mouse" && toggle(spot.id)}
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
