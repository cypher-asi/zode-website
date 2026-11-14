import { createContext, useContext, useId, type ReactNode } from "react";
import { useDesign } from "@/features/chassis/store";
import { primaryKey, refKeys, type Ref } from "@/features/chassis/model/refs";
import { FILL, HATCH, HOV, HOV_FILL, INK, SEL, SEL_FILL } from "./palette";

export { FILL, HOV, HOV_FILL, INK, SEL, SEL_FILL } from "./palette";

/** Line weights in paper mm. */
export const LW = { hair: 0.12, thin: 0.18, med: 0.25, thick: 0.4, heavy: 0.6 };

/** Dash patterns in paper mm. */
export const DASH = {
  dashed: [1.6, 0.9],
  dotted: [0.3, 0.9],
  dashdot: [2.4, 0.8, 0.4, 0.8],
  fine: [0.8, 0.6],
};

export const LINE_STYLES = {
  fiber: { dash: DASH.dotted, sw: LW.med, label: "NETWORK / STACKED FIBER TRAYS" },
  busway: { dash: null, sw: LW.thick, label: "A / B BUSWAYS" },
  dtc: { dash: DASH.dashdot, sw: LW.med, label: "DTC SUPPLY / RETURN" },
  rdhx: { dash: DASH.dashed, sw: LW.med, label: "REAR-DOOR COOLING" },
} as const;

/* ------------------------------------------------------------------ */
/* View scale                                                          */
/* ------------------------------------------------------------------ */

/** k = paper mm per local unit. Inside a 1:20 view, k = 1/20. */
const ViewCtx = createContext<{ k: number }>({ k: 1 });

export function useK() {
  return useContext(ViewCtx).k;
}

/** Convert paper mm into the current local units. */
export function useP() {
  const k = useK();
  return (paperMm: number) => paperMm / k;
}

export function View({ x, y, scale, children }: { x: number; y: number; scale: number; children: ReactNode }) {
  const parent = useK();
  return (
    <ViewCtx.Provider value={{ k: parent * scale }}>
      <g transform={`translate(${x} ${y}) scale(${scale})`}>{children}</g>
    </ViewCtx.Provider>
  );
}

function dashArray(dash: readonly number[] | null | undefined, k: number) {
  return dash ? dash.map((v) => v / k).join(" ") : undefined;
}

/* ------------------------------------------------------------------ */
/* Hit / selection                                                     */
/* ------------------------------------------------------------------ */

const HitCtx = createContext<{ sel: boolean; hov: boolean }>({ sel: false, hov: false });

export function useHit() {
  return useContext(HitCtx);
}

export function Hit({ children, title, ...ref }: Ref & { children: ReactNode; title?: string }) {
  const derived = useDesign((s) => s.derived);
  const select = useDesign((s) => s.select);
  const setHover = useDesign((s) => s.setHover);
  const keys = refKeys(ref, derived);
  const sel = useDesign((s) => s.selection != null && keys.includes(s.selection));
  const hov = useDesign((s) => s.hover != null && keys.includes(s.hover));
  const key = primaryKey(ref);
  if (!key) return <>{children}</>;
  return (
    <HitCtx.Provider value={{ sel, hov }}>
      <g
        style={{ cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          select(key);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(key);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHover(null);
        }}
      >
        <title>{title ?? key}</title>
        {children}
      </g>
    </HitCtx.Provider>
  );
}

function useColors(fill: string) {
  const { sel, hov } = useHit();
  return {
    stroke: sel ? SEL : hov ? HOV : INK,
    fill:
      fill === "none" ? (sel || hov ? (sel ? SEL_FILL : HOV_FILL) : "none") : sel ? SEL_FILL : hov ? HOV_FILL : fill,
    text: sel ? SEL : INK,
    boost: sel || hov ? 1.8 : 1,
  };
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

export interface TxtProps {
  x: number;
  y: number;
  size?: number;
  anchor?: "start" | "middle" | "end";
  bold?: boolean;
  rotate?: number;
  fill?: string;
  italic?: boolean;
  children: ReactNode;
}

export function Txt({ x, y, size = 1.6, anchor = "start", bold, rotate, fill, italic, children }: TxtProps) {
  const k = useK();
  const c = useColors("none");
  return (
    <text
      x={x}
      y={y}
      fontSize={size / k}
      textAnchor={anchor}
      dominantBaseline="middle"
      fontWeight={bold ? 700 : 400}
      fontStyle={italic ? "italic" : undefined}
      fill={fill ?? c.text}
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      {children}
    </text>
  );
}

/** Centered multi-line label. The first line can be bold. */
export function TextBlock({
  x,
  y,
  lines,
  size = 1.5,
  firstBold = true,
  firstSize,
  anchor = "middle",
  gap = 1.4,
  rotate,
}: {
  x: number;
  y: number;
  lines: string[];
  size?: number;
  firstBold?: boolean;
  firstSize?: number;
  anchor?: "start" | "middle" | "end";
  gap?: number;
  rotate?: number;
}) {
  const k = useK();
  const visible = lines;
  const step = (size * gap) / k;
  const y0 = y - ((visible.length - 1) * step) / 2;
  return (
    <g transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}>
      {visible.map((line, i) => (
        <Txt
          key={i}
          x={x}
          y={y0 + i * step}
          size={i === 0 && firstSize ? firstSize : size}
          bold={i === 0 && firstBold}
          anchor={anchor}
        >
          {line}
        </Txt>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

export type FillKey = keyof typeof FILL;

export interface BoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: FillKey;
  dash?: readonly number[] | null;
  sw?: number;
  rx?: number;
  label?: string[];
  labelSize?: number;
  firstBold?: boolean;
  firstSize?: number;
  labelRotate?: number;
  labelDy?: number;
}

export function Box({
  x,
  y,
  w,
  h,
  fill = "white",
  dash,
  sw = LW.med,
  rx,
  label,
  labelSize = 1.5,
  firstBold = true,
  firstSize,
  labelRotate,
  labelDy = 0,
}: BoxProps) {
  const k = useK();
  const c = useColors(FILL[fill]);
  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={(sw * c.boost) / k}
        strokeDasharray={dashArray(dash, k)}
      />
      {label && label.length > 0 && (
        <TextBlock
          x={x + w / 2}
          y={y + h / 2 + labelDy / k}
          lines={label}
          size={labelSize}
          firstBold={firstBold}
          firstSize={firstSize}
          rotate={labelRotate}
        />
      )}
    </>
  );
}

export function Circle({
  cx,
  cy,
  r,
  fill = "white",
  dash,
  sw = LW.med,
}: {
  cx: number;
  cy: number;
  r: number;
  fill?: FillKey;
  dash?: readonly number[] | null;
  sw?: number;
}) {
  const k = useK();
  const c = useColors(FILL[fill]);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={c.fill}
      stroke={c.stroke}
      strokeWidth={(sw * c.boost) / k}
      strokeDasharray={dashArray(dash, k)}
    />
  );
}

export function Line({
  x1,
  y1,
  x2,
  y2,
  sw = LW.thin,
  dash,
  stroke,
  arrow,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sw?: number;
  dash?: readonly number[] | null;
  stroke?: string;
  arrow?: "end" | "start" | "both";
}) {
  const k = useK();
  const c = useColors("none");
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke ?? c.stroke}
      strokeWidth={(sw * c.boost) / k}
      strokeDasharray={dashArray(dash, k)}
      markerEnd={arrow === "end" || arrow === "both" ? "url(#arrow)" : undefined}
      markerStart={arrow === "start" || arrow === "both" ? "url(#arrow)" : undefined}
    />
  );
}

export function Poly({
  points,
  sw = LW.thin,
  dash,
  arrow,
  fill = "none",
  closed,
}: {
  points: [number, number][];
  sw?: number;
  dash?: readonly number[] | null;
  arrow?: "end" | "start" | "both";
  fill?: FillKey;
  closed?: boolean;
}) {
  const k = useK();
  const c = useColors(FILL[fill]);
  const d = points.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ") + (closed ? " Z" : "");
  return (
    <path
      d={d}
      fill={closed ? c.fill : "none"}
      stroke={c.stroke}
      strokeWidth={(sw * c.boost) / k}
      strokeDasharray={dashArray(dash, k)}
      strokeLinejoin="round"
      markerEnd={arrow === "end" || arrow === "both" ? "url(#arrow)" : undefined}
      markerStart={arrow === "start" || arrow === "both" ? "url(#arrow)" : undefined}
    />
  );
}

/** Rectangle filled with diagonal hatching (wall zones, service panels). */
export function HatchRect({
  x,
  y,
  w,
  h,
  spacing = 1.2,
  angle = 45,
  sw = LW.thin,
  outline = true,
  cross = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  spacing?: number;
  angle?: number;
  sw?: number;
  outline?: boolean;
  cross?: boolean;
}) {
  const k = useK();
  const id = useId().replace(/:/g, "");
  const c = useColors("none");
  const s = spacing / k;
  return (
    <>
      <defs>
        <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
          <rect width={s} height={s} fill={FILL.white} />
          <line x1={0} y1={0} x2={0} y2={s} stroke={HATCH} strokeWidth={LW.hair / k} />
          {cross && <line x1={0} y1={s / 2} x2={s} y2={s / 2} stroke={HATCH} strokeWidth={LW.hair / k} />}
        </pattern>
      </defs>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={`url(#${id})`}
        stroke={outline ? c.stroke : "none"}
        strokeWidth={(sw * c.boost) / k}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Dimensions, callouts, legend                                        */
/* ------------------------------------------------------------------ */

/**
 * Axis-aligned dimension line with architectural ticks.
 * `offset` (paper mm) moves the dimension line away from the measured points; extension lines are drawn back to them.
 */
export function Dim({
  x1,
  y1,
  x2,
  y2,
  text,
  offset = 0,
  size = 1.5,
  textSide = "above",
  bold,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text: string;
  offset?: number;
  size?: number;
  textSide?: "above" | "below";
  bold?: boolean;
}) {
  const k = useK();
  const horizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  const o = offset / k;
  const t = 0.9 / k;
  const sw = LW.hair / k;
  const gap = ((textSide === "above" ? -1 : 1) * (size * 0.9)) / k;
  if (horizontal) {
    const y = Math.min(y1, y2) + o;
    return (
      <g style={{ pointerEvents: "none" }}>
        {o !== 0 && (
          <>
            <line x1={x1} y1={y1} x2={x1} y2={y + Math.sign(o) * t} stroke={INK} strokeWidth={sw} />
            <line x1={x2} y1={y2} x2={x2} y2={y + Math.sign(o) * t} stroke={INK} strokeWidth={sw} />
          </>
        )}
        <line x1={x1 - t} y1={y} x2={x2 + t} y2={y} stroke={INK} strokeWidth={sw} />
        <line x1={x1 - t} y1={y + t} x2={x1 + t} y2={y - t} stroke={INK} strokeWidth={sw * 2} />
        <line x1={x2 - t} y1={y + t} x2={x2 + t} y2={y - t} stroke={INK} strokeWidth={sw * 2} />
        <Txt x={(x1 + x2) / 2} y={y + gap} size={size} anchor="middle" bold={bold}>
          {text}
        </Txt>
      </g>
    );
  }
  const x = Math.min(x1, x2) + o;
  return (
    <g style={{ pointerEvents: "none" }}>
      {o !== 0 && (
        <>
          <line x1={x1} y1={y1} x2={x + Math.sign(o) * t} y2={y1} stroke={INK} strokeWidth={sw} />
          <line x1={x2} y1={y2} x2={x + Math.sign(o) * t} y2={y2} stroke={INK} strokeWidth={sw} />
        </>
      )}
      <line x1={x} y1={y1 - t} x2={x} y2={y2 + t} stroke={INK} strokeWidth={sw} />
      <line x1={x - t} y1={y1 + t} x2={x + t} y2={y1 - t} stroke={INK} strokeWidth={sw * 2} />
      <line x1={x - t} y1={y2 + t} x2={x + t} y2={y2 - t} stroke={INK} strokeWidth={sw * 2} />
      <Txt x={x + gap} y={(y1 + y2) / 2} size={size} anchor="middle" rotate={-90} bold={bold}>
        {text}
      </Txt>
    </g>
  );
}

export function Callout({ x, y, n, r = 2 }: { x: number; y: number; n: number | string; r?: number }) {
  const k = useK();
  return (
    <g>
      <circle cx={x} cy={y} r={r / k} fill={FILL.white} stroke={INK} strokeWidth={LW.med / k} />
      <Txt x={x} y={y + 0.1 / k} size={r * 0.9} anchor="middle" bold>
        {n}
      </Txt>
    </g>
  );
}

export function Legend({
  x,
  y,
  items,
  spacing = 95,
}: {
  x: number;
  y: number;
  items: { label: string; dash: readonly number[] | null; sw: number; swatch?: FillKey }[];
  spacing?: number;
}) {
  return (
    <g>
      {items.map((it, i) => (
        <g key={it.label}>
          {it.swatch ? (
            <Box x={x + i * spacing} y={y - 1.6} w={7} h={3.2} fill={it.swatch} sw={LW.thin} />
          ) : (
            <Line x1={x + i * spacing} y1={y} x2={x + i * spacing + 7} y2={y} sw={it.sw} dash={it.dash} />
          )}
          <Txt x={x + i * spacing + 9} y={y} size={1.3} bold>
            {it.label}
          </Txt>
        </g>
      ))}
    </g>
  );
}

/** Greedy word wrap using an average glyph width of ~0.52 em. */
export function wrapText(text: string, widthPaper: number, size: number): string[] {
  const max = Math.max(8, Math.floor(widthPaper / (size * 0.52)));
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      if ((line + " " + word).trim().length > max) {
        if (line) out.push(line);
        line = word;
      } else line = (line + " " + word).trim();
    }
    out.push(line);
  }
  return out;
}

/** Wrapped paragraph; (x, y) is the first baseline-middle. */
export function Para({
  x,
  y,
  w,
  text,
  size = 1.3,
  bold,
  gap = 1.45,
}: {
  x: number;
  y: number;
  w: number;
  text: string;
  size?: number;
  bold?: boolean;
  gap?: number;
}) {
  const k = useK();
  const lines = wrapText(text, w, size);
  return (
    <g>
      {lines.map((l, i) => (
        <Txt key={i} x={x} y={y + (i * size * gap) / k} size={size} bold={bold}>
          {l}
        </Txt>
      ))}
    </g>
  );
}

export function paraHeight(text: string, w: number, size = 1.3, gap = 1.45) {
  return wrapText(text, w, size).length * size * gap;
}

export function SectionTitle({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <Txt x={x} y={y} size={1.7} bold>
      {children}
    </Txt>
  );
}
