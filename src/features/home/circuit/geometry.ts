export type Tone = "light" | "dark";

/** A `data-surface` region of the page, in px relative to the page's top-left. */
export interface Surface {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly tone: Tone;
}

/** The hero split while its panels sit side by side, in page px. */
export interface Split {
  /** Right edge of the white panel. */
  readonly x: number;
  readonly top: number;
  readonly bottom: number;
}

/** A 1px hairline; `x`/`y` are the top-left pixel. */
export interface Trace {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly tone: Tone;
}

/** A junction pad centered on pixel (`x`, `y`); `node` names the junction it sits on. */
export interface Pad {
  readonly x: number;
  readonly y: number;
  readonly tone: Tone;
  readonly node: string;
}

/** Page rectangle in which a pulse is drawn in `tone`. */
export interface Band {
  readonly tone: Tone;
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

/**
 * One directed stretch of trace between two junctions that a pulse can run
 * along. The pulse is drawn once per band, each clipped to its rectangle, so
 * it switches color exactly where it crosses into another surface.
 * `top`/`bottom` bound the stretch vertically, for on-screen checks.
 */
export interface Edge {
  /** Start of the run at the trace's pixel centre, in page px. */
  readonly x: number;
  readonly y: number;
  /** Direction of travel: one of the four axis-aligned unit vectors. */
  readonly dx: number;
  readonly dy: number;
  readonly length: number;
  readonly from: string;
  readonly to: string;
  readonly top: number;
  readonly bottom: number;
  readonly bands: readonly Band[];
}

export interface Circuit {
  readonly width: number;
  readonly height: number;
  readonly traces: readonly Trace[];
  readonly pads: readonly Pad[];
  readonly edges: readonly Edge[];
}

/** Pulse speed in px per ms. */
export const PULSE_SPEED = 2;
/** Length of the glowing pulse in px. */
export const PULSE_LENGTH = 44;

const node = (x: number, y: number) => `${x},${y}`;

function toneAt(surfaces: readonly Surface[], x: number, y: number): Tone {
  const hit = surfaces.find((s) => x >= s.left && x < s.right && y >= s.top && y < s.bottom);
  return hit?.tone ?? "dark";
}

/** Segments down column `x` from `top` to `end`, one per surface it crosses, toned to match. */
function column(surfaces: readonly Surface[], x: number, top: number, end: number): Trace[] {
  const crossed = surfaces
    .filter((s) => x >= Math.round(s.left) && x < Math.round(s.right))
    .sort((a, b) => a.top - b.top);
  const traces: Trace[] = [];
  let y = top;
  for (const s of crossed) {
    const from = Math.max(y, Math.round(s.top));
    const to = Math.min(end, Math.round(s.bottom));
    if (to <= from) continue;
    traces.push({ x, y: from, width: 1, height: to - from, tone: s.tone });
    y = to;
  }
  return traces;
}

/** Segments along row `y` from column `from` through `to`, one per surface it crosses. */
function row(surfaces: readonly Surface[], y: number, from: number, to: number): Trace[] {
  const crossed = surfaces
    .filter((s) => y >= Math.round(s.top) && y < Math.round(s.bottom))
    .sort((a, b) => a.left - b.left);
  const traces: Trace[] = [];
  let x = from;
  for (const s of crossed) {
    const start = Math.max(x, Math.round(s.left));
    const stop = Math.min(to + 1, Math.round(s.right));
    if (stop <= start) continue;
    traces.push({ x: start, y, width: stop - start, height: 1, tone: s.tone });
    x = stop;
  }
  return traces;
}

/**
 * Lays out the page frame as a straight grid: a rail `inset` px in from each
 * side, a full-width trace at each row in `rules` plus one closing the bottom,
 * a trace down the hero split along the white panel's last column, and a pad
 * wherever a row meets a rail or the split.
 *
 * Pulses run down the rails and the split, and both ways along each row.
 */
export function buildCircuit(
  width: number,
  height: number,
  inset: number,
  rules: readonly number[],
  surfaces: readonly Surface[],
  split: Split | null,
): Circuit {
  const left = Math.round(inset);
  const right = Math.round(width - inset) - 1;
  const bottom = Math.round(height - inset) - 1;
  const rows = [...new Set(rules.map(Math.round))]
    .filter((y) => y > 0 && y < bottom)
    .sort((a, b) => a - b)
    .concat(bottom);
  const snap = (y: number) => rows.find((r) => Math.abs(r - y) <= 1) ?? Math.round(y);

  const verticals = [
    { x: left, top: 0, end: bottom, segments: column(surfaces, left, 0, bottom) },
    { x: right, top: 0, end: bottom, segments: column(surfaces, right, 0, bottom) },
  ];
  if (split) {
    const x = Math.round(split.x) - 1;
    const top = Math.round(split.top);
    const end = snap(split.bottom);
    const tone = toneAt(surfaces, x, top);
    verticals.push({
      x,
      top,
      end,
      segments: [{ x, y: top, width: 1, height: end - top, tone }],
    });
  }
  const horizontals = rows.map((y) => ({ y, segments: row(surfaces, y, left, right) }));

  const traces: Trace[] = [
    ...verticals.flatMap((line) => line.segments),
    ...horizontals.flatMap((line) => line.segments),
  ];

  const crossings = (y: number) =>
    [...new Set(verticals.filter((v) => y > v.top && y <= v.end).map((v) => v.x))].sort(
      (a, b) => a - b,
    );
  const pads: Pad[] = rows.flatMap((y) =>
    crossings(y).map((x) => ({ x, y, tone: toneAt(surfaces, x, y), node: node(x, y) })),
  );

  const edges: Edge[] = [];
  const page = (tone: Tone): Band => ({ tone, top: 0, bottom: height, left: 0, right: width });

  for (const { x, top, end, segments } of verticals) {
    const stops = [...new Set([top, ...rows.filter((y) => y > top && y < end), end])];
    for (let i = 1; i < stops.length; i++) {
      const [a, b] = [stops[i - 1], stops[i]];
      // Include the surface above so the pulse's trailing tail still shows past the junction.
      const bands = segments
        .filter((s) => s.y < b && s.y + s.height > a - PULSE_LENGTH)
        .map((s) => ({ tone: s.tone, top: s.y, bottom: s.y + s.height, left: 0, right: width }));
      edges.push({
        x: x + 0.5,
        y: a + 0.5,
        dx: 0,
        dy: 1,
        length: b - a,
        from: node(x, a),
        to: node(x, b),
        top: a,
        bottom: b,
        bands,
      });
    }
  }

  for (const { y, segments } of horizontals) {
    // The outermost bands run to the page edges so a tail past either rail still shows.
    const strip = segments.map((s, i) => ({
      tone: s.tone,
      top: 0,
      bottom: height,
      left: i === 0 ? 0 : s.x,
      right: i === segments.length - 1 ? width : s.x + s.width,
    }));
    const stops = crossings(y);
    for (let i = 1; i < stops.length; i++) {
      const [a, b] = [stops[i - 1], stops[i]];
      const near = strip.filter((s) => s.left < b + PULSE_LENGTH && s.right > a - PULSE_LENGTH);
      const bands = near.length > 0 ? near : [page(toneAt(surfaces, a, y))];
      const run = { y: y + 0.5, dy: 0, length: b - a, top: y, bottom: y, bands };
      edges.push({ ...run, x: a + 0.5, dx: 1, from: node(a, y), to: node(b, y) });
      edges.push({ ...run, x: b + 0.5, dx: -1, from: node(b, y), to: node(a, y) });
    }
  }

  return { width, height, traces, pads, edges };
}
