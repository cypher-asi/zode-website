"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { PAPER } from "../drawing/SheetFrame";
import { useDesign } from "../store";
import styles from "../chassis.module.css";

type ViewBox = { x: number; y: number; w: number; h: number };
const FIT: ViewBox = { x: 0, y: 0, w: PAPER.w, h: PAPER.h };
const MIN_W = 20;
const MAX_W = PAPER.w * 2;

export interface Overlay {
  /** The paper-mm rectangle the overlay covers. */
  rect: { x: number; y: number; w: number; h: number };
  node: ReactNode;
}

/**
 * An A3 sheet: wheel to zoom at the cursor, drag to pan, click blank paper to
 * clear the selection. Key it by sheet so each opens fitted.
 */
export function SheetViewer({ children, overlay }: { children: ReactNode; overlay?: Overlay }): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [vb, setVb] = useState<ViewBox>(FIT);
  const [grabbing, setGrabbing] = useState(false);
  const drag = useRef<{ x: number; y: number; vb: ViewBox; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const select = useDesign((s) => s.select);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Screen px per paper mm, and where the viewBox origin lands (preserveAspectRatio = xMidYMid meet).
  const s = Math.min(size.w / vb.w, size.h / vb.h);
  const ox = (size.w - vb.w * s) / 2 - vb.x * s;
  const oy = (size.h - vb.h * s) / 2 - vb.y * s;

  const toPaper = useCallback(
    (clientX: number, clientY: number) => {
      const r = host.current!.getBoundingClientRect();
      return { x: (clientX - r.left - ox) / s, y: (clientY - r.top - oy) / s };
    },
    [ox, oy, s],
  );

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest("[data-no-sheet-zoom]")) return;
      event.preventDefault();
      const p = toPaper(event.clientX, event.clientY);
      const f = Math.exp(event.deltaY * 0.0015);
      setVb((v) => {
        const w = Math.min(MAX_W, Math.max(MIN_W, v.w * f));
        const k = w / v.w;
        return { x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w, h: v.h * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [toPaper]);

  const zoomBy = (f: number) =>
    setVb((v) => {
      const w = Math.min(MAX_W, Math.max(MIN_W, v.w * f));
      const h = v.h * (w / v.w);
      return { x: v.x + v.w / 2 - w / 2, y: v.y + v.h / 2 - h / 2, w, h };
    });

  return (
    <div className={styles.sheetHost} ref={host}>
      <svg
        className={styles.sheetSvg}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: grabbing ? "grabbing" : "default" }}
        onPointerDown={(event) => {
          if (event.button !== 0 && event.button !== 1) return;
          drag.current = { x: event.clientX, y: event.clientY, vb, moved: false };
        }}
        onPointerMove={(event) => {
          const d = drag.current;
          if (!d) return;
          const dx = event.clientX - d.x;
          const dy = event.clientY - d.y;
          if (!d.moved && Math.hypot(dx, dy) < 4) return;
          if (!d.moved) {
            event.currentTarget.setPointerCapture(event.pointerId);
            setGrabbing(true);
          }
          d.moved = true;
          setVb({ ...d.vb, x: d.vb.x - dx / s, y: d.vb.y - dy / s });
        }}
        onPointerUp={() => {
          suppressClick.current = !!drag.current?.moved;
          drag.current = null;
          setGrabbing(false);
        }}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.stopPropagation();
            suppressClick.current = false;
          }
        }}
        onClick={() => select(null)}
      >
        <rect x={-2000} y={-2000} width={5000} height={5000} fill="transparent" />
        <g className={styles.paper}>{children}</g>
      </svg>

      {overlay ? (
        <div
          className={styles.overlay}
          style={{
            left: ox + overlay.rect.x * s,
            top: oy + overlay.rect.y * s,
            width: overlay.rect.w * s,
            height: overlay.rect.h * s,
          }}
          data-no-sheet-zoom
        >
          {overlay.node}
        </div>
      ) : null}

      <div className={styles.zoom}>
        <button type="button" onClick={() => zoomBy(1 / 1.3)} title="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1.3)} title="Zoom out">
          −
        </button>
        <button type="button" onClick={() => setVb(FIT)} title="Fit the sheet">
          Fit
        </button>
        <span>{Math.round((PAPER.w / vb.w) * 100)}%</span>
      </div>
    </div>
  );
}
