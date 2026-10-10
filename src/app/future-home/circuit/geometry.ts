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
}

/**
 * A 1px hairline; `x`/`y` are the top-left pixel. A `rotate`d trace turns
 * about the middle of its left end.
 */
export interface Trace {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly tone: Tone;
  readonly rotate?: number;
}

/** A junction pad centered on pixel (`x`, `y`) that lights up `at` ms into each cycle. */
export interface Pad {
  readonly x: number;
  readonly y: number;
  readonly tone: Tone;
  readonly at: number;
}

/**
 * A path a pulse runs along, entering at `start` ms into each cycle. The pulse
 * is only drawn between page rows `clipTop` and `clipBottom`, so a rail's
 * pulse is split into one copy per surface it crosses, each in that surface's
 * tone, and switches color exactly at the boundary.
 */
export interface Route {
  readonly d: string;
  readonly length: number;
  readonly start: number;
  readonly tone: Tone;
  readonly clipTop: number;
  readonly clipBottom: number;
}

export interface Circuit {
  readonly height: number;
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

/**
 * Rail segments down column `x`, one per surface it crosses, toned to match.
 * `lift` moves a surface boundary to where it actually shows in that column.
 */
function rail(
  surfaces: readonly Surface[],
  x: number,
  end: number,
  lift: (y: number) => number,
): Trace[] {
  const crossed = surfaces
    .filter((s) => x >= s.left && x < s.right)
    .sort((a, b) => a.top - b.top);
  const traces: Trace[] = [];
  let y = 0;
  for (const s of crossed) {
    const top = Math.max(y, lift(Math.round(s.top)));
    const bottom = Math.min(end, lift(Math.round(s.bottom)));
    if (bottom <= top) continue;
    traces.push({ x, y: top, width: 1, height: bottom - top, tone: s.tone });
    y = bottom;
  }
  return traces;
}

/**
 * Lays out the page frame: a rail `inset` px in from each side, a trace across
 * every block boundary in `seams` plus one closing the bottom, a pad at each
 * junction, and a trace down the hero split. Each block below the first rises
 * `step` px over one half of the one above it through a 45° jog at the center,
 * alternating left, right, left down the page (see `.page > [data-circuit] +
 * [data-circuit]` in page.module.css), so each seam trace runs `step` px above
 * the boundary on the risen side. The first rises on the left, so the hero
 * split runs straight into the jog's upper corner.
 *
 * A pulse leaves the top of each rail (and of the hero split) at once and runs
 * down; as it passes each seam a pair of pulses leaves both rails and meets in
 * the middle of the jog.
 */
export function buildCircuit(
  width: number,
  height: number,
  inset: number,
  step: number,
  seams: readonly number[],
  surfaces: readonly Surface[],
  hero: HeroSeam | null,
): Circuit {
  const left = Math.round(inset);
  const right = Math.round(width - inset) - 1;
  const bottom = Math.round(height - inset) - 1;
  const rise = Math.round(step);
  const jog = Math.round(width / 2 - step / 2);
  const across = seams
    .map((y, index) => {
      const at = Math.round(y);
      const risesLeft = index % 2 === 0;
      return { at, left: risesLeft ? at - rise : at, right: risesLeft ? at : at - rise };
    })
    .filter(({ at }) => at > rise && at < bottom);
  const liftOn = (side: "left" | "right") => (y: number) =>
    across.find((seam) => seam.at === y)?.[side] ?? y;

  const crossingTone = (y: number) => toneAt(surfaces, left, y);
  const traces: Trace[] = [
    ...rail(surfaces, left, bottom, liftOn("left")),
    ...rail(surfaces, right, bottom, liftOn("right")),
    ...across.flatMap((seam) => {
      const tone = crossingTone(seam.at);
      return [
        { x: left, y: seam.left, width: jog - left, height: 1, tone },
        {
          x: jog,
          y: seam.left,
          width: rise * Math.SQRT2,
          height: 1,
          tone,
          rotate: seam.right > seam.left ? 45 : -45,
        },
        { x: jog + rise, y: seam.right, width: right - jog - rise + 1, height: 1, tone },
      ];
    }),
    { x: left, y: bottom, width: right - left + 1, height: 1, tone: crossingTone(bottom) },
  ];

  const pads: Pad[] = [
    ...across.flatMap((seam) => {
      const tone = crossingTone(seam.at);
      return [
        { x: left, y: seam.left, tone, at: seam.left / PULSE_SPEED },
        { x: right, y: seam.right, tone, at: seam.right / PULSE_SPEED },
      ];
    }),
    { x: left, y: bottom, tone: crossingTone(bottom), at: bottom / PULSE_SPEED },
    { x: right, y: bottom, tone: crossingTone(bottom), at: bottom / PULSE_SPEED },
  ];

  const railRoutes = (x: number, lift: (y: number) => number): Route[] =>
    rail(surfaces, x, bottom, lift).map((segment) => ({
      d: `M${x + 0.5} 0V${bottom + 0.5}`,
      length: bottom,
      start: 0,
      tone: segment.tone,
      clipTop: segment.y,
      clipBottom: segment.y + segment.height,
    }));
  const half = (rise / 2) * Math.SQRT2;
  const meetX = jog + rise / 2;
  const routes: Route[] = [
    ...railRoutes(left, liftOn("left")),
    ...railRoutes(right, liftOn("right")),
    ...across.flatMap((seam) => {
      const tone = crossingTone(seam.at);
      const meetY = (seam.left + seam.right) / 2 + 0.5;
      return [
        {
          d: `M${left + 0.5} ${seam.left + 0.5}H${jog}L${meetX} ${meetY}`,
          length: jog - left - 0.5 + half,
          start: seam.left / PULSE_SPEED,
          tone,
          clipTop: 0,
          clipBottom: height,
        },
        {
          d: `M${right + 0.5} ${seam.right + 0.5}H${jog + rise}L${meetX} ${meetY}`,
          length: right + 0.5 - jog - rise + half,
          start: seam.right / PULSE_SPEED,
          tone,
          clipTop: 0,
          clipBottom: height,
        },
      ];
    }),
    ...[left, right].map((x) => ({
      d: `M${x + 0.5} ${bottom + 0.5}H${width / 2}`,
      length: Math.abs(width / 2 - x - 0.5),
      start: bottom / PULSE_SPEED,
      tone: crossingTone(bottom),
      clipTop: 0,
      clipBottom: height,
    })),
  ];

  if (hero) {
    const { x, top, height: h } = hero;
    const jogTop = top + h / 2 - step / 2;
    const landing = across.find((seam) => seam.at === Math.round(top + h));
    const end = landing ? landing.left : top + h;
    const length = end - top - step + step * Math.SQRT2;
    routes.push({
      d: `M${x} ${top}V${jogTop}L${x - step} ${jogTop + step}V${end}`,
      length,
      start: top / PULSE_SPEED,
      tone: toneAt(surfaces, x - step - 1, top),
      clipTop: 0,
      clipBottom: height,
    });
    if (landing) {
      pads.push({
        x: jog,
        y: end,
        tone: crossingTone(landing.at),
        at: (top + length) / PULSE_SPEED,
      });
    }
  }

  const lastLanding = Math.max(...routes.map((r) => r.start + r.length / PULSE_SPEED));
  return { height, traces, pads, routes, cycle: lastLanding + REST };
}
