"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { Scrollbars } from "./Scrollbars";
import type { ViewerProps } from "./types";
import { ALIGN_CENTER, ALIGN_MASK, ALIGN_RIGHT, BOLD, type SheetGrid } from "./sheetGrid";
import { rememberScroll, selectSheet, sheetScroll, useWorkbook } from "./sheetCache";
import styles from "../Viewer.module.css";

const ROW_HEIGHT = 22;
const HEADER_WIDTH = 48;
const FONT_SIZE = 13;
/** Rows and columns drawn past each edge of the view, so fast scrolls don't flash blank. */
const OVERSCAN = 6;

function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

/** The first index whose offset is past `x`. */
function upperBound(offsets: Float64Array, x: number): number {
  let lo = 0;
  let hi = offsets.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function alignClass(flags: number): string {
  const align = flags & ALIGN_MASK;
  return align === ALIGN_RIGHT ? styles.right : align === ALIGN_CENTER ? styles.center : "";
}

/**
 * Excel workbooks as grids, one tab per sheet, with Excel's number formats,
 * column widths and bold text. The workbook is read in a worker and only the
 * cells in view are drawn, so large models stay responsive. Read workbooks are
 * kept for the session, so going back to one shows it where it was left.
 */
export default function SheetViewer({ url, zoom, onFitScale }: ViewerProps): ReactElement {
  const { book, error, active } = useWorkbook(url);
  const scrollId = useId();

  useEffect(() => onFitScale(1), [onFitScale]);

  if (error) return <div className={styles.status}>{error}</div>;
  if (!book) return <div className={styles.status}>Loading workbook…</div>;
  if (!book.names.length) return <div className={styles.status}>This workbook has no sheets to show.</div>;

  const index = Math.min(active, book.names.length - 1);
  const grid = book.grids[index];
  const scale = zoom === "fit" ? 1 : zoom;
  const status = book.failed[index]
    ? "This sheet couldn't be previewed. Download the workbook to open it in Excel."
    : !grid
      ? "Loading sheet…"
      : grid.rows === 0
        ? "This sheet has no cells to show. It may hold only charts or pictures; download the workbook to see them."
        : null;
  const capped = grid && (grid.rows < grid.totalRows || grid.columns < grid.totalColumns);

  return (
    <div className={styles.sheet}>
      {capped ? (
        <p className={styles.note}>
          Showing the first {grid.rows.toLocaleString("en-US")} of {grid.totalRows.toLocaleString("en-US")} rows
          {grid.columns < grid.totalColumns
            ? ` and ${grid.columns.toLocaleString("en-US")} of ${grid.totalColumns.toLocaleString("en-US")} columns`
            : ""}
          . Download the workbook to see everything.
        </p>
      ) : null}
      <div className={styles.sheetFrame}>
        <Grid
          scrollId={scrollId}
          grid={status ? null : grid}
          status={status}
          scale={scale}
          initialScroll={() => {
            const { top, left } = sheetScroll(url, index);
            return { top: top * scale, left: left * scale };
          }}
          onScroll={(top, left) => rememberScroll(url, index, top / scale, left / scale)}
        />
        <Scrollbars targetId={scrollId} />
      </div>
      {book.names.length > 1 ? (
        <div className={styles.sheetTabs} role="tablist" aria-label="Sheets">
          {book.names.map((name, i) => (
            <button
              key={`${name}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={styles.sheetTab}
              onClick={() => selectSheet(url, i)}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface View {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * The scroll area. It stays mounted across sheets so its overlay scrollbars
 * keep tracking it, and draws only the rows and columns in view. Each sheet
 * opens at `initialScroll`, and scrolling is reported through `onScroll`.
 */
function Grid({
  scrollId,
  grid,
  status,
  scale,
  initialScroll,
  onScroll,
}: {
  scrollId: string;
  grid: SheetGrid | null;
  status: string | null;
  scale: number;
  initialScroll: () => { top: number; left: number };
  onScroll: (top: number, left: number) => void;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ top: 0, left: 0, width: 0, height: 0 });
  const initialScrollRef = useRef(initialScroll);
  const onScrollRef = useRef(onScroll);

  useLayoutEffect(() => {
    initialScrollRef.current = initialScroll;
    onScrollRef.current = onScroll;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setView((v) =>
        v.top === el.scrollTop && v.left === el.scrollLeft && v.width === el.clientWidth && v.height === el.clientHeight
          ? v
          : { top: el.scrollTop, left: el.scrollLeft, width: el.clientWidth, height: el.clientHeight },
      );
    const scrolled = () => {
      update();
      onScrollRef.current(el.scrollTop, el.scrollLeft);
    };
    update();
    const resize = new ResizeObserver(update);
    resize.observe(el);
    el.addEventListener("scroll", scrolled, { passive: true });
    return () => {
      resize.disconnect();
      el.removeEventListener("scroll", scrolled);
    };
  }, []);

  useLayoutEffect(() => {
    const { top, left } = initialScrollRef.current();
    ref.current?.scrollTo(left, top);
  }, [grid]);

  const rowHeight = ROW_HEIGHT * scale;
  const headerWidth = HEADER_WIDTH * scale;
  const offsets = useMemo(() => {
    const offsets = new Float64Array((grid?.columns ?? 0) + 1);
    grid?.widths.forEach((width, c) => (offsets[c + 1] = offsets[c] + width * scale));
    return offsets;
  }, [grid, scale]);

  const style = { fontSize: `${FONT_SIZE * scale}px`, "--row": `${rowHeight}px` } as CSSProperties;
  if (!grid) {
    return (
      <div ref={ref} id={scrollId} className={styles.sheetGrid} style={style}>
        <div className={styles.status}>{status}</div>
      </div>
    );
  }

  const firstRow = Math.max(0, Math.floor(view.top / rowHeight) - OVERSCAN);
  const lastRow = Math.min(grid.rows, Math.ceil((view.top + view.height) / rowHeight) + OVERSCAN);
  const firstColumn = Math.max(0, upperBound(offsets, view.left) - 1 - OVERSCAN);
  const lastColumn = Math.min(grid.columns, upperBound(offsets, view.left + view.width - headerWidth) + OVERSCAN);

  const visibleColumns: number[] = [];
  for (let c = firstColumn; c < lastColumn; c++) visibleColumns.push(c);
  const template = `${headerWidth}px ${offsets[firstColumn]}px ${visibleColumns.map((c) => `${offsets[c + 1] - offsets[c]}px`).join(" ")}`;

  const rows: ReactElement[] = [];
  for (let r = firstRow; r < lastRow; r++) {
    const base = r * grid.columns;
    rows.push(
      <div key={r} className={styles.gridRow} style={{ gridTemplateColumns: template }}>
        <div className={styles.rowHead}>{grid.rowNumbers[r]}</div>
        <div />
        {visibleColumns.map((c) => {
          const text = grid.cells[base + c];
          if (!text) return <div key={c} className={styles.cell} />;
          const flags = grid.flags[base + c];
          const spill = grid.spill[base + c];
          const className = `${styles.cell} ${alignClass(flags)} ${flags & BOLD ? styles.bold : ""}`;
          if (!spill) {
            return (
              <div key={c} className={className} title={text}>
                {text}
              </div>
            );
          }
          const room = offsets[Math.min(grid.columns, c + 1 + spill)] - offsets[c];
          return (
            <div key={c} className={`${className} ${styles.spill}`} title={text}>
              <span style={{ maxWidth: `calc(${room}px - 0.8em)` }}>{text}</span>
            </div>
          );
        })}
      </div>,
    );
  }

  return (
    <div ref={ref} id={scrollId} className={styles.sheetGrid} style={style}>
      <div className={styles.gridCanvas} style={{ width: headerWidth + offsets[grid.columns], height: rowHeight * (grid.rows + 1) }}>
        <div className={styles.gridHead} style={{ gridTemplateColumns: template }}>
          <div className={styles.corner} />
          <div />
          {visibleColumns.map((c) => (
            <div key={c} className={styles.colHead}>
              {columnName(grid.columnIndexes[c])}
            </div>
          ))}
        </div>
        <div style={{ height: firstRow * rowHeight }} />
        {rows}
      </div>
    </div>
  );
}
