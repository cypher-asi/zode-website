import type { ReactNode } from "react";
import type { Project, Sheet } from "@/features/chassis/model/schema";
import { INK, LW, Txt } from "./core";
import { FILL } from "@/features/chassis/drawing/palette";

export const PAPER = { w: 420, h: 297 };
export const FRAME = { x0: 6, y0: 6, x1: 414, y1: 291, topH: 21, botH: 21 };
/** Usable drawing area between the two title blocks. */
export const AREA = { x: 6, y: FRAME.y0 + FRAME.topH, w: 408, h: FRAME.y1 - FRAME.botH - (FRAME.y0 + FRAME.topH) };

const COLS = [6, 118, 297, 355, 414];

export function Logo({ x, y, size = 8.5 }: { x: number; y: number; size?: number }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={700}
      textAnchor="middle"
      dominantBaseline="middle"
      letterSpacing={size * 0.08}
      fill={INK}
      style={{ fontFamily: "Arial Black, Inter, sans-serif", fontStyle: "italic", userSelect: "none" }}
    >
      ZODE
    </text>
  );
}

function Cells({ y, h }: { y: number; h: number }) {
  return (
    <g stroke={INK} strokeWidth={LW.med} fill="none">
      <rect x={FRAME.x0} y={y} width={FRAME.x1 - FRAME.x0} height={h} />
      {COLS.slice(1, -1).map((x) => (
        <line key={x} x1={x} y1={y} x2={x} y2={y + h} />
      ))}
    </g>
  );
}

export function SheetFrame({
  project,
  sheet,
  index,
  total,
  children,
}: {
  project: Project;
  sheet: Sheet;
  index: number;
  total: number;
  children?: ReactNode;
}) {
  const topY = FRAME.y0;
  const botY = FRAME.y1 - FRAME.botH;
  const sheetNo = `SHEET ${index + 1} OF ${total}`;
  return (
    <g style={{ fontFamily: "var(--font-sans), Inter, Helvetica, Arial, sans-serif" }}>
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0,1 L10,5 L0,9 z" fill={INK} />
        </marker>
      </defs>
      <rect x={0} y={0} width={PAPER.w} height={PAPER.h} fill={FILL.white} />
      <rect
        x={FRAME.x0}
        y={FRAME.y0}
        width={FRAME.x1 - FRAME.x0}
        height={FRAME.y1 - FRAME.y0}
        fill="none"
        stroke={INK}
        strokeWidth={LW.med}
      />

      {/* Top title block */}
      <Cells y={topY} h={FRAME.topH} />
      <Logo x={(COLS[0] + COLS[1]) / 2} y={topY + FRAME.topH / 2} />
      <Txt x={COLS[1] + 4} y={topY + 6.5} size={2.1} bold>
        {sheet.title}
      </Txt>
      <Txt x={COLS[1] + 4} y={topY + 11.5} size={1.35}>
        {sheet.subtitle}
      </Txt>
      <Txt x={(COLS[2] + COLS[3]) / 2} y={topY + 6} size={1.25} anchor="middle">
        {project.podSummary}
      </Txt>
      <Txt x={(COLS[2] + COLS[3]) / 2} y={topY + 10} size={1.9} anchor="middle" bold>
        {project.capacity}
      </Txt>
      <Txt x={(COLS[2] + COLS[3]) / 2} y={topY + 14.5} size={1.15} anchor="middle">
        {project.units}
      </Txt>
      <Txt x={(COLS[3] + COLS[4]) / 2} y={topY + 6} size={2.1} anchor="middle" bold>
        {sheet.id}
      </Txt>
      <Txt x={(COLS[3] + COLS[4]) / 2} y={topY + 10.5} size={1.25} anchor="middle">
        {sheetNo}
      </Txt>
      <Txt x={(COLS[3] + COLS[4]) / 2} y={topY + 14.5} size={1.25} anchor="middle">
        {`REV ${project.revision}`}
      </Txt>

      {/* Bottom title block */}
      <Cells y={botY} h={FRAME.botH} />
      <Txt x={COLS[0] + 4} y={botY + 5.5} size={2} bold>
        {project.name}
      </Txt>
      <Txt x={COLS[0] + 4} y={botY + 10.5} size={1.25}>
        {project.subtitle}
      </Txt>
      <Txt x={COLS[0] + 4} y={botY + 15} size={1.25} bold>
        {project.status}
      </Txt>
      <Txt x={COLS[1] + 4} y={botY + 5.5} size={2} bold>
        {sheet.title}
      </Txt>
      <Txt x={COLS[1] + 4} y={botY + 10.5} size={1.25}>
        Dimensions in mm unless noted.
      </Txt>
      <Txt x={COLS[1] + 4} y={botY + 15} size={1.25} bold>
        {project.classification}
      </Txt>
      <Txt x={(COLS[2] + COLS[3]) / 2} y={botY + 5} size={1.15} anchor="middle">
        {`SCALE AT ${project.paper}`}
      </Txt>
      <Txt x={(COLS[2] + COLS[3]) / 2} y={botY + 9.5} size={1.9} anchor="middle" bold>
        {sheet.scale}
      </Txt>
      <Txt x={(COLS[2] + COLS[3]) / 2} y={botY + 14.5} size={1.15} anchor="middle">
        PRINT AT 100%
      </Txt>
      <Txt x={(COLS[3] + COLS[4]) / 2} y={botY + 5.5} size={2.1} anchor="middle" bold>
        {sheet.id}
      </Txt>
      <Txt x={(COLS[3] + COLS[4]) / 2} y={botY + 10.5} size={1.25} anchor="middle">
        {sheetNo}
      </Txt>
      <Txt x={(COLS[3] + COLS[4]) / 2} y={botY + 15} size={1.25} anchor="middle">
        {`REV ${project.revision} | ${project.date}`}
      </Txt>

      {children}
    </g>
  );
}
