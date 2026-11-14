import { Fragment } from "react";
import type { Ref } from "@/features/chassis/model/refs";
import { Box, FILL, Hit, INK, LW, Txt, type FillKey } from "./core";

export interface Cell {
  text: string;
  bold?: boolean;
  align?: "start" | "middle" | "end";
  size?: number;
}

export interface Row {
  cells: (string | Cell)[];
  bold?: boolean;
  fill?: FillKey;
  h?: number;
  ref?: Ref;
  /** Merge all cells into one spanning text row (section headers). */
  span?: boolean;
}

export interface Col {
  w: number;
  align?: "start" | "middle" | "end";
}

/** Plain SVG table. Rows with a `ref` become selectable. */
export function Table({
  x,
  y,
  cols,
  rows,
  rowH = 4.2,
  size = 1.25,
  pad = 1.4,
  grid = "rows",
  border = true,
}: {
  x: number;
  y: number;
  cols: Col[];
  rows: Row[];
  rowH?: number;
  size?: number;
  pad?: number;
  grid?: "rows" | "full" | "none";
  border?: boolean;
}) {
  const width = cols.reduce((s, c) => s + c.w, 0);
  const tops = rows.reduce<number[]>((acc, row, ri) => [...acc, ri ? acc[ri - 1] + (rows[ri - 1].h ?? rowH) : y], []);
  const bottom = rows.length ? tops[rows.length - 1] + (rows[rows.length - 1].h ?? rowH) : y;
  const out = rows.map((row, ri) => {
    const h = row.h ?? rowH;
    const top = tops[ri];
    let cx = x;
    const cells = row.span
      ? [
          <Txt key="s" x={x + pad} y={top + h / 2} size={size} bold={row.bold ?? true}>
            {typeof row.cells[0] === "string" ? row.cells[0] : row.cells[0].text}
          </Txt>,
        ]
      : row.cells.map((raw, ci) => {
          const c: Cell = typeof raw === "string" ? { text: raw } : raw;
          const col = cols[ci];
          const left = cx;
          cx += col?.w ?? 0;
          const align = c.align ?? col?.align ?? "start";
          const tx =
            align === "start" ? left + pad : align === "end" ? left + (col?.w ?? 0) - pad : left + (col?.w ?? 0) / 2;
          return (
            <Txt key={ci} x={tx} y={top + h / 2} size={c.size ?? size} bold={c.bold ?? row.bold} anchor={align}>
              {c.text}
            </Txt>
          );
        });
    const body = (
      <>
        <Box x={x} y={top} w={width} h={h} fill={row.fill ?? "white"} sw={grid === "none" ? 0.0001 : LW.hair} />
        {grid === "full" &&
          !row.span &&
          cols.slice(0, -1).map((_, ci) => {
            const lx = x + cols.slice(0, ci + 1).reduce((s, c) => s + c.w, 0);
            return <line key={ci} x1={lx} y1={top} x2={lx} y2={top + h} stroke={INK} strokeWidth={LW.hair} />;
          })}
        {cells}
      </>
    );
    return <Fragment key={ri}>{row.ref ? <Hit {...row.ref}>{body}</Hit> : <g>{body}</g>}</Fragment>;
  });
  return (
    <g>
      {out}
      {border && <rect x={x} y={y} width={width} height={bottom - y} fill="none" stroke={INK} strokeWidth={LW.med} />}
    </g>
  );
}

export function TitledPanel({ x, y, w, title }: { x: number; y: number; w: number; title: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={5.5} fill={FILL.light} stroke={INK} strokeWidth={LW.med} />
      <Txt x={x + 2} y={y + 2.75} size={1.5} bold>
        {title}
      </Txt>
    </g>
  );
}
