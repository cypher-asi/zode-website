export type Tone = "light" | "dark";

/** A `data-surface` region of the page, in px relative to the page's top-left. */
export interface Surface {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly tone: Tone;
}

/** The hero's jogged split (see `.left` in page.module.css), in page px. */
export interface HeroSeam {
  /** Right edge of the white panel above the jog. */
  readonly x: number;
  readonly top: number;
  readonly height: number;
  /** Width and height of the 45° jog. */
  readonly step: number;
}

/** A 1px hairline; `x`/`y` are the top-left pixel. */
export interface Trace {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly tone: Tone;
}

/** A junction pad centered on pixel (`x`, `y`) that lights up `at` ms into each cycle. */
export interface Pad {
  readonly x: number;
  readonly y: number;
  readonly tone: Tone;
  readonly at: number;
}

/** A path a pulse runs along, entering at `start` ms into each cycle. */
export interface Route {
  readonly d: string;
  readonly length: number;
  readonly start: number;
}

export interface Circuit {
  readonly traces: readonly Trace[];
  readonly pads: readonly Pad[];
  readonly routes: readonly Route[];
  /** Length of one full pulse cycle, rest included, in ms. */
  readonly cycle: number;
}

/** Pulse speed in px per ms. */
export const PULSE_SPEED = 1.4;
/** Length of the glowing pulse in px. */
export const PULSE_LENGTH = 64;
/** Pause after the last pulse lands before the next cycle starts, in ms. */
const REST = 2500;

function toneAt(surfaces: readonly Surface[], x: number, y: number): Tone {
  const hit = surfaces.find((s) => x >= s.left && x < s.right && y >= s.top && y < s.bottom);
  return hit?.tone ?? "dark";
}

/** Rail segments down column `x`, one per surface it crosses, toned to match. */
function rail(surfaces: readonly Surface[], x: number, end: number): Trace[] {
  const crossed = surfaces
    .filter((s) => x >= s.left && x < s.right)
    .sort((a, b) => a.top - b.top);
  const traces: Trace[] = [];
  let y = 0;
  for (const s of crossed) {
    const top = Math.max(y, Math.round(s.top));
    const bottom = Math.min(end, Math.round(s.bottom));
    if (bottom <= top) continue;
    traces.push({ x, y: top, width: 1, height: bottom - top, tone: s.tone });
    y = bottom;
  }
  return traces;
}

/**
 * Lays out the page frame: a rail `inset` px in from each side, a trace across
 * every block boundary in `seams` plus one closing the bottom, a pad at each
 * junction, and a trace down the hero split. A pulse leaves the top of each
 * rail (and of the hero split) at once and runs down; as it passes each seam a
 * pair of pulses leaves both rails and meets in the middle.
 */
export function buildCircuit(
  width: number,
  height: number,
  inset: number,
  seams: readonly number[],
  surfaces: readonly Surface[],
  hero: HeroSeam | null,
): Circuit {
  const left = Math.round(inset);
  const right = Math.round(width - inset) - 1;
  const bottom = Math.round(height - inset) - 1;
  const middle = width / 2;
  const across = [...seams.map(Math.round).filter((y) => y > 0 && y < bottom), bottom];

  const traces: Trace[] = [
    ...rail(surfaces, left, bottom),
    ...rail(surfaces, right, bottom),
    ...across.map((y) => ({
      x: left,
      y,
      width: right - left + 1,
      height: 1,
      tone: toneAt(surfaces, left, y),
    })),
  ];

  const pads: Pad[] = across.flatMap((y) => {
    const tone = toneAt(surfaces, left, y);
    const at = y / PULSE_SPEED;
    return [
      { x: left, y, tone, at },
      { x: right, y, tone, at },
    ];
  });

  const railLength = bottom;
  const routes: Route[] = [
    { d: `M${left + 0.5} 0V${bottom + 0.5}`, length: railLength, start: 0 },
    { d: `M${right + 0.5} 0V${bottom + 0.5}`, length: railLength, start: 0 },
    ...across.flatMap((y) => {
      const start = y / PULSE_SPEED;
      const length = middle - left - 0.5;
      return [
        { d: `M${left + 0.5} ${y + 0.5}H${middle}`, length, start },
        { d: `M${right + 0.5} ${y + 0.5}H${middle}`, length, start },
      ];
    }),
  ];

  if (hero) {
    const { x, top, height: h, step } = hero;
    const jogTop = top + h / 2 - step / 2;
    const end = top + h;
    routes.push({
      d: `M${x} ${top}V${jogTop}L${x - step} ${jogTop + step}V${end}`,
      length: h - step + step * Math.SQRT2,
      start: top / PULSE_SPEED,
    });
    const landing = Math.round(end);
    if (across.includes(landing)) {
      pads.push({
        x: Math.round(x - step),
        y: landing,
        tone: toneAt(surfaces, x - step, landing),
        at: (top + h - step + step * Math.SQRT2) / PULSE_SPEED,
      });
    }
  }

  const lastLanding = Math.max(...routes.map((r) => r.start + r.length / PULSE_SPEED));
  return { traces, pads, routes, cycle: lastLanding + REST };
}
