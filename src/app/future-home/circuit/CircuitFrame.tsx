"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  PULSE_LENGTH,
  PULSE_SPEED,
  buildCircuit,
  type Circuit,
  type HeroSeam,
  type Route,
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

/** The hero split, while its panels sit side by side; they overlap by the jog's width. */
function measureHeroSeam(page: HTMLElement, origin: DOMRect): HeroSeam | null {
  const panel = page.querySelector<HTMLElement>("[data-circuit-seam]");
  const neighbor = panel?.nextElementSibling;
  if (!panel || !neighbor) return null;
  const a = panel.getBoundingClientRect();
  const b = neighbor.getBoundingClientRect();
  if (Math.abs(a.top - b.top) > 1) return null;
  return {
    x: a.right - origin.left,
    top: a.top - origin.top,
    height: a.height,
    step: a.right - b.left,
  };
}

function pulseFrames(route: Route, cycle: number): Keyframe[] {
  const ramp = Math.min(PULSE_LENGTH, route.length / 2);
  const at = (distance: number) => Math.min(1, (route.start + distance / PULSE_SPEED) / cycle);
  return [
    { offset: 0, offsetDistance: "0px", opacity: 0 },
    { offset: at(0), offsetDistance: "0px", opacity: 0 },
    { offset: at(ramp), offsetDistance: `${ramp}px`, opacity: 1 },
    { offset: at(route.length - ramp), offsetDistance: `${route.length - ramp}px`, opacity: 1 },
    { offset: at(route.length), offsetDistance: `${route.length}px`, opacity: 0 },
    { offset: 1, offsetDistance: `${route.length}px`, opacity: 0 },
  ];
}

function padFrames(at: number, cycle: number): Keyframe[] {
  const time = (ms: number) => Math.min(1, ms / cycle);
  return [
    { offset: 0, opacity: 0 },
    { offset: time(at), opacity: 0 },
    { offset: time(at + 60), opacity: 1 },
    { offset: time(at + PAD_GLOW), opacity: 0 },
    { offset: 1, opacity: 0 },
  ];
}

/**
 * Circuit-board frame drawn over the whole page: hairline rails just inside
 * both screen edges, a trace across every boundary between `data-circuit`
 * blocks, square pads at the junctions, and a glowing pulse that periodically
 * runs down the rails and branches across each trace (see geometry.ts). Must
 * be a direct child of the positioned page element, which it measures.
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
      const next = buildCircuit(
        origin.width,
        origin.height,
        parseFloat(getComputedStyle(root).paddingLeft) || 0,
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

    const options = { duration: circuit.cycle, iterations: Infinity };
    const animations = [
      ...Array.from(root.querySelectorAll<HTMLElement>("[data-route]"), (el) =>
        el.animate(pulseFrames(circuit.routes[Number(el.dataset.route)], circuit.cycle), options),
      ),
      ...Array.from(root.querySelectorAll<HTMLElement>("[data-pad]"), (el) =>
        el.animate(padFrames(circuit.pads[Number(el.dataset.pad)].at, circuit.cycle), options),
      ),
    ];
    return () => {
      for (const animation of animations) animation.cancel();
    };
  }, [circuit]);

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      {circuit?.traces.map((trace, index) => (
        <div
          key={`trace-${index}`}
          className={styles.trace}
          data-tone={trace.tone}
          style={{ left: trace.x, top: trace.y, width: trace.width, height: trace.height }}
        />
      ))}
      {circuit?.pads.map((pad, index) => (
        <div
          key={`pad-${index}`}
          className={styles.pad}
          data-tone={pad.tone}
          style={{ left: pad.x - 2, top: pad.y - 2 }}
        >
          <div className={styles.lit} data-pad={index} />
        </div>
      ))}
      {circuit?.routes.map((route, index) => (
        <div
          key={`route-${index}`}
          className={styles.clip}
          style={{ top: route.clipTop, height: route.clipBottom - route.clipTop }}
        >
          <div className={styles.stage} style={{ top: -route.clipTop, height: circuit.height }}>
            <div
              className={styles.pulse}
              data-route={index}
              data-tone={route.tone}
              style={{ width: PULSE_LENGTH, offsetPath: `path("${route.d}")` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
