import { unzipSync, type UnzipFileInfo } from "fflate";
import { builtinFormat, compileFormat, formatGeneral, formatNumber, type NumberFormat } from "./numberFormat";
import { ALIGN_CENTER, ALIGN_MASK, ALIGN_RIGHT, BOLD, ROW_HEIGHT, type SheetDrawing, type SheetGrid } from "./sheetGrid";

/**
 * A minimal .xlsx reader for previews: cached values formatted with their
 * number formats, bold, alignment, column widths, hidden rows, columns and
 * sheets, and the pictures floating over each sheet. Unzips synchronously
 * (fflate's async unzip spawns blob: workers, which the site's CSP forbids)
 * and decompresses each sheet only when read.
 */

const MAX_COLUMNS = 1_000;
const MAX_CELLS = 2_000_000;
const MAX_XML_BYTES = 256 * 1024 * 1024;
const MAX_SPILL = 255;
/** Excel's default column width, in characters. */
const DEFAULT_WIDTH = 8.43;
/** Excel's last row and column, 0-based. */
const LAST_ROW = 1_048_575;
const LAST_COLUMN = 16_383;
const EMU_PER_PX = 9525;
/** Pictures are inlined as data: URLs (the CSP forbids blob: images), so their size is capped. */
const MAX_PICTURE_BYTES = 32 * 1024 * 1024;
const MAX_SHEET_PICTURE_BYTES = 96 * 1024 * 1024;
/** Picture formats browsers draw. Excel also embeds EMF and WMF, which they don't. */
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};
/** A picture's `srcRect` attributes, in the order of `crop`. */
const CROP_EDGES = ["l", "t", "r", "b"];

type Picture = Extract<SheetDrawing, { kind: "picture" }>;
type Chart = Extract<SheetDrawing, { kind: "chart" }>;

interface CellStyle {
  format: NumberFormat | null;
  bold: boolean;
  align: number | null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text: string): string {
  if (!text.includes("&") && !text.includes("_x")) return text;
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, entity: string) => {
      if (entity[0] !== "#") return ENTITIES[entity] ?? match;
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    })
    .replace(/_x([0-9a-f]{4})_/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

const attrCache = new Map<string, RegExp>();

function attr(attrs: string, name: string): string | undefined {
  let re = attrCache.get(name);
  if (!re) {
    re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
    attrCache.set(name, re);
  }
  const match = re.exec(attrs);
  return match ? decode(match[1] ?? match[2]) : undefined;
}

function truthy(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

/** Matches an element's start tag with any namespace prefix: [, prefix, attributes, "/" if self-closing]. */
function tags(name: string): RegExp {
  return new RegExp(`<([\\w.-]+:)?${name}\\b([^>]*?)(/?)>`, "g");
}

/** The section of `xml` between an element's start and end tags, or "" if there isn't one. */
function section(xml: string, name: string): string {
  const start = new RegExp(`<([\\w.-]+:)?${name}\\b[^>]*>`).exec(xml);
  if (!start) return "";
  const end = xml.indexOf(`</${start[1] ?? ""}${name}>`, start.index);
  return xml.slice(start.index + start[0].length, end === -1 ? undefined : end);
}

/** Joins the text runs of a shared or inline string, leaving out phonetic guides. */
function richText(xml: string): string {
  const plain = xml.replace(/<([\w.-]+:)?rPh\b[\s\S]*?<\/([\w.-]+:)?rPh>/g, "");
  let text = "";
  for (const match of plain.matchAll(/<(?:[\w.-]+:)?t\b[^>]*?(?:\/>|>([^<]*)<)/g)) text += match[1] ?? "";
  return decode(text);
}

function columnIndex(ref: string): number {
  let index = 0;
  for (let i = 0; i < ref.length; i++) {
    const code = ref.charCodeAt(i);
    if (code >= 65 && code <= 90) index = index * 26 + code - 64;
    else if (code >= 97 && code <= 122) index = index * 26 + code - 96;
    else break;
  }
  return index - 1;
}

function widthPx(chars: number): number {
  return Math.min(800, Math.max(8, Math.round(chars * 7 + 5)));
}

function resolve(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/");
  for (const part of target.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

type Relationships = Map<string, { path: string; type: string }>;

/** Where the relationships of the part at `path` are kept. */
function relsPath(path: string): string {
  const slash = path.lastIndexOf("/");
  return `${path.slice(0, slash + 1)}_rels/${path.slice(slash + 1)}.rels`;
}

/** A part's relationships by id, resolved to paths in the zip; links outside the file are left out. */
function parseRels(xml: string, partPath: string): Relationships {
  const base = partPath.slice(0, Math.max(0, partPath.lastIndexOf("/")));
  const rels: Relationships = new Map();
  for (const [, , attrs] of xml.matchAll(tags("Relationship"))) {
    const id = attr(attrs, "Id");
    const target = attr(attrs, "Target");
    if (id && target && attr(attrs, "TargetMode") !== "External") {
      rels.set(id, { path: resolve(base, target), type: attr(attrs, "Type") ?? "" });
    }
  }
  return rels;
}

/** The contents of each `names` element (a regex alternation) in `xml`, in order. Elements of one name mustn't nest. */
function* elements(xml: string, names: string): Generator<{ name: string; body: string }> {
  const start = new RegExp(`<([\\w.-]+:)?(${names})\\b[^>]*?(/?)>`, "g");
  for (let match = start.exec(xml); match; match = start.exec(xml)) {
    if (match[3]) continue;
    const end = xml.indexOf(`</${match[1] ?? ""}${match[2]}>`, start.lastIndex);
    if (end === -1) return;
    yield { name: match[2], body: xml.slice(start.lastIndex, end) };
    start.lastIndex = end;
  }
}

/** The first `name` element in `xml` with both numeric attributes, such as an offset or a size in EMUs. */
function point(xml: string, name: string, x = "x", y = "y"): { x: number; y: number } | null {
  for (const [, , attrs] of xml.matchAll(tags(name))) {
    const px = Number(attr(attrs, x));
    const py = Number(attr(attrs, y));
    if (Number.isFinite(px) && Number.isFinite(py)) return { x: px, y: py };
  }
  return null;
}

/** A drawing anchor's cell, 0-based, and the offset into it in px. */
function marker(xml: string): { column: number; left: number; row: number; top: number } {
  const read = (name: string) => Number(new RegExp(`<(?:[\\w.-]+:)?${name}>\\s*(-?\\d+)`).exec(xml)?.[1] ?? 0);
  return { column: read("col"), left: read("colOff") / EMU_PER_PX, row: read("row"), top: read("rowOff") / EMU_PER_PX };
}

/** A chart's own title, or the series name Excel titles it with. */
function chartTitle(xml: string): string {
  const plot = xml.search(/<([\w.-]+:)?plotArea\b/);
  const title = section(plot === -1 ? xml : xml.slice(0, plot), "title");
  return (richText(title) || decode(/<(?:[\w.-]+:)?v>([^<]*)</.exec(title)?.[1] ?? "")).trim();
}

function dataUrl(bytes: Uint8Array, type: string): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(binary)}`;
}

/** A drawing placed by its anchor: a workbook cell, 0-based, and px into it. Its own x and y are filled in once the grid is laid out. */
interface Anchored {
  row: number;
  column: number;
  top: number;
  left: number;
  drawing: SheetDrawing;
}

export class Workbook {
  /** Visible worksheets in tab order. */
  readonly sheets: { name: string; path: string }[];
  /** Index into `sheets` of the tab the workbook was saved on. */
  readonly active: number;
  private readonly sharedStrings: string[];
  private readonly styles: CellStyle[];
  private readonly date1904: boolean;
  private readonly zip: Uint8Array;

  private constructor(zip: Uint8Array) {
    this.zip = zip;
    const meta = this.readText(["xl/workbook.xml", "xl/_rels/workbook.xml.rels"]);
    const workbook = meta["xl/workbook.xml"];
    if (!workbook) throw new Error("Not an Excel workbook");

    const targets = parseRels(meta["xl/_rels/workbook.xml.rels"] ?? "", "xl/workbook.xml");
    const byType = (suffix: string) => [...targets.values()].find((t) => t.type.endsWith(suffix))?.path;
    const sharedStringsPath = byType("/sharedStrings") ?? "xl/sharedStrings.xml";
    const stylesPath = byType("/styles") ?? "xl/styles.xml";

    const sheets: { name: string; path: string }[] = [];
    let active = 0;
    const activeTab = Number(attr(/<(?:[\w.-]+:)?workbookView\b([^>]*)>/.exec(workbook)?.[1] ?? "", "activeTab") ?? 0);
    let tab = 0;
    for (const [, , attrs] of section(workbook, "sheets").matchAll(tags("sheet"))) {
      const id = attr(attrs, "r:id") ?? attr(attrs, "id");
      const target = id ? targets.get(id) : undefined;
      const state = attr(attrs, "state");
      if (tab++ === activeTab) active = sheets.length;
      if (!target || !target.type.endsWith("/worksheet") || state === "hidden" || state === "veryHidden") continue;
      sheets.push({ name: attr(attrs, "name") ?? `Sheet${tab}`, path: target.path });
    }
    this.sheets = sheets;
    this.active = Math.min(active, Math.max(0, sheets.length - 1));
    this.date1904 = truthy(attr(/<(?:[\w.-]+:)?workbookPr\b([^>]*)>/.exec(workbook)?.[1] ?? "", "date1904"));

    const shared = this.readText([sharedStringsPath, stylesPath]);
    this.sharedStrings = [];
    const sst = shared[sharedStringsPath] ?? "";
    const items = tags("si");
    for (let match = items.exec(sst); match; match = items.exec(sst)) {
      if (match[3]) {
        this.sharedStrings.push("");
        continue;
      }
      const end = sst.indexOf(`</${match[1] ?? ""}si>`, items.lastIndex);
      this.sharedStrings.push(richText(sst.slice(items.lastIndex, end === -1 ? undefined : end)));
      if (end !== -1) items.lastIndex = end;
    }
    this.styles = parseStyles(shared[stylesPath] ?? "");
  }

  static open(data: Uint8Array): Workbook {
    return new Workbook(data);
  }

  private unzip(filter: (file: UnzipFileInfo) => boolean): Record<string, Uint8Array> {
    return unzipSync(this.zip, {
      filter: (file) => {
        if (!filter(file)) return false;
        if (file.originalSize > MAX_XML_BYTES) throw new Error(`${file.name} is too large to preview`);
        return true;
      },
    });
  }

  private readText(paths: string[]): Record<string, string> {
    const wanted = new Set(paths);
    const decoder = new TextDecoder();
    const files = this.unzip((file) => wanted.has(file.name));
    return Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, decoder.decode(bytes)]));
  }

  /**
   * The pictures and charts in a sheet's drawing, bottom first. Sizes are
   * Excel's, so pictures keep their proportions; `columnPx` and `rowPx` size
   * anchors that only give their corner cells.
   */
  private readDrawings(sheetPath: string, sheetXml: string, columnPx: (c: number) => number, rowPx: (r: number) => number): Anchored[] {
    const dataEnd = sheetXml.lastIndexOf("sheetData>");
    const drawingId = attr(tags("drawing").exec(dataEnd === -1 ? sheetXml : sheetXml.slice(dataEnd))?.[2] ?? "", "r:id");
    if (!drawingId) return [];
    const sheetRels = relsPath(sheetPath);
    const drawingPath = parseRels(this.readText([sheetRels])[sheetRels] ?? "", sheetPath).get(drawingId)?.path;
    if (!drawingPath) return [];
    const files = this.readText([drawingPath, relsPath(drawingPath)]);
    const rels = parseRels(files[relsPath(drawingPath)] ?? "", drawingPath);
    // Fallbacks repeat a shape for older Excels; drawing both would double it.
    const xml = (files[drawingPath] ?? "").replace(/<([\w.-]+:)?Fallback\b[\s\S]*?<\/\1Fallback>/g, "");

    const anchored: Anchored[] = [];
    const pictures = new Map<Picture, string>();
    const charts = new Map<Chart, string>();
    for (const anchor of elements(xml, "twoCellAnchor|oneCellAnchor|absoluteAnchor")) {
      const body = anchor.body;
      let row = 0;
      let column = 0;
      let top = 0;
      let left = 0;
      if (anchor.name === "absoluteAnchor") {
        const pos = point(body, "pos");
        left = (pos?.x ?? 0) / EMU_PER_PX;
        top = (pos?.y ?? 0) / EMU_PER_PX;
      } else {
        ({ row, column, top, left } = marker(section(body, "from")));
      }
      // The anchor's own size, or else the size of the shape or group it holds.
      const ext = point(body, "ext", "cx", "cy");
      let width = (ext?.x ?? 0) / EMU_PER_PX;
      let height = (ext?.y ?? 0) / EMU_PER_PX;
      if (!ext && anchor.name === "twoCellAnchor") {
        const to = marker(section(body, "to"));
        width = to.left - left;
        height = to.top - top;
        for (let c = column; c < to.column; c++) width += columnPx(c);
        for (let r = row; r < to.row; r++) height += rowPx(r);
      }
      if (!(width > 0 && height > 0)) continue;

      const group = /<(?:[\w.-]+:)?grpSpPr\b/.test(body) ? section(section(body, "grpSpPr"), "xfrm") : null;
      const childOrigin = group ? point(group, "chOff") : null;
      const childSize = group ? point(group, "chExt", "cx", "cy") : null;
      for (const element of elements(body, "pic|graphicFrame")) {
        const nv = tags("cNvPr").exec(element.body)?.[2] ?? "";
        if (truthy(attr(nv, "hidden"))) continue;
        const box = { x: left, y: top, width, height };
        if (childOrigin && childSize && childSize.x > 0 && childSize.y > 0) {
          const xfrm = section(element.body, "xfrm");
          const off = point(xfrm, "off");
          const size = point(xfrm, "ext", "cx", "cy");
          if (!off || !size) continue;
          const sx = width / childSize.x;
          const sy = height / childSize.y;
          box.x = left + (off.x - childOrigin.x) * sx;
          box.y = top + (off.y - childOrigin.y) * sy;
          box.width = size.x * sx;
          box.height = size.y * sy;
        }

        let drawing: SheetDrawing;
        if (element.name === "pic") {
          const media = rels.get(attr(tags("blip").exec(element.body)?.[2] ?? "", "r:embed") ?? "")?.path;
          const crop = tags("srcRect").exec(element.body)?.[2] ?? "";
          const xfrm = tags("xfrm").exec(element.body)?.[2] ?? "";
          const picture: Picture = {
            kind: "picture",
            ...box,
            src: null,
            alt: attr(nv, "descr") ?? "",
            crop: CROP_EDGES.map((edge) => (Number(attr(crop, edge)) || 0) / 100_000) as Picture["crop"],
            rotation: (Number(attr(xfrm, "rot")) || 0) / 60_000,
            flipH: truthy(attr(xfrm, "flipH")),
            flipV: truthy(attr(xfrm, "flipV")),
          };
          if (media) pictures.set(picture, media);
          drawing = picture;
        } else {
          const chart = tags("chart").exec(element.body)?.[2];
          if (chart === undefined) continue;
          const chartDrawing: Chart = { kind: "chart", ...box, title: "" };
          const chartPath = rels.get(attr(chart, "r:id") ?? "")?.path;
          if (chartPath) charts.set(chartDrawing, chartPath);
          drawing = chartDrawing;
        }
        anchored.push({ row, column, top: drawing.y, left: drawing.x, drawing });
      }
    }

    const type = (path: string) => IMAGE_TYPES[path.slice(path.lastIndexOf(".") + 1).toLowerCase()];
    const wanted = new Set([...[...pictures.values()].filter(type), ...charts.values()]);
    let budget = MAX_SHEET_PICTURE_BYTES;
    const parts = this.unzip((file) => {
      if (!wanted.has(file.name)) return false;
      if (!type(file.name)) return true;
      if (file.originalSize > MAX_PICTURE_BYTES || file.originalSize > budget) return false;
      budget -= file.originalSize;
      return true;
    });
    const urls = new Map<string, string>();
    for (const [picture, path] of pictures) {
      const bytes = parts[path];
      if (!bytes || !type(path)) continue;
      if (!urls.has(path)) urls.set(path, dataUrl(bytes, type(path)));
      picture.src = urls.get(path)!;
    }
    const decoder = new TextDecoder();
    for (const [chart, path] of charts) if (parts[path]) chart.title = chartTitle(decoder.decode(parts[path]));
    return anchored;
  }

  readSheet(index: number): SheetGrid {
    const { path } = this.sheets[index];
    const bytes = this.unzip((file) => file.name === path)[path];
    if (!bytes) throw new Error(`${path} is missing`);
    const xml = new TextDecoder().decode(bytes);

    const dataStart = xml.search(/<([\w.-]+:)?sheetData\b/);
    const head = dataStart === -1 ? xml : xml.slice(0, dataStart);
    const defaults = /<(?:[\w.-]+:)?sheetFormatPr\b([^>]*)>/.exec(head)?.[1] ?? "";
    const defaultWidth = Number(attr(defaults, "defaultColWidth")) || DEFAULT_WIDTH;
    const columnWidths = new Map<number, number>();
    const hiddenColumns = new Set<number>();
    for (const [, , attrs] of section(head, "cols").matchAll(tags("col"))) {
      const min = Number(attr(attrs, "min"));
      const max = Math.min(Number(attr(attrs, "max")), min + MAX_COLUMNS);
      const width = Number(attr(attrs, "width"));
      const hidden = truthy(attr(attrs, "hidden")) || width === 0;
      for (let c = min - 1; c < max; c++) {
        if (hidden) hiddenColumns.add(c);
        else if (width > 0) columnWidths.set(c, width);
      }
    }

    const cellRows: number[] = [];
    const cellColumns: number[] = [];
    const cellText: string[] = [];
    const cellFlags: number[] = [];
    const cellIsText: boolean[] = [];
    const hiddenRows = new Set<number>();
    let maxRow = -1;
    let maxColumn = -1;

    const data = dataStart === -1 ? "" : xml.slice(dataStart);
    const scanner = /<([\w.-]+:)?(row|c)\b([^>]*?)(\/?)>/g;
    let row = -1;
    let column = -1;
    for (let match = scanner.exec(data); match; match = scanner.exec(data)) {
      const [, prefix = "", tag, attrs, selfClosing] = match;
      if (tag === "row") {
        const r = Number(attr(attrs, "r"));
        row = r > 0 ? r - 1 : row + 1;
        column = -1;
        if (truthy(attr(attrs, "hidden"))) hiddenRows.add(row);
        continue;
      }
      const ref = attr(attrs, "r");
      column = ref ? columnIndex(ref) : column + 1;
      if (selfClosing || row < 0 || column < 0) continue;
      const end = data.indexOf(`</${prefix}c>`, scanner.lastIndex);
      const inner = data.slice(scanner.lastIndex, end === -1 ? undefined : end);
      if (end !== -1) scanner.lastIndex = end;

      const type = attr(attrs, "t") ?? "n";
      const style = this.styles[Number(attr(attrs, "s") ?? 0)] ?? this.styles[0];
      let text: string;
      let isText = false;
      let align = ALIGN_RIGHT;
      if (type === "inlineStr") {
        text = richText(inner);
        isText = true;
        align = 0;
      } else {
        const value = /<(?:[\w.-]+:)?v\b[^>]*>([^<]*)</.exec(inner)?.[1];
        if (value === undefined) continue;
        if (type === "s") {
          text = this.sharedStrings[Number(value)] ?? "";
          isText = true;
          align = 0;
        } else if (type === "str" || type === "d") {
          text = decode(value);
          isText = type === "str";
          align = isText ? 0 : ALIGN_RIGHT;
        } else if (type === "b") {
          text = truthy(value) ? "TRUE" : "FALSE";
          align = ALIGN_CENTER;
        } else if (type === "e") {
          text = decode(value);
          align = ALIGN_CENTER;
        } else {
          const number = Number(value);
          text = Number.isFinite(number)
            ? style?.format
              ? formatNumber(number, style.format, this.date1904)
              : formatGeneral(number)
            : decode(value);
        }
      }
      if (!text) continue;
      cellRows.push(row);
      cellColumns.push(column);
      cellText.push(text);
      cellFlags.push((style?.align ?? align) | (style?.bold ? BOLD : 0));
      cellIsText.push(isText);
      if (row > maxRow) maxRow = row;
      if (column > maxColumn) maxColumn = column;
    }

    // The grid reaches far enough to hold every drawing, as Excel's does.
    const columnPx = (c: number) => (hiddenColumns.has(c) ? 0 : widthPx(columnWidths.get(c) ?? defaultWidth));
    const rowPx = (r: number) => (hiddenRows.has(r) ? 0 : ROW_HEIGHT);
    const anchored = this.readDrawings(path, xml, columnPx, rowPx);
    for (const { row, column, top, left, drawing } of anchored) {
      let lastRow = row;
      for (let room = top + drawing.height - rowPx(lastRow); room > 0 && lastRow < LAST_ROW; ) room -= rowPx(++lastRow);
      let lastColumn = column;
      for (let room = left + drawing.width - columnPx(lastColumn); room > 0 && lastColumn < LAST_COLUMN; ) room -= columnPx(++lastColumn);
      maxRow = Math.max(maxRow, Math.min(lastRow, LAST_ROW));
      maxColumn = Math.max(maxColumn, Math.min(lastColumn, LAST_COLUMN));
    }

    const rowNumbers: number[] = [];
    const rowAt = new Int32Array(maxRow + 1).fill(-1);
    for (let r = 0; r <= maxRow; r++) {
      if (hiddenRows.has(r)) continue;
      rowAt[r] = rowNumbers.length;
      rowNumbers.push(r + 1);
    }
    const columnIndexes: number[] = [];
    const columnAt = new Int32Array(maxColumn + 1).fill(-1);
    for (let c = 0; c <= maxColumn; c++) {
      if (hiddenColumns.has(c)) continue;
      columnAt[c] = columnIndexes.length;
      columnIndexes.push(c);
    }
    const totalRows = rowNumbers.length;
    const totalColumns = columnIndexes.length;
    const columns = Math.min(totalColumns, MAX_COLUMNS);
    const rows = Math.min(totalRows, Math.floor(MAX_CELLS / Math.max(1, columns)));
    rowNumbers.length = rows;
    columnIndexes.length = columns;

    const cells = new Array<string>(rows * columns).fill("");
    const flags = new Uint8Array(rows * columns);
    const textCells = new Uint8Array(rows * columns);
    for (let i = 0; i < cellText.length; i++) {
      const r = rowAt[cellRows[i]];
      const c = columnAt[cellColumns[i]];
      if (r === -1 || c === -1 || r >= rows || c >= columns) continue;
      const at = r * columns + c;
      cells[at] = cellText[i];
      flags[at] = cellFlags[i];
      textCells[at] = cellIsText[i] ? 1 : 0;
    }

    const spill = new Uint8Array(rows * columns);
    for (let r = 0; r < rows; r++) {
      const base = r * columns;
      for (let c = 0; c < columns; c++) {
        const at = base + c;
        if (!textCells[at] || (flags[at] & ALIGN_MASK) !== 0) continue;
        let n = 0;
        while (c + n + 1 < columns && n < MAX_SPILL && !cells[at + n + 1]) n++;
        spill[at] = n;
      }
    }

    const widths = columnIndexes.map((c) => widthPx(columnWidths.get(c) ?? defaultWidth));
    const columnLeft = [0];
    for (const width of widths) columnLeft.push(columnLeft[columnLeft.length - 1] + width);
    const drawings: SheetDrawing[] = [];
    for (const { row, column, top, left, drawing } of anchored) {
      // An anchor in a hidden row or column starts at the next one shown.
      let r = row;
      while (r <= maxRow && rowAt[r] === -1) r++;
      let c = column;
      while (c <= maxColumn && columnAt[c] === -1) c++;
      if (r > maxRow || c > maxColumn || rowAt[r] >= rows || columnAt[c] >= columns) continue;
      drawing.x = Math.max(0, columnLeft[columnAt[c]] + (c === column ? left : 0));
      drawing.y = Math.max(0, rowAt[r] * ROW_HEIGHT + (r === row ? top : 0));
      drawings.push(drawing);
    }
    const view = /<(?:[\w.-]+:)?sheetView\b([^>]*)>/.exec(head)?.[1] ?? "";
    const showGridLines = attr(view, "showGridLines");

    return {
      rows,
      columns,
      cells,
      flags,
      spill,
      rowNumbers,
      columnIndexes,
      widths,
      totalRows,
      totalColumns,
      drawings,
      gridLines: showGridLines !== "0" && showGridLines !== "false",
    };
  }
}

function parseStyles(xml: string): CellStyle[] {
  const formats = new Map<number, string>();
  for (const [, , attrs] of xml.matchAll(tags("numFmt"))) {
    const id = Number(attr(attrs, "numFmtId"));
    const code = attr(attrs, "formatCode");
    if (code !== undefined) formats.set(id, code);
  }

  const bold: boolean[] = [];
  const fonts = section(xml, "fonts");
  const fontTags = tags("font");
  for (let match = fontTags.exec(fonts); match; match = fontTags.exec(fonts)) {
    if (match[3]) {
      bold.push(false);
      continue;
    }
    const end = fonts.indexOf(`</${match[1] ?? ""}font>`, fontTags.lastIndex);
    const inner = fonts.slice(fontTags.lastIndex, end === -1 ? undefined : end);
    bold.push(/<(?:[\w.-]+:)?b(?:\s+val\s*=\s*["'](?:1|true)["'])?\s*\/>/.test(inner));
  }

  const compiled = new Map<string, NumberFormat | null>();
  const styles: CellStyle[] = [];
  const xfs = section(xml, "cellXfs");
  const xfTags = tags("xf");
  for (let match = xfTags.exec(xfs); match; match = xfTags.exec(xfs)) {
    const attrs = match[2];
    let inner = "";
    if (!match[3]) {
      const end = xfs.indexOf(`</${match[1] ?? ""}xf>`, xfTags.lastIndex);
      inner = xfs.slice(xfTags.lastIndex, end === -1 ? undefined : end);
    }
    const id = Number(attr(attrs, "numFmtId") ?? 0);
    const code = formats.get(id) ?? builtinFormat(id);
    if (!compiled.has(code)) compiled.set(code, code.toLowerCase() === "general" ? null : compileFormat(code));
    const horizontal = attr(/<(?:[\w.-]+:)?alignment\b([^>]*)>/.exec(inner)?.[1] ?? "", "horizontal");
    styles.push({
      format: compiled.get(code) ?? null,
      bold: bold[Number(attr(attrs, "fontId") ?? 0)] ?? false,
      align:
        horizontal === "center" || horizontal === "centerContinuous"
          ? ALIGN_CENTER
          : horizontal === "right"
            ? ALIGN_RIGHT
            : horizontal === "left" || horizontal === "justify" || horizontal === "fill" || horizontal === "distributed"
              ? 0
              : null,
    });
  }
  return styles;
}
