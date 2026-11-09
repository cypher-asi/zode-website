/** Cell flags: low two bits are the horizontal alignment. */
export const ALIGN_CENTER = 1;
export const ALIGN_RIGHT = 2;
export const ALIGN_MASK = 3;
export const BOLD = 4;

/** Height of every row at 100%, in px. */
export const ROW_HEIGHT = 22;

/** A picture or chart floating over the cells, placed in px at 100% from the top-left of the first cell. */
export type SheetDrawing = {
  x: number;
  y: number;
  width: number;
  height: number;
} & (
  | {
      kind: "picture";
      /** A data: URL, or null when the format can't be shown in a browser or the picture is too large. */
      src: string | null;
      alt: string;
      /** Fractions trimmed off each edge: left, top, right, bottom. */
      crop: [number, number, number, number];
      /** Clockwise, in degrees. */
      rotation: number;
      flipH: boolean;
      flipV: boolean;
    }
  | { kind: "chart"; title: string }
);

/** One sheet, ready to draw. */
export interface SheetGrid {
  rows: number;
  columns: number;
  /** Display text of every cell, row by row; "" where empty. */
  cells: string[];
  flags: Uint8Array;
  /** How many empty cells to its right a left-aligned text cell may run into, as Excel lets it. */
  spill: Uint8Array;
  /** Each row's number in the workbook, 1-based; hidden rows are left out. */
  rowNumbers: number[];
  /** Each column's index in the workbook, 0-based; hidden columns are left out. */
  columnIndexes: number[];
  /** Column widths in px at 100%. */
  widths: number[];
  /** Rows and columns with content before the preview's cap. */
  totalRows: number;
  totalColumns: number;
  /** In the order Excel stacks them, bottom first. */
  drawings: SheetDrawing[];
  /** False when the sheet is set to hide its gridlines. */
  gridLines: boolean;
}
