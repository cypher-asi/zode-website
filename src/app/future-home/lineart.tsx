import { createElement, type ReactElement, type SVGProps } from "react";

/**
 * Shared helpers for the future-home line drawings: a 2:1 dimetric projection
 * and a `Sketch` that collects SVG elements in paint order while tracking the
 * projected bounds so callers can size a viewBox to fit.
 */

export type P3 = readonly [number, number, number?];

export const round = (n: number) => Math.round(n * 100) / 100;

/** 2:1 dimetric projection; +z is up, +x/+y run toward the viewer's right/left. */
export function project([x, y, z = 0]: P3): [number, number] {
  return [round(x - y), round((x + y) / 2 - z)];
}

/** Maps a model point to screen space; it must keep the +x, +y and +z faces turned toward the viewer. */
export type Projector = (p: P3) => [number, number];

/** Deterministic PRNG so the server and client render identical geometry. */
export function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const backToFront = <T extends { x: number; y: number }>(a: T, b: T) => a.x + a.y - (b.x + b.y);

export interface SketchClasses {
  top: string;
  sideL: string;
  sideR: string;
  edge: string;
  fine: string;
  ink: string;
  ring: string;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Collects SVG elements in paint order. */
export class Sketch {
  readonly items: ReactElement[] = [];
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;

  readonly cls: SketchClasses;
  readonly project: Projector;

  /** `classes` is a CSS module defining every `SketchClasses` name. */
  constructor(classes: Readonly<Record<string, string>>, projector: Projector = project) {
    const { top, sideL, sideR, edge, fine, ink, ring } = classes;
    this.cls = { top, sideL, sideR, edge, fine, ink, ring };
    this.project = projector;
  }

  /** Grows the tracked bounds to include a screen-space rectangle. */
  extend(x: number, y: number, rx = 0, ry = rx): void {
    this.minX = Math.min(this.minX, x - rx);
    this.maxX = Math.max(this.maxX, x + rx);
    this.minY = Math.min(this.minY, y - ry);
    this.maxY = Math.max(this.maxY, y + ry);
  }

  /** Tracked bounds plus `pad` on every side. */
  bounds(pad = 0): Bounds {
    return {
      x: round(this.minX - pad),
      y: round(this.minY - pad),
      w: round(this.maxX - this.minX + 2 * pad),
      h: round(this.maxY - this.minY + 2 * pad),
    };
  }

  private points(ps: readonly P3[]): string {
    return ps
      .map((p) => {
        const [x, y] = this.project(p);
        this.extend(x, y);
        return `${x},${y}`;
      })
      .join(" ");
  }

  face(ps: readonly P3[], className: string): void {
    this.items.push(<polygon key={this.items.length} className={className} points={this.points(ps)} />);
  }

  line(ps: readonly P3[], className: string = this.cls.fine): void {
    this.items.push(<polyline key={this.items.length} className={className} points={this.points(ps)} />);
  }

  path(d: string, className: string = this.cls.fine): void {
    this.items.push(<path key={this.items.length} className={className} d={d} />);
  }

  /** Any other screen-space SVG element (text, flat orthographic shapes). */
  el(tag: string, props: SVGProps<SVGElement>): void {
    this.items.push(createElement(tag, { key: this.items.length, ...props }));
  }

  /** Runs `draw` and wraps everything it adds in one `<g>`. */
  group(props: SVGProps<SVGGElement>, draw: () => void): void {
    const start = this.items.length;
    draw();
    const children = this.items.splice(start);
    this.items.push(
      <g key={`g${start}`} {...props}>
        {children}
      </g>,
    );
  }

  /** A circle of radius `r` lying flat at `p`; its ellipse proportions assume the default dimetric projection. */
  disc(p: P3, r: number, className: string): void {
    const [cx, cy] = this.project(p);
    const rx = round(r * Math.SQRT2);
    const ry = round(rx / 2);
    this.extend(cx, cy, rx, ry);
    this.items.push(<ellipse key={this.items.length} className={className} cx={cx} cy={cy} rx={rx} ry={ry} />);
  }

  /** A circle of radius `r` centred at `c`, standing in the plane facing +x ("yz") or +y ("xz"). */
  wheel(c: P3, r: number, plane: "xz" | "yz", className: string): void {
    const [x, y, z = 0] = c;
    const ps: P3[] = [];
    for (let k = 0; k < 48; k++) {
      const t = (k / 48) * Math.PI * 2;
      const u = r * Math.cos(t);
      const v = r * Math.sin(t);
      ps.push(plane === "xz" ? [x + u, y, z + v] : [x, y + u, z + v]);
    }
    this.face(ps, className);
  }

  /** Axis-aligned box; only the three faces turned toward the viewer are drawn. */
  box(
    x0: number,
    y0: number,
    w: number,
    d: number,
    z0: number,
    h: number,
    faces: Pick<SketchClasses, "top" | "sideL" | "sideR"> = this.cls,
  ): void {
    const [x1, y1, z1] = [x0 + w, y0 + d, z0 + h];
    this.face(
      [
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x1, y0, z1],
      ],
      faces.sideR,
    );
    this.face(
      [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      faces.sideL,
    );
    this.face(
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      faces.top,
    );
  }
}
