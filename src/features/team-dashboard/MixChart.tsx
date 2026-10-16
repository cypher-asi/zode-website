"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import type { MixSlice } from "./metrics";
import styles from "./dashboard.module.css";

/** Each slice's share of the ink, largest first in the field's order; the dashboard stays monochrome. */
const SHADES = [1, 0.62, 0.38, 0.2, 0.1, 0.05];

/** The ring's radius and width in the 100-unit viewBox, and the gap left between slices, in percent of the ring. */
const RADIUS = 40;
const WIDTH = 16;
const GAP = 0.8;

const megawatts = (value: number) => `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} MW`;
const percent = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`;

/**
 * A donut of the capacity pipeline's MW, split one way at a time (deal type,
 * site type), with a legend giving each part's MW and share. Hovering a slice
 * or its legend row names it in the middle. Switching splits, the legend
 * slides to its new number of rows, so the card grows or shrinks smoothly.
 */
export function MixChart({ mixes }: { mixes: readonly { id: string; label: string; slices: readonly MixSlice[] }[] }): ReactElement {
  const [mixId, setMixId] = useState(mixes[0]?.id);
  const [hover, setHover] = useState<number | null>(null);
  const mix = mixes.find((m) => m.id === mixId) ?? mixes[0];

  const legendRef = useRef<HTMLUListElement>(null);
  /** The legend's height as last laid out, mid-slide included; the observer reports it after the commit that changes it. */
  const shownHeight = useRef<number | null>(null);
  useLayoutEffect(() => {
    const legend = legendRef.current;
    if (!legend) return;
    const observer = new ResizeObserver(([entry]) => {
      shownHeight.current = entry!.borderBoxSize[0]!.blockSize;
    });
    observer.observe(legend);
    return () => observer.disconnect();
  }, []);

  const shownMix = useRef(mix?.id);
  useLayoutEffect(() => {
    const legend = legendRef.current;
    const from = shownHeight.current;
    if (!legend || shownMix.current === mix?.id) return;
    shownMix.current = mix?.id;
    for (const animation of legend.getAnimations()) animation.cancel();
    const to = legend.getBoundingClientRect().height;
    if (from === null || from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    legend.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 280, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
  }, [mix?.id]);
  const slices = mix?.slices ?? [];
  const total = slices.reduce((sum, slice) => sum + slice.mw, 0);
  const focused = hover !== null ? slices[hover] : undefined;

  const shares = slices.map((slice) => (total ? (slice.mw / total) * 100 : 0));
  const arcs = shares.map((share, i) => ({
    start: shares.slice(0, i).reduce((sum, s) => sum + s, 0),
    length: slices.length > 1 ? Math.max(share - GAP, 0.1) : 100,
    shade: SHADES[i] ?? SHADES.at(-1)!,
  }));

  return (
    <div className={styles.mix}>
      {mixes.length > 1 ? (
        <div className={styles.mixTabs} role="group" aria-label="Split the pipeline by">
          {mixes.map((m) => (
            <button
              key={m.id}
              type="button"
              className={styles.mixTab}
              aria-pressed={m.id === mix?.id}
              onClick={() => {
                setMixId(m.id);
                setHover(null);
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles.mixBody}>
        <div className={styles.pieWrap}>
          <svg className={styles.pie} viewBox="0 0 100 100" role="img" aria-label={`Pipeline by ${mix?.label.toLowerCase()}`}>
            {arcs.map((arc, i) => (
              <circle
                key={slices[i]!.label}
                className={styles.pieSlice}
                cx="50"
                cy="50"
                r={RADIUS}
                transform="rotate(-90 50 50)"
                strokeWidth={WIDTH}
                pathLength={100}
                strokeDasharray={`${arc.length} ${100 - arc.length}`}
                strokeDashoffset={-arc.start}
                style={{ "--shade": arc.shade } as CSSProperties}
                data-dim={hover !== null && hover !== i ? "" : undefined}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            ))}
          </svg>
          <div className={styles.pieCenter} aria-hidden="true">
            <span className={styles.pieValue}>{focused ? percent(focused.mw, total) : megawatts(total)}</span>
            <span className={styles.pieLabel}>{focused ? focused.label : "Pipeline"}</span>
          </div>
        </div>
        <ul ref={legendRef} className={styles.mixLegend}>
          {slices.map((slice, i) => (
            <li
              key={slice.label}
              data-dim={hover !== null && hover !== i ? "" : undefined}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            >
              <span className={styles.mixSwatch} style={{ "--shade": arcs[i]!.shade } as CSSProperties} aria-hidden="true" />
              <span className={styles.mixName}>{slice.label}</span>
              <span className={styles.mixValue}>{megawatts(slice.mw)}</span>
              <span className={styles.mixDot} aria-hidden="true">
                ·
              </span>
              <span className={styles.mixValue}>{percent(slice.mw, total)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
