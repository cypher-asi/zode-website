import type { Placement, Pod } from "@/features/chassis/model/schema";
import type { Derived } from "@/features/chassis/model/calc";
import { dimsText, fmtN, tpl } from "@/features/chassis/model/format";
import { Box, Circle, DASH, HatchRect, Hit, LW, TextBlock, Txt, useK, type FillKey } from "./core";
import { FILL, INK } from "@/features/chassis/drawing/palette";

const STYLE_FILL: Record<Placement["style"], FillKey> = {
  solid: "white",
  dashed: "white",
  light: "light",
  dark: "dark",
};

/** Resolve placement size: explicit w/d, else part dims (via BOM or part ref). */
export function placementSize(p: Placement, d: Derived) {
  const part = d.partsById.get(p.part ?? d.bomById.get(p.bom ?? "")?.partId ?? "");
  const w = p.w ?? part?.dims?.w ?? 500;
  const dd = p.d ?? (p.shape === "circle" ? w : (part?.dims?.d ?? 500));
  return { w, d: dd, part };
}

export function placementLabel(p: Placement, d: Derived) {
  const { w, d: dd, part } = placementSize(p, d);
  const vars = { ...d.vars, dims: dimsText(part?.dims), w: fmtN(w), d: fmtN(dd) };
  return p.label.map((l) => tpl(l, vars));
}

export function PlacementShape({
  p,
  d,
  labelSize = 1.35,
  showLabel = true,
  labelOverride,
}: {
  p: Placement;
  d: Derived;
  labelSize?: number;
  showLabel?: boolean;
  labelOverride?: string[];
}) {
  const { w, d: dd } = placementSize(p, d);
  const label = labelOverride ?? (showLabel ? placementLabel(p, d) : []);
  const dash = p.style === "dashed" ? DASH.fine : null;
  const fill = STYLE_FILL[p.style];
  const body =
    p.shape === "circle" ? (
      <>
        <Circle cx={p.x} cy={p.y} r={w / 2} fill={fill} dash={dash} />
        {p.style === "light" && <Circle cx={p.x} cy={p.y} r={w / 2 - 60} fill="none" sw={LW.hair} />}
        {label.length > 0 && <TextBlock x={p.x} y={p.y} lines={label} size={labelSize} />}
      </>
    ) : (
      <Box x={p.x} y={p.y} w={w} h={dd} fill={fill} dash={dash} label={label} labelSize={labelSize} />
    );
  return p.bom || p.part ? (
    <Hit bom={p.bom} part={p.part} title={label[0] || p.id}>
      {body}
    </Hit>
  ) : (
    <g>{body}</g>
  );
}

/**
 * Pod outline in real mm: overall body, 150 mm hatched wall zone (100 core + 50 frame),
 * optional service panels, and interior partitions. Children draw in interior coordinates
 * (origin at the inner face of the wall zone).
 */
export function PodShell({
  pod,
  wall,
  length,
  width,
  panels = 0,
  children,
  selectableShell = true,
}: {
  pod: Pod;
  wall: number;
  length: number;
  width: number;
  panels?: number;
  children?: React.ReactNode;
  selectableShell?: boolean;
}) {
  const k = useK();
  const clearL = length - 2 * wall;
  const clearW = width - 2 * wall;
  const panelW = panels ? clearL / panels : 0;
  const outline = (
    <>
      <Box x={0} y={0} w={length} h={width} fill="white" sw={LW.thick} />
      <HatchRect x={0} y={0} w={length} h={wall} spacing={1.1} outline={false} />
      <HatchRect x={0} y={width - wall} w={length} h={wall} spacing={1.1} outline={false} />
      <HatchRect x={0} y={wall} w={wall} h={clearW} spacing={1.1} outline={false} />
      <HatchRect x={length - wall} y={wall} w={wall} h={clearW} spacing={1.1} outline={false} />
      <Box x={wall} y={wall} w={clearL} h={clearW} fill="white" sw={LW.med} />
      {[0, length - wall].flatMap((x) =>
        [0, width - wall].map((y) => <Box key={`${x}-${y}`} x={x} y={y} w={wall} h={wall} fill="mid" sw={LW.thin} />),
      )}
    </>
  );
  return (
    <g>
      {selectableShell ? <Hit bom={pod.shellBom}>{outline}</Hit> : outline}
      {panels > 0 &&
        Array.from({ length: panels }, (_, i) =>
          [
            { y: 0, prefix: "F" },
            { y: width - wall, prefix: "R" },
          ].map(({ y, prefix }) => (
            <g key={`${prefix}${i}`}>
              <rect
                x={wall + i * panelW}
                y={y}
                width={panelW}
                height={wall}
                fill="none"
                stroke={INK}
                strokeWidth={LW.thin / k}
              />
              <rect
                x={wall + i * panelW + panelW * 0.3}
                y={y + wall * 0.2}
                width={panelW * 0.4}
                height={wall * 0.6}
                fill={FILL.white}
              />
              <Txt x={wall + i * panelW + panelW / 2} y={y + wall / 2} size={1} anchor="middle" bold>
                {`${prefix}${String(i + 1).padStart(2, "0")}`}
              </Txt>
            </g>
          )),
        )}
      <g transform={`translate(${wall} ${wall})`}>
        {pod.partitions.map((p, i) => (
          <Box key={i} x={p.x} y={0} w={p.w} h={clearW} fill="dark" sw={LW.thin} />
        ))}
        {children}
      </g>
    </g>
  );
}
