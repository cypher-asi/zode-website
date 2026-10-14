"use client";

import { useRef, useState, type CSSProperties, type ReactElement } from "react";
import { useInView } from "@/hooks/useInView";
import { useOnScreen } from "@/hooks/useOnScreen";
import { STATS, type PlacedSite } from "./sites";
import styles from "./Network.module.css";

type Props = {
  view: { w: number; h: number };
  land: string;
  borders: string;
  graticule: string;
  sites: PlacedSite[];
  links: [number, number][];
};

/**
 * Dark network section: a line-art North America with live and pipeline
 * sites, plus the headline capacity figures. The coastline sweeps in west to
 * east once the section scrolls into view and each dot lands as the sweep
 * passes it. Hovering, focusing or tapping a dot brightens it and its label.
 */
export function NetworkMap({ view, land, borders, graticule, sites, links }: Props): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useInView(ref, "0px 0px -25% 0px");
  const onScreen = useOnScreen(ref);
  const [active, setActive] = useState<string | null>(null);

  const leave = (id: string) => setActive((current) => (current === id ? null : current));

  return (
    <div
      ref={ref}
      className={styles.root}
      data-shown={shown || undefined}
      data-offscreen={!onScreen || undefined}
      data-active={active ?? undefined}
    >
      <div className={styles.stage}>
        <div className={styles.map} style={{ "--ratio": view.w / view.h } as CSSProperties}>
          <svg className={styles.art} viewBox={`0 0 ${view.w} ${view.h}`} aria-hidden="true">
            <path className={styles.graticule} d={graticule} />
            <path className={styles.land} d={land} />
            <path className={styles.borders} d={borders} />
            {links.map(([a, b]) => (
              <line
                key={`${a}-${b}`}
                className={styles.link}
                x1={sites[a].x}
                y1={sites[a].y}
                x2={sites[b].x}
                y2={sites[b].y}
                style={{ "--t": Math.max(sites[a].x, sites[b].x) / view.w } as CSSProperties}
              />
            ))}
          </svg>

          <ul className={styles.sites} aria-label="Deployment sites">
            {sites.map((site, i) => (
              <li
                key={site.id}
                className={styles.site}
                data-status={site.status}
                data-side={site.label ?? "e"}
                data-on={active === site.id || undefined}
                style={
                  {
                    "--x": `${((site.x / view.w) * 100).toFixed(3)}%`,
                    "--y": `${((site.y / view.h) * 100).toFixed(3)}%`,
                    "--t": site.x / view.w,
                    "--p": ((i * 7) % 11) / 11,
                  } as CSSProperties
                }
              >
                <button
                  type="button"
                  className={styles.hit}
                  aria-label={`${site.city}: ${site.mw} MW ${site.status === "live" ? "in production" : "in the pipeline"}`}
                  onPointerEnter={(event) => event.pointerType === "mouse" && setActive(site.id)}
                  onPointerLeave={(event) => event.pointerType === "mouse" && leave(site.id)}
                  onPointerUp={(event) =>
                    event.pointerType !== "mouse" &&
                    setActive((current) => (current === site.id ? null : site.id))
                  }
                  onFocus={() => setActive(site.id)}
                  onBlur={() => leave(site.id)}
                >
                  <span className={styles.dot} />
                  {site.status === "live" && <span className={styles.code}>{site.id}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.shade} aria-hidden="true" />
      </div>

      <div className={styles.copy} data-top-fade>
        <h2 className={styles.title}>
          <span>Distributed</span> <span>Edge Network</span>
        </h2>
        <p className={styles.helper}>
          ZODEs deploy beside power and close to users, so inference runs milliseconds from the people it
          serves.
        </p>
      </div>

      <div className={styles.numbers} data-top-fade>
        <p className={styles.eyebrow}>Active build out</p>
        <dl className={styles.stats}>
          {STATS.map((stat) => (
            <div key={stat.status} className={styles.stat} data-status={stat.status}>
              <dt className={styles.statLabel}>
                <span className={styles.legend} aria-hidden="true" />
                {stat.label}
              </dt>
              <dd className={styles.statValue}>
                {stat.value}
                <span className={styles.unit}>{stat.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
