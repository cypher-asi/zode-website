"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import {
  PULSE_LENGTH,
  PULSE_SPEED,
  buildCircuit,
  type Circuit,
  type Edge,
  type Split,
  type Surface,
  type Tone,
} from "./geometry";
import styles from "./CircuitFrame.module.css";

/** How long a junction pad stays lit after a pulse passes, in ms. */
const PAD_GLOW = 260;
/** Peak opacity of the pulse and of a freshly lit pad. */
const PEAK = 0.75;
/** Distance over which a run's pulse fades in and out, in px. */
const FADE = 18;
/** Thickness of the pulse in px; its length is PULSE_LENGTH. */
const PULSE_THICKNESS = 1.5;

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
function measureSplit(page: HTMLElement, origin: DOMRect): Split | null {
  const panel = page.querySelector<HTMLElement>("[data-circuit-seam]");
  const neighbor = panel?.nextElementSibling;
  if (!panel || !neighbor) return null;
  const a = panel.getBoundingClientRect();
  const b = neighbor.getBoundingClientRect();
  if (Math.abs(a.top - b.top) > 1) return null;
  return { x: a.right - origin.left, top: a.top - origin.top, bottom: a.bottom - origin.top };
}

/** Intro timing in ms: the rails draw down, then each row expands as they reach it, then its pads appear. */
const RAIL_DRAW = 900;
const ROW_START = 250;
const ROW_DRAW = 700;
const PAD_FADE = 300;
/** Extra delay for a row, pad or rail segment at the bottom of the screen versus the top. */
const DESCENT = 500;

/** Quiet gap between one pulse's run and the next, in ms. */
const GAP_MIN = 700;
const GAP_MAX = 3200;
/** How many connected stretches one run passes through. */
const HOPS_MIN = 1;
const HOPS_MAX = 3;

const between = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/**
 * The pulse fades in only at the start of a run and out only at its end; in
 * between, consecutive stretches hand it over at full strength. It moves by
 * `transform` alone so the animation runs on the compositor: each frame puts
 * the head (the `transform-origin`, mid-way down the leading end) on the run,
 * turned to face along it.
 */
function pulseFrames(edge: Edge, fadeIn: boolean, fadeOut: boolean): Keyframe[] {
  const { length } = edge;
  const ramp = Math.min(FADE, length / 2) / length;
  const angle = (Math.atan2(edge.dy, edge.dx) * 180) / Math.PI;
  const at = (distance: number) =>
    `translate(${edge.x + edge.dx * distance - PULSE_LENGTH}px, ${edge.y + edge.dy * distance - PULSE_THICKNESS / 2}px) rotate(${angle}deg)`;
  return [
    { offset: 0, transform: at(0), opacity: fadeIn ? 0 : PEAK },
    { offset: ramp, transform: at(ramp * length), opacity: PEAK },
    { offset: 1 - ramp, transform: at((1 - ramp) * length), opacity: PEAK },
    { offset: 1, transform: at(length), opacity: fadeOut ? 0 : PEAK },
  ];
}

/**
 * Circuit-board frame drawn over the whole page as a straight grid: hairline
 * rails just inside both screen edges, a trace across every boundary between
 * `data-circuit` blocks and along the top of each `data-circuit-rule` element,
 * and square pads at the junctions (see geometry.ts). Every so often a
 * single pulse starts on a random on-screen stretch and runs through a few
 * connected ones, lighting each pad it reaches. On load the on-screen part of
 * the grid draws itself in first. Must be a direct child of the positioned
 * page element, which it measures.
 */
export function CircuitFrame(): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const introduced = useRef(false);
  /** `performance.now()` at which the intro finishes; pulses hold off until then. */
  const introEnd = useRef(0);

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
      const topOf = (el: HTMLElement) => el.getBoundingClientRect().top - origin.top;
      const next = buildCircuit(
        origin.width,
        origin.height,
        parseFloat(getComputedStyle(root).paddingLeft) || 0,
        [
          ...blocks.slice(1).map(topOf),
          ...Array.from(page.querySelectorAll<HTMLElement>("[data-circuit-rule]"), topOf),
        ],
        measureSurfaces(blocks, origin),
        measureSplit(page, origin),
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
    // The hero split moves without resizing its block (see HeroSplitter).
    const seam = page.querySelector("[data-circuit-seam]");
    if (seam) observer.observe(seam);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  /*
   * First layout only, before it paints: rails and the hero split grow down
   * from their tops, rows expand outward from the page's centre (the hero
   * seam) once the rails reach them, and pads fade in after their row.
   * Anything off-screen is simply there.
   */
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !circuit || introduced.current) return;
    introduced.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const viewTop = -root.getBoundingClientRect().top;
    const viewBottom = viewTop + window.innerHeight;
    const onScreen = (top: number, bottom: number) => bottom >= viewTop && top <= viewBottom;
    const descent = (y: number) =>
      DESCENT * Math.min(1, Math.max(0, (y - viewTop) / window.innerHeight));
    const center = circuit.width / 2;
    let end = 0;

    const traces = root.querySelectorAll<HTMLElement>(`.${styles.trace}`);
    circuit.traces.forEach((trace, index) => {
      const el = traces[index];
      if (!el || !onScreen(trace.y, trace.y + trace.height)) return;
      const vertical = trace.height > trace.width;
      const origin = vertical
        ? "0 0"
        : `${Math.min(trace.width, Math.max(0, center - trace.x))}px 0`;
      const scale = vertical ? "scaleY" : "scaleX";
      const delay = vertical ? descent(trace.y) : ROW_START + descent(trace.y);
      const duration = vertical ? RAIL_DRAW : ROW_DRAW;
      el.animate(
        [
          { transformOrigin: origin, transform: `${scale}(0)` },
          { transformOrigin: origin, transform: `${scale}(1)` },
        ],
        {
          duration,
          delay,
          easing: vertical ? "cubic-bezier(0.65, 0, 0.35, 1)" : "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "backwards",
        },
      );
      end = Math.max(end, delay + duration);
    });

    const pads = root.querySelectorAll<HTMLElement>(`.${styles.pad}`);
    circuit.pads.forEach((pad, index) => {
      const el = pads[index];
      if (!el || !onScreen(pad.y, pad.y)) return;
      const delay = ROW_START + descent(pad.y) + ROW_DRAW / 2;
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: PAD_FADE,
        delay,
        easing: "ease-out",
        fill: "backwards",
      });
      end = Math.max(end, delay + PAD_FADE);
    });

    introEnd.current = performance.now() + end;
  }, [circuit]);

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
      const frames = pulseFrames(edge, fadeIn, next === null);
      const duration = edge.length / PULSE_SPEED;
      running = pulses[index].map((el) => el.animate(frames, { duration }));
      running[0]?.addEventListener("finish", () => {
        if (stopped) return;
        lights.get(edge.to)?.animate([{ opacity: PEAK }, { opacity: 0 }], {
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

    timer = window.setTimeout(
      start,
      Math.max(0, introEnd.current - performance.now()) + between(GAP_MIN, GAP_MAX),
    );
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
            style={{
              top: band.top,
              left: band.left,
              width: band.right - band.left,
              height: band.bottom - band.top,
            }}
          >
            <div
              className={styles.stage}
              style={{
                top: -band.top,
                left: -band.left,
                width: circuit.width,
                height: circuit.height,
              }}
            >
              <div
                className={styles.pulse}
                data-edge={index}
                data-tone={band.tone}
                style={{ width: PULSE_LENGTH, height: PULSE_THICKNESS }}
              />
            </div>
          </div>
        )),
      )}
    </div>
  );
}
