import { unzipSync, type UnzipFileInfo } from "fflate";
import { builtinFormat, compileFormat, formatGeneral, formatNumber, type NumberFormat } from "./numberFormat";
import { ALIGN_CENTER, ALIGN_MASK, ALIGN_RIGHT, BOLD, type SheetGrid } from "./sheetGrid";

/**
 * A minimal .xlsx reader for previews: cached values formatted with their
 * number formats, bold, alignment, column widths, and hidden rows, columns
 * and sheets. Unzips synchronously (fflate's async unzip spawns blob: workers,
 * which the site's CSP forbids) and decompresses each sheet only when read.
 */

const MAX_COLUMNS = 1_000;
const MAX_CELLS = 2_000_000;
const MAX_XML_BYTES = 256 * 1024 * 1024;
const MAX_SPILL = 255;
/** Excel's default column width, in characters. */
const DEFAULT_WIDTH = 8.43;

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
    const decoder = new TextDecoder();
    const read = (paths: string[]): Record<string, string> => {
      const wanted = new Set(paths);
      const files = this.unzip((file) => wanted.has(file.name));
      return Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, decoder.decode(bytes)]));
    };

    const meta = read(["xl/workbook.xml", "xl/_rels/workbook.xml.rels"]);
    const workbook = meta["xl/workbook.xml"];
    if (!workbook) throw new Error("Not an Excel workbook");

    const targets = new Map<string, { path: string; type: string }>();
    for (const [, , attrs] of (meta["xl/_rels/workbook.xml.rels"] ?? "").matchAll(tags("Relationship"))) {
      const id = attr(attrs, "Id");
      const target = attr(attrs, "Target");
      if (id && target) targets.set(id, { path: resolve("xl", target), type: attr(attrs, "Type") ?? "" });
    }
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

    const shared = read([sharedStringsPath, stylesPath]);
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

    return {
      rows,
      columns,
      cells,
      flags,
      spill,
      rowNumbers,
      columnIndexes,
      widths: columnIndexes.map((c) => widthPx(columnWidths.get(c) ?? defaultWidth)),
      totalRows,
      totalColumns,
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
