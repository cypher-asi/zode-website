import { Box, Circle, INK, Line, LW, Txt, useK } from "./core";
import { FILL } from "@/features/chassis/drawing/palette";

/** SLD breaker: square with a diagonal contact stroke. (x, y) = centre. */
export function Breaker({ x, y, s = 3.6 }: { x: number; y: number; s?: number }) {
  const k = useK();
  const h = s / 2 / k;
  return (
    <g>
      <Box x={x - h} y={y - h} w={2 * h} h={2 * h} fill="white" sw={LW.med} />
      <Line x1={x - h * 0.65} y1={y + h * 0.65} x2={x + h * 0.65} y2={y - h * 0.65} sw={LW.med} />
    </g>
  );
}

export function Ground({ x, y }: { x: number; y: number }) {
  const k = useK();
  const u = 1 / k;
  return (
    <g stroke={INK} strokeWidth={LW.thin / k}>
      <line x1={x} y1={y} x2={x} y2={y + 2 * u} />
      <line x1={x - 2 * u} y1={y + 2 * u} x2={x + 2 * u} y2={y + 2 * u} />
      <line x1={x - 1.3 * u} y1={y + 2.8 * u} x2={x + 1.3 * u} y2={y + 2.8 * u} />
      <line x1={x - 0.6 * u} y1={y + 3.6 * u} x2={x + 0.6 * u} y2={y + 3.6 * u} />
    </g>
  );
}

export function Dot({ x, y, r = 0.45 }: { x: number; y: number; r?: number }) {
  const k = useK();
  return <circle cx={x} cy={y} r={r / k} fill={INK} />;
}

export function Pump({ cx, cy, r = 2.4, n }: { cx: number; cy: number; r?: number; n: number | string }) {
  return (
    <g>
      <Circle cx={cx} cy={cy} r={r} fill="light" sw={LW.med} />
      <Txt x={cx} y={cy} size={r * 0.75} anchor="middle" bold>
        {n}
      </Txt>
    </g>
  );
}

export function TagBox({
  x,
  y,
  w,
  h,
  label,
  size = 1.05,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  size?: number;
}) {
  return (
    <g>
      <Box x={x} y={y} w={w} h={h} fill="white" sw={LW.thin} />
      <Txt x={x + w / 2} y={y + h / 2} size={size} anchor="middle" bold>
        {label}
      </Txt>
    </g>
  );
}

/** Two-way valve "bow tie". (x, y) = centre. */
export function Valve({ x, y, s = 2 }: { x: number; y: number; s?: number }) {
  const k = useK();
  const u = s / k;
  return (
    <path
      d={`M${x - u} ${y - u * 0.6} L${x + u} ${y + u * 0.6} L${x + u} ${y - u * 0.6} L${x - u} ${y + u * 0.6} Z`}
      fill={FILL.white}
      stroke={INK}
      strokeWidth={LW.thin / k}
    />
  );
}

/** Duty / standby pump pair with isolation and check valves on each branch. */
export function PumpPair({
  x,
  y,
  w,
  h,
  labels,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  labels: [string, string];
}) {
  const midY1 = y + h * 0.36;
  const midY2 = y + h * 0.7;
  const inX = x + 3;
  const outX = x + w - 3;
  return (
    <g>
      {[midY1, midY2].map((my, i) => (
        <g key={i}>
          <Line x1={inX} y1={my} x2={outX} y2={my} sw={LW.thin} />
          <TagBox x={x + w * 0.14} y={my - 1.6} w={5} h={3.2} label="IV" size={0.9} />
          <Pump cx={x + w / 2} cy={my} n={labels[i]} />
          <TagBox x={x + w * 0.74} y={my - 1.6} w={6} h={3.2} label="CV/IV" size={0.85} />
        </g>
      ))}
      <Line x1={inX} y1={midY1} x2={inX} y2={midY2} sw={LW.thin} />
      <Line x1={outX} y1={midY1} x2={outX} y2={midY2} sw={LW.thin} />
    </g>
  );
}
