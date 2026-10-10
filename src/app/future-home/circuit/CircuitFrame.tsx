"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  PULSE_LENGTH,
  PULSE_SPEED,
  buildCircuit,
  type Circuit,
  type HeroSeam,
  type Surface,
  type Tone,
} from "./geometry";
import styles from "./CircuitFrame.module.css";

/** How long a junction pad stays lit after a pulse passes, in ms. */
const PAD_GLOW = 700;

function toTone(value: string | undefined): Tone {
  return value === "light" ? "light" : "dark";
}

/**
 * Every `data-surface` region of the page's `data-circuit` blocks: the block
 * itself when it carries one, otherwise its direct children that do (the hero
 * is a light panel beside a dark one).
 */
function measureSurfaces(blocks: readonly HTMLElement[], origin: DOMRect): Surface[] {
  return blocks.flatMap((block) => {
    const regions = block.dataset.surface
      ? [block]
      : Array.from(block.querySelectorAll<HTMLElement>(":scope > [data-surface]"));
    return regions.map((region) => {
      const rect = region.getBoundingClientRect();
      return {
        top: rect.top - origin.top,
        bottom: rect.bottom - origin.top,
        left: rect.left - origin.left,
        right: rect.right - origin.left,
        tone: toTone(region.dataset.surface),
      };
    });
  });
}

/** The hero split, while its panels sit side by side. */
function measureHeroSeam(page: HTMLElement, origin: DOMRect): HeroSeam | null {
  const panel = page.querySelector<HTMLElement>("[data-circuit-seam]");
  const neighbor = panel?.nextElementSibling;
  if (!panel || !neighbor) return null;
  const a = panel.getBoundingClientRect();
  const b = neighbor.getBoundingClientRect();
  if (Math.abs(a.top - b.top) > 1) return null;
  return { x: a.right - origin.left, top: a.top - origin.top, height: a.height };
}

/** Quiet gap between one pulse's run and the next, in ms. */
const GAP_MIN = 700;
const GAP_MAX = 3200;
/** How many connected stretches one run passes through. */
const HOPS_MIN = 2;
const HOPS_MAX = 5;

const between = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/**
 * The pulse fades in only at the start of a run and out only at its end; in
 * between, consecutive stretches hand it over at full strength.
 */
function pulseFrames(length: number, fadeIn: boolean, fadeOut: boolean): Keyframe[] {
  const ramp = Math.min(PULSE_LENGTH, length / 2) / length;
  return [
    { offset: 0, offsetDistance: "0px", opacity: fadeIn ? 0 : 1 },
    { offset: ramp, offsetDistance: `${ramp * length}px`, opacity: 1 },
    { offset: 1 - ramp, offsetDistance: `${(1 - ramp) * length}px`, opacity: 1 },
    { offset: 1, offsetDistance: `${length}px`, opacity: fadeOut ? 0 : 1 },
  ];
}

/**
 * Circuit-board frame drawn over the whole page: hairline rails just inside
 * both screen edges, a trace across every boundary between `data-circuit`
 * blocks, and square pads at the junctions (see geometry.ts). Every so often a
 * single pulse starts on a random on-screen stretch and runs through a few
 * connected ones, lighting each pad it reaches. Must be a direct child of the
 * positioned page element, which it measures.
 */
export function CircuitFrame(): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const [circuit, setCircuit] = useState<Circuit | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const page = root?.parentElement;
    if (!root || !page) return;

    let frame = 0;
    let lastKey = "";
    const measure = () => {
      frame = 0;
      const origin = page.getBoundingClientRect();
      const blocks = Array.from(page.querySelectorAll<HTMLElement>(":scope > [data-circuit]"));
      const box = getComputedStyle(root);
      const next = buildCircuit(
        origin.width,
        origin.height,
        parseFloat(box.paddingLeft) || 0,
        parseFloat(box.paddingRight) || 0,
        blocks.slice(1).map((block) => block.getBoundingClientRect().top - origin.top),
        measureSurfaces(blocks, origin),
        measureHeroSeam(page, origin),
      );
      const key = JSON.stringify(next);
      if (key === lastKey) return;
      lastKey = key;
      setCircuit(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(page);
    for (const block of page.querySelectorAll(":scope > [data-circuit]")) observer.observe(block);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !circuit) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const { edges } = circuit;
    const pulses = edges.map((_, index) =>
      Array.from(root.querySelectorAll<HTMLElement>(`[data-edge="${index}"]`)),
    );
    const lights = new Map(
      Array.from(root.querySelectorAll<HTMLElement>("[data-node]"), (el) => [el.dataset.node, el]),
    );
    const leaving = new Map<string, number[]>();
    edges.forEach((edge, index) => leaving.set(edge.from, [...(leaving.get(edge.from) ?? []), index]));

    const onScreen = (index: number) => {
      const top = root.getBoundingClientRect().top;
      return edges[index].bottom + top > 0 && edges[index].top + top < window.innerHeight;
    };

    let timer = 0;
    let running: Animation[] = [];
    let stopped = false;

    const rest = () => {
      timer = window.setTimeout(start, between(GAP_MIN, GAP_MAX));
    };

    const run = (index: number, hopsLeft: number, fadeIn: boolean) => {
      const edge = edges[index];
      const onward = (leaving.get(edge.to) ?? []).filter(
        (next) => !(edges[next].to === edge.from && edges[next].from === edge.to) && onScreen(next),
      );
      const next = hopsLeft > 1 && onward.length > 0 ? pick(onward) : null;
      const frames = pulseFrames(edge.length, fadeIn, next === null);
      const duration = edge.length / PULSE_SPEED;
      running = pulses[index].map((el) => el.animate(frames, { duration }));
      running[0]?.addEventListener("finish", () => {
        if (stopped) return;
        lights.get(edge.to)?.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: PAD_GLOW,
          easing: "ease-out",
        });
        if (next === null) rest();
        else run(next, hopsLeft - 1, false);
      });
    };

    const start = () => {
      const visible = edges.map((_, index) => index).filter(onScreen);
      if (visible.length === 0) {
        rest();
        return;
      }
      run(pick(visible), Math.round(between(HOPS_MIN, HOPS_MAX)), true);
    };

    rest();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      for (const animation of running) animation.cancel();
    };
  }, [circuit]);

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      {circuit?.traces.map((trace, index) => (
        <div
          key={`trace-${index}`}
          className={styles.trace}
          data-tone={trace.tone}
          style={{
            left: trace.x,
            top: trace.y,
            width: trace.width,
            height: trace.height,
            transform: trace.rotate ? `rotate(${trace.rotate}deg)` : undefined,
          }}
        />
      ))}
      {circuit?.pads.map((pad, index) => (
        <div
          key={`pad-${index}`}
          className={styles.pad}
          data-tone={pad.tone}
          style={{ left: pad.x - 2, top: pad.y - 2 }}
        >
          <div className={styles.lit} data-node={pad.node} />
        </div>
      ))}
      {circuit?.edges.flatMap((edge, index) =>
        edge.bands.map((band, copy) => (
          <div
            key={`edge-${index}-${copy}`}
            className={styles.clip}
            style={{ top: band.top, height: band.bottom - band.top }}
          >
            <div className={styles.stage} style={{ top: -band.top, height: circuit.height }}>
              <div
                className={styles.pulse}
                data-edge={index}
                data-tone={band.tone}
                style={{ width: PULSE_LENGTH, offsetPath: `path("${edge.d}")` }}
              />
            </div>
          </div>
        )),
      )}
    </div>
  );
}
