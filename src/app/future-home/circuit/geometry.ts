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

/** A junction pad centered on pixel (`x`, `y`); `node` names the junction it sits on. */
export interface Pad {
  readonly x: number;
  readonly y: number;
  readonly tone: Tone;
  readonly node: string;
}

/** Page rows `top` to `bottom` in which a pulse is drawn in `tone`. */
export interface Band {
  readonly tone: Tone;
  readonly top: number;
  readonly bottom: number;
}

/**
 * One directed stretch of trace between two junctions that a pulse can run
 * along. The pulse is drawn once per band, each clipped to its rows, so on a
 * rail it switches color exactly where it crosses into another surface.
 * `top`/`bottom` bound the stretch vertically, for on-screen checks.
 */
export interface Edge {
  readonly d: string;
  readonly length: number;
  readonly from: string;
  readonly to: string;
  readonly top: number;
  readonly bottom: number;
  readonly bands: readonly Band[];
}

export interface Circuit {
  readonly height: number;
  readonly traces: readonly Trace[];
  readonly corners: readonly Corner[];
  readonly pads: readonly Pad[];
  readonly edges: readonly Edge[];
}

/** Pulse speed in px per ms. */
export const PULSE_SPEED = 1.2;
/** Length of the glowing pulse in px. */
export const PULSE_LENGTH = 64;

const node = (x: number, y: number) => `${x},${y}`;

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
 * Pulses run along `edges`: rails downward between junctions, and each seam
 * in both directions as two stretches meeting at the jog's left corner.
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
  const leftRail = rail(surfaces, left, bottom, liftOn("left"));
  const rightRail = rail(surfaces, right, bottom, liftOn("right"));
  const traces: Trace[] = [
    ...leftRail,
    ...rightRail,
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

  const pad = (x: number, y: number, tone: Tone): Pad => ({ x, y, tone, node: node(x, y) });
  const pads: Pad[] = [
    ...across.flatMap((seam) => {
      const tone = crossingTone(seam.at);
      return [pad(left, seam.left, tone), pad(right, seam.right, tone)];
    }),
    pad(left, bottom, crossingTone(bottom)),
    pad(right, bottom, crossingTone(bottom)),
  ];

  const edges: Edge[] = [];
  const page = (tone: Tone): Band[] => [{ tone, top: 0, bottom: height }];
  /** Adds the stretch from `a` to `b` and, given `back`, the reverse too. */
  const link = (
    a: string,
    b: string,
    d: string,
    back: string | null,
    length: number,
    top: number,
    bottom: number,
    bands: readonly Band[],
  ) => {
    edges.push({ d, length, from: a, to: b, top, bottom, bands });
    if (back) edges.push({ d: back, length, from: b, to: a, top, bottom, bands });
  };

  for (const [x, segments, side] of [
    [left, leftRail, "left"],
    [right, rightRail, "right"],
  ] as const) {
    const stops = [0, ...across.map((seam) => seam[side]), bottom];
    for (let i = 1; i < stops.length; i++) {
      const [a, b] = [stops[i - 1], stops[i]];
      // Include the surface above so the pulse's trailing tail still shows past the junction.
      const bands = segments
        .filter((s) => s.y < b && s.y + s.height > a - PULSE_LENGTH)
        .map((s) => ({ tone: s.tone, top: s.y, bottom: s.y + s.height }));
      link(node(x, a), node(x, b), `M${x + 0.5} ${a + 0.5}V${b + 0.5}`, null, b - a, a, b, bands);
    }
  }

  for (const seam of across) {
    const bands = page(crossingTone(seam.at));
    const corner = node(jog, seam.left);
    const [l, r] = [seam.left + 0.5, seam.right + 0.5];
    link(
      node(left, seam.left),
      corner,
      `M${left + 0.5} ${l}H${jog}`,
      `M${jog} ${l}H${left + 0.5}`,
      jog - left - 0.5,
      seam.left,
      seam.left,
      bands,
    );
    link(
      corner,
      node(right, seam.right),
      `M${jog} ${l}L${jog + rise} ${r}H${right + 0.5}`,
      `M${right + 0.5} ${r}H${jog + rise}L${jog} ${l}`,
      rise * Math.SQRT2 + right + 0.5 - jog - rise,
      Math.min(seam.left, seam.right),
      Math.max(seam.left, seam.right),
      bands,
    );
  }

  link(
    node(left, bottom),
    node(right, bottom),
    `M${left + 0.5} ${bottom + 0.5}H${right + 0.5}`,
    `M${right + 0.5} ${bottom + 0.5}H${left + 0.5}`,
    right - left,
    bottom,
    bottom,
    page(crossingTone(bottom)),
  );

  if (hero) {
    const { x, top, height: h } = hero;
    const jogTop = top + h / 2 - step / 2;
    const landing = across.find((seam) => seam.at === Math.round(top + h));
    const end = landing ? landing.left : top + h;
    if (landing) pads.push(pad(jog, end, crossingTone(landing.at)));
    link(
      node(Math.round(x), Math.round(top)),
      landing ? node(jog, end) : node(Math.round(x - step), Math.round(end)),
      `M${x} ${top}V${jogTop}L${x - step} ${jogTop + step}V${end}`,
      null,
      end - top - step + step * Math.SQRT2,
      top,
      end,
      page(toneAt(surfaces, x - step - 1, top)),
    );
  }

  return { height, traces, pads, edges };
}
