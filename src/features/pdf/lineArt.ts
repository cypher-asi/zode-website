import { LineCapStyle, type Color, type PDFPage } from "pdf-lib";
import { project, round, type P3 } from "@/features/zode-drawings/projection";

/*
 * The site's isometric line drawings for the PDFs: the same dimetric
 * projection, with faces and lines kept in paint order and drawn back to
 * front, each face filled with the page's ground so whatever it sits in front
 * of is hidden, as in the site's drawings.
 */

export type Weight = "edge" | "fine";

interface Mark {
  points: [number, number][];
  /** A face, filled with the ground; otherwise an open line. */
  face: boolean;
  weight: Weight;
  dash: boolean;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Ink {
  ground: Color;
  stroke: Color;
  /** Line widths in points; edges outline solids, fine lines are their detail. */
  edge?: number;
  fine?: number;
}

/** A dash, in points, for leader lines. */
const DASH = [2, 2.5];

export class PdfSketch {
  private readonly marks: Mark[] = [];
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;
  /** Model height everything is drawn up from, set by `at`. */
  private z0 = 0;

  private points(ps: readonly P3[]): [number, number][] {
    return ps.map(([x, y, z = 0]) => {
      const [sx, sy] = project([x, y, z + this.z0]);
      this.minX = Math.min(this.minX, sx);
      this.maxX = Math.max(this.maxX, sx);
      this.minY = Math.min(this.minY, sy);
      this.maxY = Math.max(this.maxY, sy);
      return [sx, sy];
    });
  }

  /** Runs `draw` with everything lifted `z` up. */
  at(z: number, draw: () => void): void {
    const before = this.z0;
    this.z0 += z;
    draw();
    this.z0 = before;
  }

  face(ps: readonly P3[], weight: Weight = "edge"): void {
    this.marks.push({ points: this.points(ps), face: true, weight, dash: false });
  }

  line(ps: readonly P3[], weight: Weight = "fine", dash = false): void {
    this.marks.push({ points: this.points(ps), face: false, weight, dash });
  }

  /** A circle of radius `r` lying flat at `p`, filled as a face unless `open`. */
  disc([x, y, z = 0]: P3, r: number, weight: Weight = "fine", open = false): void {
    const ps: P3[] = Array.from({ length: 40 }, (_, k) => {
      const t = (k / 40) * Math.PI * 2;
      return [x + r * Math.cos(t), y + r * Math.sin(t), z];
    });
    if (open) this.line([...ps, ps[0]], weight);
    else this.face(ps, weight);
  }

  /** Axis-aligned box; only the three faces turned toward the viewer are drawn. */
  box(x0: number, y0: number, w: number, d: number, z0: number, h: number, weight: Weight = "edge"): void {
    const [x1, y1, z1] = [x0 + w, y0 + d, z0 + h];
    this.face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], weight);
    this.face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], weight);
    this.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], weight);
  }

  /** Projected width over height. */
  get aspect(): number {
    return (this.maxX - this.minX) / Math.max(this.maxY - this.minY, 1);
  }

  /** Draws the sketch as large as fits `rect`, centred in it; returns the rect it took. */
  draw(page: PDFPage, rect: Rect, ink: Ink): Rect {
    const width = this.maxX - this.minX;
    const height = this.maxY - this.minY;
    const scale = Math.min(rect.width / width, rect.height / height);
    const left = rect.x + (rect.width - width * scale) / 2;
    const top = rect.y + rect.height - (rect.height - height * scale) / 2;
    const widths: Record<Weight, number> = { edge: ink.edge ?? 0.8, fine: ink.fine ?? 0.45 };
    for (const mark of this.marks) {
      const d = mark.points
        .map(([x, y], i) => `${i ? "L" : "M"}${round((x - this.minX) * scale)},${round((y - this.minY) * scale)}`)
        .join("");
      page.drawSvgPath(mark.face ? `${d}Z` : d, {
        x: left,
        y: top,
        color: mark.face ? ink.ground : undefined,
        borderColor: ink.stroke,
        borderWidth: widths[mark.weight],
        borderDashArray: mark.dash ? DASH : undefined,
        borderLineCap: LineCapStyle.Round,
      });
    }
    return { x: left, y: top - height * scale, width: width * scale, height: height * scale };
  }
}
