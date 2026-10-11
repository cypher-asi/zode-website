"use client";

import { useState, type ReactElement } from "react";
import { Sketch, round, type Bounds } from "@/features/zode-drawings/lineArt";
import art from "@/features/zode-drawings/lineArt.module.css";
import type { RackCounts, RackKind, RentQuote } from "./rentConfig";
import shared from "./ZodePreview.module.css";
import styles from "./RackPreview.module.css";

/*
 * Model units: x along a row of racks, y across the hall (+y toward the
 * viewer, the side the rack fronts face), z up.
 */
const RACK = { w: 12, d: 22, h: 40, pitch: 13 };
const PER_ROW = 16;
/** Row-to-row spacing: a rack's depth plus the aisle behind it. */
const ROW_GAP = RACK.d + 20;
/** The smallest viewBox, about an eight-rack row, so a one-rack cluster isn't drawn huge. */
const MIN_VIEW = { w: 170, h: 130 };
const PAD = 8;

/** Front row first, left to right; the GPU racks fill everything after. */
const ORDER: readonly RackKind[] = ["mgmt", "network", "storage", "cpu", "gpu"];

const RACK_LABELS: Record<RackKind, string> = {
  gpu: "GPU",
  network: "Network",
  storage: "Storage",
  cpu: "CPU",
  mgmt: "Management",
};

const front = (s: Sketch, y: number, x0: number, x1: number, z0: number, z1: number, cls: string) =>
  s.face(
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ],
    cls,
  );

/** One rack, its front face detailed by kind. */
function rack(s: Sketch, kind: RackKind, x0: number, y0: number): void {
  const { w, d, h } = RACK;
  const y = y0 + d;
  const [l, r] = [x0 + 1.8, x0 + w - 1.8];
  s.box(x0, y0, w, d, 0, h);
  const hair = (z: number) => s.line([[l + 1, y, z], [r - 1, y, z]], art.hair);

  switch (kind) {
    case "gpu":
      // Four HGX nodes, each a tall shelf.
      for (let k = 0; k < 4; k++) {
        const z = 3 + k * 8.6;
        front(s, y, l, r, z, z + 7.8, art.fine);
        for (let t = z + 2; t < z + 7.8; t += 2) hair(t);
      }
      break;
    case "network":
      // Leaf and spine switches.
      for (let k = 0; k < 5; k++) {
        const z = 6 + k * 7;
        front(s, y, x0 + 2.2, x0 + w - 2.2, z, z + 3, art.ink);
      }
      break;
    case "storage": {
      // Drive bays.
      front(s, y, l, r, 3, h - 3, art.fine);
      const cols = 3;
      const cw = (r - l - 1) / cols;
      for (let z = 4.5; z + 2.6 < h - 3.5; z += 3.6) {
        for (let c = 0; c < cols; c++) {
          const cx = l + 0.5 + c * cw;
          front(s, y, cx + 0.3, cx + cw - 0.3, z, z + 2.6, art.hair);
        }
      }
      break;
    }
    case "cpu":
      // A full rack of 1U servers.
      front(s, y, l, r, 3, h - 3, art.fine);
      for (let z = 5; z < h - 4; z += 2) hair(z);
      break;
    case "mgmt":
      // A management switch over a few 1U servers.
      front(s, y, x0 + 2.2, x0 + w - 2.2, h - 9, h - 6, art.ink);
      front(s, y, l, r, 3, h - 11, art.fine);
      for (let z = h - 14; z > 5; z -= 2.5) hair(z);
      break;
  }
}

interface Slot {
  key: string;
  kind: RackKind;
  items: ReactElement[];
}

interface Drawing {
  view: Bounds;
  floors: ReactElement[][];
  rows: Slot[][];
}

/** Lays the racks out in rows, front row first, and sizes a viewBox around all of them. */
function draw(racks: RackCounts): Drawing {
  const kinds = ORDER.flatMap((kind) => Array.from({ length: racks[kind] }, () => kind));
  const rowCount = Math.max(1, Math.ceil(kinds.length / PER_ROW));
  const ext = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (b: Bounds) => {
    if (!Number.isFinite(b.w)) return;
    ext.x0 = Math.min(ext.x0, b.x);
    ext.y0 = Math.min(ext.y0, b.y);
    ext.x1 = Math.max(ext.x1, b.x + b.w);
    ext.y1 = Math.max(ext.y1, b.y + b.h);
  };

  const rows: Slot[][] = [];
  const floors: ReactElement[][] = [];
  for (let row = 0; row < rowCount; row++) {
    const inRow = kinds.slice(row * PER_ROW, (row + 1) * PER_ROW);
    const y0 = -row * ROW_GAP;
    const length = inRow.length * RACK.pitch - (RACK.pitch - RACK.w);

    const floor = new Sketch(art);
    floor.face(
      [
        [-3, y0 - 3, 0],
        [length + 3, y0 - 3, 0],
        [length + 3, y0 + RACK.d + 5, 0],
        [-3, y0 + RACK.d + 5, 0],
      ],
      art.hair,
    );
    grow(floor.bounds());
    floors.push(floor.items);

    rows.push(
      inRow.map((kind, i) => {
        const s = new Sketch(art);
        rack(s, kind, i * RACK.pitch, y0);
        grow(s.bounds());
        return { key: `${row * PER_ROW + i}-${kind}`, kind, items: s.items };
      }),
    );
  }

  let { x0, y0 } = ext;
  let w = ext.x1 - ext.x0 + 2 * PAD;
  let h = ext.y1 - ext.y0 + 2 * PAD;
  x0 -= PAD;
  y0 -= PAD;
  if (w < MIN_VIEW.w) {
    x0 -= (MIN_VIEW.w - w) / 2;
    w = MIN_VIEW.w;
  }
  if (h < MIN_VIEW.h) {
    y0 -= (MIN_VIEW.h - h) / 2;
    h = MIN_VIEW.h;
  }
  return { view: { x: round(x0), y: round(y0), w: round(w), h: round(h) }, floors, rows };
}

function kindAt(target: EventTarget): RackKind | null {
  if (!(target instanceof Element)) return null;
  const zone = target.closest<SVGGElement>("[data-zone]")?.dataset.zone;
  return (zone as RackKind | undefined) ?? null;
}

/**
 * The rented cluster as a line drawing of its racks, in rows of up to
 * sixteen. The configurator's current focus warms up one kind of rack;
 * hovering a rack or a legend chip overrides that until the focus next changes.
 */
export function RackPreview({ focus, quote }: { focus: RackKind | null; quote: RentQuote }): ReactElement {
  const [hovered, setHovered] = useState<RackKind | null>(null);
  const [pinned, setPinned] = useState<RackKind | null>(null);
  const [lastFocus, setLastFocus] = useState(focus);

  if (lastFocus !== focus) {
    setLastFocus(focus);
    setPinned(null);
  }

  const active = hovered ?? pinned ?? focus;
  const { view, floors, rows } = draw(quote.racks);
  const total = quote.totalRacks;

  return (
    <div className={shared.root}>
      <header className={shared.head}>
        <div>
          <p className={shared.eyebrow}>Viewing</p>
          <h2 className={shared.title}>Your cluster</h2>
        </div>
        <div className={shared.count} aria-label={`${total} rack${total === 1 ? "" : "s"}`}>
          <span className={shared.countValue}>
            {total} <span className={styles.countUnit}>rack{total === 1 ? "" : "s"}</span>
          </span>
          <span className={styles.countDetail}>
            {quote.gpus.toLocaleString("en-US")} GPUs · {quote.nodes.toLocaleString("en-US")} nodes
          </span>
        </div>
      </header>

      <div className={shared.figure}>
        <svg
          className={`${art.art} ${styles.art}`}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          aria-hidden="true"
          onPointerMove={(event) => event.pointerType === "mouse" && setHovered(kindAt(event.target))}
          onPointerLeave={(event) => event.pointerType === "mouse" && setHovered(null)}
          onPointerUp={(event) => {
            if (event.pointerType === "mouse") return;
            const kind = kindAt(event.target);
            setPinned(kind === active ? null : kind);
          }}
        >
          {rows
            .map((slots, row) => (
              <g key={row}>
                <g className={styles.floor}>{floors[row]}</g>
                {slots.map((slot) => (
                  <g
                    key={slot.key}
                    className={`${art.layer} ${art.enter}`}
                    data-zone={slot.kind}
                    data-on={slot.kind === active || undefined}
                  >
                    {slot.items}
                  </g>
                ))}
              </g>
            ))
            .reverse()}
        </svg>
      </div>

      <div className={shared.pods} role="group" aria-label="Racks by kind">
        {ORDER.filter((kind) => quote.racks[kind] > 0).map((kind) => (
          <button
            key={kind}
            type="button"
            className={shared.pod}
            aria-pressed={kind === active}
            onMouseEnter={() => setHovered(kind)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setPinned(pinned === kind ? null : kind)}
          >
            <span className={styles.chipCount}>{quote.racks[kind]}</span> {RACK_LABELS[kind]}
          </button>
        ))}
      </div>
    </div>
  );
}
