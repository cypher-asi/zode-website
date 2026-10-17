import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  PDFName,
  PDFString,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  type Color,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { dayOf, formatMonthYear } from "@/features/deployments/format";
import {
  ACCENT,
  BORDER,
  DIAMOND,
  INK,
  PAPER,
  SECONDARY,
  TERTIARY,
  WHITE,
  clampLine,
  drawText,
  drawTextRight,
  drawWordmark,
  embedBrand,
  trackedWidth,
  wrap,
  wrapClamped,
  type Fonts,
} from "@/features/pdf/brand";
import { BRAND } from "@/features/styleguide/brand";
import { SITE_URL } from "@/lib/site";
import { clusterArt } from "./clusterArt";
import {
  linesOf,
  type LabeledValue,
  type PresentationContent,
  type PricingRow,
  type Section,
  type SiteContent,
  type SiteImage,
  type SitePoint,
  type SpecCell,
} from "./types";

/*
 * A presentation as 16:9 ZODE-branded slides, set like a spec sheet: an ink
 * cover with the wordmark over its headline, an exploded drawing of the
 * cluster and a stack of its specs, then a slide for each part that has
 * something in it (at a glance, the site, capacity and rollout, the cluster,
 * the notes, terms), each numbered large beside its heading, over a footer
 * with the wordmark. A site with a profile then gets a section of its own,
 * from a divider over its photo through its property, power, reliability,
 * efficiency, plant and location, before next steps. Every block clamps its
 * lines, and the limits in ./types keep the longest text on its slide.
 */

/** Site profiles' images, read with fs; next.config's outputFileTracingIncludes ships them with each PDF route. */
const SITES = path.join(process.cwd(), "src/features/presentations/sites");

const W = 960;
const H = 540;
const MARGIN = 56;
const CONTENT = W - MARGIN * 2;
/** The baseline of a slide's heading and number. */
const HEADER = H - 92;
/** The light display face's cap height, per point of size. */
const CAP = 0.7;
/** Room for the two-line caps label beside the cover's title. */
const LABEL = 220;
/** Where a slide's body starts, under its header. */
const BODY_TOP = H - 146;
/** Where a slide's body has to stop, clear of the footer. */
const FLOOR = 64;
const COLUMN_GAP = 44;
/** The left column of a two-column slide. */
const LEFT = 470;
const RIGHT_X = MARGIN + LEFT + COLUMN_GAP;
const RIGHT = CONTENT - LEFT - COLUMN_GAP;

/** The largest size up to `max` at which `value` fits `width`, a hair under so rounding doesn't cut it. */
const fitSize = (value: string, font: PDFFont, max: number, width: number): number =>
  Math.max(9, Math.min(max, (0.995 * max * width) / Math.max(font.widthOfTextAtSize(value, max), 1)));

class Slide {
  constructor(
    private readonly doc: PDFDocument,
    readonly page: PDFPage,
    readonly fonts: Fonts,
  ) {}

  text(value: string, x: number, y: number, font: PDFFont, size: number, fill: Color, tracking = 0): number {
    return drawText(this.page, value, x, y, font, size, fill, tracking);
  }

  /** `value` cut to `width` on one line. */
  line(value: string, x: number, y: number, width: number, font: PDFFont, size: number, fill: Color, tracking = 0): number {
    return this.text(clampLine(value, font, size, width, tracking), x, y, font, size, fill, tracking);
  }

  /** A mono caps label cut to `width`. */
  label(value: string, x: number, y: number, width: number, fill: Color = SECONDARY): void {
    this.line(value.toUpperCase(), x, y, width, this.fonts.mono, 7, fill, 1.2);
  }

  /** Two lines of caps beside a large heading, their tops at `top`, the second in `second`. */
  caption(lines: readonly string[], x: number, top: number, width: number, fill: Color, second: Color = fill): void {
    lines.forEach((value, i) =>
      this.line(value.toUpperCase(), x, top - 8 - i * 13, width, i ? this.fonts.regular : this.fonts.medium, 9.5, i ? second : fill, 0.6),
    );
  }

  hairline(x: number, y: number, width: number, fill: Color = BORDER): void {
    this.page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.6, color: fill });
  }

  rule(x: number, top: number, height: number, fill: Color = BORDER): void {
    this.page.drawLine({ start: { x, y: top }, end: { x, y: top - height }, thickness: 0.6, color: fill });
  }

  link(x: number, y: number, width: number, height: number, url: string): void {
    const annotation = this.doc.context.register(
      this.doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [x, y, x + width, y + height],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
      }),
    );
    this.page.node.addAnnot(annotation);
  }

  /** A caps heading over a hairline, `width` wide from `x`; returns the y under it. */
  title(value: string, x: number, y: number, width: number): number {
    this.text(value.toUpperCase(), x, y, this.fonts.semibold, 8.5, INK, 1.2);
    this.hairline(x, y - 8, width);
    return y - 28;
  }

  /** Wrapped text from `y` down, no lower than `floor`; returns the y under it. */
  paragraph(value: string, x: number, y: number, width: number, size: number, leading: number, floor = FLOOR): number {
    for (const paragraph of value.split("\n").filter((p) => p.trim())) {
      if (y < floor) break;
      for (const line of wrapClamped(paragraph, this.fonts.regular, size, width, Math.floor((y - floor) / leading) + 1)) {
        this.text(line, x, y, this.fonts.regular, size, INK);
        y -= leading;
      }
      y -= leading * 0.45;
    }
    return y;
  }

  /** Diamond bullets from `y` down; returns the y under them. */
  bullets(items: readonly string[], x: number, y: number, width: number, size: number, floor = FLOOR): number {
    const leading = size * 1.42;
    for (const item of items) {
      if (y < floor) break;
      this.page.drawSvgPath(DIAMOND, { x: x + 3, y: y + size * 0.35, scale: 0.62, color: ACCENT });
      for (const line of wrapClamped(item, this.fonts.regular, size, width - 16, 3)) {
        if (y < floor) break;
        this.text(line, x + 16, y, this.fonts.regular, size, INK);
        y -= leading;
      }
      y -= size * 0.55;
    }
    return y;
  }

  /** Values over their caps labels, `columns` to a row, from `y` down; returns the y under them. */
  facts(items: readonly LabeledValue[], x: number, y: number, width: number, columns: number, floor = FLOOR): number {
    const gap = 22;
    const cell = (width - gap * (columns - 1)) / columns;
    for (let start = 0; start < items.length; start += columns) {
      if (y - 30 < floor) break;
      let lowest = y;
      items.slice(start, start + columns).forEach((item, i) => {
        const cx = x + i * (cell + gap);
        let vy = y;
        for (const line of wrapClamped(item.value, this.fonts.medium, 12.5, cell, 2)) {
          this.text(line, cx, vy, this.fonts.medium, 12.5, INK);
          vy -= 16;
        }
        this.label(item.label, cx, vy + 2, cell);
        lowest = Math.min(lowest, vy - 8);
      });
      this.hairline(x, lowest, width);
      y = lowest - 22;
    }
    return y;
  }

  /**
   * Figures in equal columns from `top` over a hairline, each a large light
   * value over its caps label, with rules between; returns the y under them.
   */
  figures(items: readonly LabeledValue[], x: number, top: number, width: number, size: number): number {
    const { display } = this.fonts;
    const cell = width / items.length;
    const value = top - 12 - size * CAP;
    const bottom = value - 30;
    this.hairline(x, bottom, width);
    items.forEach((item, i) => {
      const cx = x + i * cell + (i ? 16 : 0);
      const cw = cell - (i ? 32 : 16);
      if (i) this.rule(x + i * cell, top, top - bottom);
      this.line(item.value, cx, value, cw, display, fitSize(item.value, display, size, cw), INK);
      this.label(item.label, cx, value - 18, cw);
    });
    return bottom;
  }

  /**
   * `image` in the box from (`x`, `y`) up: cropped to fill it with `cover`,
   * or whole and set at its top left otherwise. Returns the box it took.
   */
  image(image: PDFImage, x: number, y: number, width: number, height: number, cover = false): { y: number; width: number } {
    const scale = (cover ? Math.max : Math.min)(width / image.width, height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    if (!cover) {
      this.page.drawImage(image, { x, y: y + height - h, width: w, height: h });
      return { y: y + height - h, width: w };
    }
    this.page.pushOperators(pushGraphicsState(), rectangle(x, y, width, height), clip(), endPath());
    this.page.drawImage(image, { x: x + (width - w) / 2, y: y + (height - h) / 2, width: w, height: h });
    this.page.pushOperators(popGraphicsState());
    return { y, width };
  }

  /** A small line in grey, as set under an image or a table. */
  note(value: string, x: number, y: number, width: number): void {
    this.line(value, x, y, width, this.fonts.regular, 8.5, SECONDARY);
  }

  /** Numbered points from `y` down, each a heading over its text and a hairline; returns the y under them. */
  points(items: readonly SitePoint[], x: number, y: number, width: number): number {
    const { fonts } = this;
    for (const [i, item] of items.entries()) {
      if (y - 30 < FLOOR) break;
      this.text(String(i + 1).padStart(2, "0"), x, y, fonts.mono, 9, ACCENT, 1);
      this.line(item.title, x + 30, y, width - 30, fonts.semibold, 12.5, INK);
      let ty = y - 17;
      for (const line of wrapClamped(item.text, fonts.regular, 11, width - 30, 3)) {
        this.text(line, x + 30, ty, fonts.regular, 11, INK);
        ty -= 15;
      }
      this.hairline(x, ty + 3, width);
      y = ty - 17;
    }
    return y;
  }

  /** Labeled values a row each between hairlines, each value up to two lines; returns the y under them. */
  rows(items: readonly LabeledValue[], x: number, y: number, width: number): number {
    const { regular } = this.fonts;
    for (const item of items) {
      if (y - 26 < FLOOR) break;
      this.label(item.label, x, y, width);
      let vy = y - 16;
      for (const line of wrapClamped(item.value, regular, 11.5, width, 2)) {
        this.text(line, x, vy, regular, 11.5, INK);
        vy -= 15;
      }
      this.hairline(x, vy + 5, width);
      y = vy - 12;
    }
    return y;
  }
}

/** The PDF's slides, each content slide numbered large beside its heading. */
class Deck {
  constructor(
    readonly doc: PDFDocument,
    readonly fonts: Fonts,
    readonly wordmark: string,
    /** In every content slide's footer. */
    readonly address: string,
  ) {}

  /** The pages set on ink, by index, whose footers are white. */
  readonly dark = new Set<number>([0]);

  /** A content slide under its heading and number; returns it to fill from BODY_TOP. */
  slide(heading: string): Slide {
    const page = this.doc.addPage([W, H]);
    const s = new Slide(this.doc, page, this.fonts);
    const { display } = this.fonts;
    const number = String(this.doc.getPageCount()).padStart(2, "0");
    const numberWidth = display.widthOfTextAtSize(number, 64);
    s.text(number, W - MARGIN - numberWidth, HEADER, display, 64, INK);
    const room = CONTENT - numberWidth - 40;
    s.line(heading, MARGIN, HEADER, room, display, fitSize(heading, display, 40, room), INK);
    s.hairline(MARGIN, HEADER - 20, CONTENT);
    return s;
  }

  /** Every slide's footer but the cover's: the wordmark, the site's address, and the page of the total. */
  footers(today: string): void {
    const { mono } = this.fonts;
    const pages = this.doc.getPages();
    const month = formatMonthYear(dayOf(today)).toUpperCase();
    pages.forEach((page, i) => {
      if (i === 0) return;
      const dark = this.dark.has(i);
      const fill = dark ? TERTIARY : SECONDARY;
      page.drawLine({
        start: { x: MARGIN, y: 42 },
        end: { x: W - MARGIN, y: 42 },
        thickness: 0.6,
        color: dark ? SECONDARY : BORDER,
      });
      drawWordmark(page, this.wordmark, MARGIN, 32.5, 7, dark ? WHITE : INK);
      const right = `CONFIDENTIAL · ${month} · ${i + 1} / ${pages.length}`;
      const room = CONTENT - 54 - trackedWidth(right, mono, 6.5, 1) - 32;
      const left = [BRAND.domain, this.address].filter(Boolean).join(" · ").toUpperCase();
      drawText(page, clampLine(left, mono, 6.5, room, 1), MARGIN + 54, 26, mono, 6.5, fill, 1);
      drawTextRight(page, right, W - MARGIN, 26, mono, 6.5, fill, 1);
    });
  }
}

/** The cover's columns: its title on the left, its specs stacked on the right, the drawing between. */
const COVER_LEFT = 290;
const COVER_RIGHT = 210;
const COVER_GAP = 32;
/** The cover's headline: this size, or smaller until it fits whole in `COVER_LINES`. */
const COVER_HEADLINE = 27;
const COVER_LINES = 5;
/** The cover's drawing, as a share of its column and the page's height between the margins. */
const COVER_ART = 0.9;

/** The cover's headline in lines at the largest size up to `COVER_HEADLINE` that keeps all of it in `COVER_LINES`. */
function coverHeadline(headline: string, font: PDFFont): { size: number; lines: string[] } {
  for (let size = COVER_HEADLINE; size > 16; size -= 1) {
    const lines = wrap(headline, font, size, COVER_LEFT);
    if (lines.length <= COVER_LINES && lines.every((line) => font.widthOfTextAtSize(line, size) <= COVER_LEFT)) return { size, lines };
  }
  return { size: 16, lines: wrapClamped(headline, font, 16, COVER_LEFT, COVER_LINES) };
}

/** The height of one of the cover's spec cells, as `coverCell` sets it. */
const coverCellHeight = (s: Slide, cell: SpecCell): number =>
  20 + (cell.text ? wrapClamped(cell.text, s.fonts.regular, 9.5, COVER_RIGHT, 3).length * 13 : 0) + (cell.values.length ? 28 : 0);

/** One cell of the cover's spec stack from `top`: a hairline, its heading, then its text or its figures in pairs. */
function coverCell(s: Slide, cell: SpecCell, x: number, top: number): void {
  const { fonts } = s;
  s.hairline(x, top, COVER_RIGHT, SECONDARY);
  s.line(cell.title.toUpperCase(), x, top - 16, COVER_RIGHT, fonts.semibold, 8.5, WHITE, 1.2);
  let y = top - 33;
  if (cell.text) {
    for (const line of wrapClamped(cell.text, fonts.regular, 9.5, COVER_RIGHT, 3)) {
      s.text(line, x, y, fonts.regular, 9.5, PAPER);
      y -= 13;
    }
  }
  const column = COVER_RIGHT / 2;
  cell.values.forEach((value, i) => {
    const cx = x + (i % 2) * column;
    s.line(value.value, cx, y - 2, column - 12, fonts.medium, 13, WHITE);
    s.line(value.label, cx, y - 15, column - 12, fonts.regular, 8.5, TERTIARY);
  });
}

/**
 * The cover, on ink without a footer: the wordmark large at the top left
 * over the headline and the deployment's name, the cluster's drawing
 * centred in the middle, and its specs stacked down the right.
 */
function cover(deck: Deck, p: PresentationContent, today: string): void {
  const { fonts } = deck;
  const page = deck.doc.addPage([W, H]);
  const s = new Slide(deck.doc, page, fonts);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: INK });

  const top = H - MARGIN;
  drawWordmark(page, deck.wordmark, MARGIN, top, 24, WHITE);
  const { size, lines } = coverHeadline(p.headline, fonts.display);
  let y = top - 91 - size * CAP;
  for (const line of lines) {
    s.text(line, MARGIN, y, fonts.display, size, WHITE);
    y -= size * 1.18;
  }
  s.caption([p.title], MARGIN, y - 6, COVER_LEFT, WHITE);
  s.label(`Confidential · ${formatMonthYear(dayOf(today))}`, MARGIN, MARGIN, COVER_LEFT, TERTIARY);

  const column = CONTENT - COVER_LEFT - COVER_RIGHT - COVER_GAP * 2;
  const art = { width: column * COVER_ART, height: (H - MARGIN * 2) * COVER_ART };
  const artX = MARGIN + COVER_LEFT + COVER_GAP + (column - art.width) / 2;
  clusterArt(p.cooling).draw(page, { x: artX, y: (H - art.height) / 2, ...art }, {
    ground: INK,
    stroke: WHITE,
    edge: 0.75,
    fine: 0.4,
  });

  const x = W - MARGIN - COVER_RIGHT;
  const gap = 18;
  const heights = p.cover.map((cell) => coverCellHeight(s, cell));
  let cellTop = H / 2 + (heights.reduce((sum, h) => sum + h, 0) + gap * (heights.length - 1)) / 2;
  p.cover.forEach((cell, i) => {
    coverCell(s, cell, x, cellTop);
    cellTop -= heights[i] + gap;
  });
}

function atAGlance(deck: Deck, p: PresentationContent): void {
  const stats = p.stats.filter((stat) => stat.value || stat.label);
  const highlights = linesOf(p.highlights);
  if (!stats.length && !p.summary && !highlights.length) return;
  const s = deck.slide("At a glance");
  let y = BODY_TOP;
  if (stats.length) y = s.figures(stats, MARGIN, y + 10, CONTENT, 30) - 34;
  twoColumns(s, y, p.summary ? { title: "Overview", text: p.summary } : null, highlights.length ? { title: "Why this site", items: highlights } : null);
}

/** Text on the left and bullets or facts on the right, either taking the full width alone. */
function twoColumns(
  s: Slide,
  top: number,
  left: { title: string; text: string; items?: readonly string[] } | null,
  right: { title: string; items?: readonly string[]; facts?: readonly LabeledValue[]; columns?: number } | null,
): void {
  const both = Boolean(left && right);
  if (left) {
    const width = both ? LEFT : CONTENT;
    let y = s.title(left.title, MARGIN, top, width);
    if (left.text) y = s.paragraph(left.text, MARGIN, y, width, 13, 19.5);
    if (left.items?.length) s.bullets(left.items, MARGIN, y - 6, width, 12.5);
  }
  if (right) {
    const x = both ? RIGHT_X : MARGIN;
    const width = both ? RIGHT : CONTENT;
    const y = s.title(right.title, x, top, width);
    if (right.items?.length) s.bullets(right.items, x, y, width, 12.5);
    if (right.facts?.length) s.facts(right.facts, x, y, width, right.columns ?? (both ? 2 : 4));
  }
}

function site(deck: Deck, p: PresentationContent): void {
  if (!p.siteSummary && !p.siteFacts.length) return;
  const s = deck.slide("The site");
  twoColumns(
    s,
    BODY_TOP,
    p.siteSummary ? { title: "Overview", text: p.siteSummary } : null,
    p.siteFacts.length ? { title: "Key facts", facts: p.siteFacts } : null,
  );
}

function rollout(deck: Deck, p: PresentationContent): void {
  if (!p.rollout.length) return;
  const s = deck.slide("Capacity and rollout");
  const { fonts, page } = s;
  const cols = [0, CONTENT * 0.24, CONTENT * 0.66];
  let y = BODY_TOP;
  s.label("Phase", MARGIN, y, cols[1] - 12);
  s.label("Capacity", MARGIN + cols[1], y, cols[2] - cols[1] - 12);
  s.label("Power", MARGIN + cols[2], y, CONTENT * 0.14);
  drawTextRight(page, "READY FOR SERVICE", MARGIN + CONTENT, y, fonts.mono, 7, SECONDARY, 1.2);
  y -= 10;
  for (const [i, row] of p.rollout.entries()) {
    s.hairline(MARGIN, y, CONTENT, i === 0 ? INK : BORDER);
    y -= 22;
    page.drawSvgPath(DIAMOND, { x: MARGIN + 4, y: y + 4.5, scale: 0.75, color: i === 0 ? ACCENT : INK });
    s.line(row.label, MARGIN + 16, y, cols[1] - 28, fonts.semibold, 12.5, INK);
    s.line(row.capacity, MARGIN + cols[1], y, cols[2] - cols[1] - 12, fonts.regular, 12.5, INK);
    s.line(row.power, MARGIN + cols[2], y, CONTENT * 0.14, fonts.regular, 12.5, INK);
    drawTextRight(page, clampLine(row.date, fonts.medium, 12.5, CONTENT * 0.18), MARGIN + CONTENT, y, fonts.medium, 12.5, INK);
    y -= 12;
  }
  s.hairline(MARGIN, y, CONTENT);

  // A timeline of the phases in order, when there's room under the table.
  const line = Math.min(y - 70, 128);
  if (line < FLOOR + 40) return;
  const n = p.rollout.length;
  s.hairline(MARGIN, line, CONTENT, SECONDARY);
  p.rollout.forEach((row, i) => {
    const x = MARGIN + (CONTENT * (i + 0.5)) / n;
    const width = CONTENT / n - 16;
    page.drawSvgPath(DIAMOND, { x, y: line, scale: 1.2, color: i === 0 ? ACCENT : INK });
    const label = clampLine(row.label, fonts.semibold, 12, width);
    s.text(label, x - fonts.semibold.widthOfTextAtSize(label, 12) / 2, line + 18, fonts.semibold, 12, INK);
    const date = clampLine(row.date, fonts.regular, 11, width);
    s.text(date, x - fonts.regular.widthOfTextAtSize(date, 11) / 2, line - 26, fonts.regular, 11, SECONDARY);
  });
}

/** The exploded drawing on the left, the overview and specifications beside it. */
function cluster(deck: Deck, p: PresentationContent): void {
  if (!p.clusterSummary && !p.specs.length) return;
  const s = deck.slide("The cluster");
  const art = 340;
  clusterArt(p.cooling).draw(s.page, { x: MARGIN, y: FLOOR, width: art, height: BODY_TOP + 10 - FLOOR }, {
    ground: WHITE,
    stroke: INK,
    edge: 0.7,
    fine: 0.35,
  });
  const x = MARGIN + art + COLUMN_GAP;
  const width = CONTENT - art - COLUMN_GAP;
  let y = BODY_TOP;
  if (p.clusterSummary) {
    y = s.title("Overview", x, y, width);
    y = s.paragraph(p.clusterSummary, x, y, width, 12, 17.5) - 14;
  }
  if (p.specs.length) s.facts(p.specs, x, s.title("Specifications", x, y, width), width, 2);
}

function section(deck: Deck, section: Section): void {
  const s = deck.slide(section.title);
  const bullets = linesOf(section.bullets);
  const text = section.body || bullets.length ? { title: "Overview", text: section.body, items: bullets } : null;
  twoColumns(s, BODY_TOP, text, section.facts.length ? { title: "Key facts", facts: section.facts, columns: text ? 1 : 3 } : null);
}

/** Columns of the pricing table: a share of the width each, and whether it's set flush right. */
const PRICING_COLUMNS: readonly { label: string; key: keyof PricingRow; share: number; right?: boolean }[] = [
  { label: "Phase", key: "label", share: 0.15 },
  { label: "Platform", key: "platform", share: 0.17 },
  { label: "GPUs", key: "gpus", share: 0.09, right: true },
  { label: "Per GPU-hour", key: "price", share: 0.13, right: true },
  { label: "Term", key: "term", share: 0.11, right: true },
  { label: "Contract value", key: "contract", share: 0.16, right: true },
  { label: "Deposit", key: "deposit", share: 0.19, right: true },
];

const TERM_KEYS = new Set<keyof PricingRow>(["price", "term", "contract", "deposit"]);

/** Each phase's terms in a table from `top`, the ones to follow in grey; returns the y under it. */
function pricingTable(s: Slide, p: PresentationContent, top: number): number {
  const { fonts, page } = s;
  const cells = (y: number, value: (key: keyof PricingRow) => string, font: PDFFont, size: number, fill: (key: keyof PricingRow) => Color, tracking = 0) => {
    let x = MARGIN;
    for (const column of PRICING_COLUMNS) {
      const width = CONTENT * column.share - 12;
      const text = clampLine(value(column.key), font, size, width, tracking);
      if (column.right) drawTextRight(page, text, x + CONTENT * column.share, y, font, size, fill(column.key), tracking);
      else s.text(text, x, y, font, size, fill(column.key), tracking);
      x += CONTENT * column.share;
    }
  };
  const labels = Object.fromEntries(PRICING_COLUMNS.map((column) => [column.key, column.label.toUpperCase()]));
  cells(top, (key) => labels[key], fonts.mono, 7, () => SECONDARY, 1.2);
  let y = top - 10;
  for (const row of p.pricing) {
    s.hairline(MARGIN, y, CONTENT);
    y -= 19;
    const toFollow = !row.term && !row.contract;
    cells(
      y,
      (key) => row[key] || "–",
      fonts.regular,
      11.5,
      (key) => (toFollow && TERM_KEYS.has(key) ? SECONDARY : INK),
    );
    y -= 10;
  }
  s.hairline(MARGIN, y, CONTENT);
  return y;
}

function terms(deck: Deck, p: PresentationContent): void {
  if (!p.terms.length) return;
  const s = deck.slide("Commercial terms");
  let bottom = s.figures(p.terms, MARGIN, BODY_TOP + 10, CONTENT, 28);
  if (p.pricing.length) bottom = pricingTable(s, p, bottom - 30);
  const note = p.pricing.length
    ? "Contract value is GPUs × price per GPU-hour × 730 hours a month over the term. Indicative and non-binding, subject to a definitive agreement."
    : "Indicative and non-binding, subject to a definitive agreement.";
  s.line(note, MARGIN, bottom - 24, CONTENT, s.fonts.regular, 10.5, SECONDARY);
}

/** A site profile's images, each embedded once, by file. */
async function embedSiteImages(doc: PDFDocument, site: SiteContent): Promise<Map<string, PDFImage>> {
  const files = new Set(
    [site.photo, site.property.image, site.why.image, site.plant.image, site.plant.inset, site.location.image].map((image) => image.file),
  );
  return new Map(
    await Promise.all([...files].map(async (file) => [file, await doc.embedJpg(await readFile(path.join(SITES, site.folder, file)))] as const)),
  );
}

/** The site section's slides. */
class SiteSection {
  constructor(
    readonly deck: Deck,
    readonly site: SiteContent,
    private readonly images: Map<string, PDFImage>,
  ) {}

  /** `image` in the box from (`x`, `y`) up, its caption under it; drawings sit whole in a hairline frame. */
  figure(s: Slide, image: SiteImage, x: number, y: number, width: number, height: number, cover = false): void {
    const embedded = this.images.get(image.file)!;
    const box = s.image(embedded, x, y + 14, width, height - 14, cover);
    if (!cover) s.page.drawRectangle({ x, y: box.y, width: box.width, height: y + height - box.y, borderColor: BORDER, borderWidth: 0.6 });
    s.note(image.caption, x, box.y - 13, box.width);
  }

  divider(): void {
    const { deck, site } = this;
    const { fonts } = deck;
    const page = deck.doc.addPage([W, H]);
    deck.dark.add(deck.doc.getPageCount() - 1);
    const s = new Slide(deck.doc, page, fonts);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: INK });
    s.image(this.images.get(site.photo.file)!, 0, 0, W, H, true);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: INK, opacity: 0.62 });

    const top = H - 112;
    const number = String(deck.doc.getPageCount()).padStart(2, "0");
    const numberWidth = fonts.display.widthOfTextAtSize(number, 76);
    s.text(number, W - MARGIN - numberWidth, top, fonts.display, 76, WHITE);
    const caption = site.caption.split(" · ");
    const captionWidth = Math.max(...caption.map((line) => trackedWidth(line.toUpperCase(), fonts.medium, 9.5, 0.6)), 0);
    const room = CONTENT - numberWidth - Math.min(captionWidth, LABEL) - 48;
    const size = fitSize(site.name, fonts.display, 76, room);
    const width = s.line(site.name, MARGIN, top, room, fonts.display, size, WHITE);
    s.caption(caption, MARGIN + width + 16, top + size * CAP, LABEL, WHITE, PAPER);

    const lede = wrapClamped(site.lede, fonts.regular, 16, 560, 4);
    lede.forEach((line, i) => s.text(line, MARGIN, 96 + (lede.length - 1 - i) * 22, fonts.regular, 16, WHITE));
    s.line(site.photo.caption, MARGIN, 58, CONTENT, fonts.regular, 7.5, PAPER);
  }

  property(): void {
    const { property } = this.site;
    const s = this.deck.slide("The property");
    const art = 400;
    this.figure(s, property.image, MARGIN, FLOOR + 14, art, BODY_TOP + 10 - FLOOR - 14, true);
    const x = MARGIN + art + COLUMN_GAP;
    s.rows(property.facts, x, BODY_TOP, CONTENT - art - COLUMN_GAP);
  }

  why(): void {
    const { why } = this.site;
    const s = this.deck.slide(`Why ${this.site.name}`);
    const list = 400;
    s.points(why.points, MARGIN, BODY_TOP, list);
    const x = MARGIN + list + COLUMN_GAP;
    this.figure(s, why.image, x, FLOOR + 14, CONTENT - list - COLUMN_GAP, BODY_TOP + 10 - FLOOR - 14);
  }

  capacity(): void {
    const { capacity } = this.site;
    const s = this.deck.slide("Power and capacity");
    const y = s.figures(capacity.figures, MARGIN, BODY_TOP + 10, CONTENT, 30) - 34;
    const gap = 32;
    const width = (CONTENT - gap * (capacity.columns.length - 1)) / capacity.columns.length;
    capacity.columns.forEach((column, i) => {
      const x = MARGIN + i * (width + gap);
      s.bullets(column.items, x, s.title(column.title, x, y, width), width, 11.5);
    });
  }

  reliability(): void {
    const { reliability } = this.site;
    const s = this.deck.slide("Reliability");
    const { fonts } = s;
    const top = s.paragraph(reliability.lede, MARGIN, BODY_TOP, CONTENT, 13, 19.5) - 6;
    const columns = 3;
    const cell = CONTENT / columns;
    const height = 112;
    reliability.cells.forEach((item, i) => {
      const column = i % columns;
      const rowTop = top - Math.floor(i / columns) * height;
      const x = MARGIN + column * cell + (column ? 16 : 0);
      const width = cell - (column ? 32 : 16);
      if (column === 0) s.hairline(MARGIN, rowTop, CONTENT, i ? BORDER : INK);
      else s.rule(MARGIN + column * cell, rowTop, height);
      s.page.drawSvgPath(DIAMOND, { x: x + 3, y: rowTop - 22 + 4.5, scale: 0.62, color: ACCENT });
      s.line(item.title, x + 14, rowTop - 22, width - 14, fonts.semibold, 12, INK);
      wrapClamped(item.text, fonts.regular, 11, width, 4).forEach((line, j) => s.text(line, x, rowTop - 42 - j * 15, fonts.regular, 11, INK));
    });
    const bottom = top - Math.ceil(reliability.cells.length / columns) * height;
    s.hairline(MARGIN, bottom, CONTENT);
    s.note(reliability.source, MARGIN, bottom - 18, CONTENT);
  }

  efficiency(): void {
    const { efficiency } = this.site;
    const s = this.deck.slide("Efficiency");
    const { fonts, page } = s;
    let y = s.title("PUE · lower is better", MARGIN, BODY_TOP, LEFT) - 4;
    const labels = 170;
    const x0 = MARGIN + labels;
    const span = LEFT - labels - 44;
    const [min, max] = [1, 1.3];
    const at = (value: number) => x0 + (span * (value - min)) / (max - min);
    for (const row of efficiency.rows) {
      s.line(row.label, MARGIN, y, labels - 12, fonts.semibold, 11.5, INK);
      s.line(row.detail, MARGIN, y - 13, labels - 12, fonts.regular, 8.5, SECONDARY);
      const fill = row.outcome ? ACCENT : row.value >= max ? BORDER : INK;
      page.drawRectangle({ x: x0, y: y - 12, width: at(row.value) - x0, height: 18, color: fill });
      s.text(row.value.toFixed(row.value === max ? 2 : 3), at(row.value) + 8, y - 6, fonts.medium, 11.5, row.outcome ? ACCENT : INK);
      y -= 58;
    }
    s.hairline(x0, y + 26, span);
    for (const tick of [1, 1.1, 1.2, 1.3]) {
      s.rule(at(tick), y + 26, 4, SECONDARY);
      const label = tick.toFixed(1);
      s.text(label, at(tick) - fonts.mono.widthOfTextAtSize(label, 7) / 2, y + 12, fonts.mono, 7, SECONDARY);
    }
    s.note(efficiency.source, MARGIN, FLOOR + 6, LEFT);

    const bottom = s.figures([efficiency.figure], RIGHT_X, BODY_TOP + 10, RIGHT, 34);
    s.bullets(efficiency.points, RIGHT_X, s.title("Lower cost, better ESG", RIGHT_X, bottom - 30, RIGHT), RIGHT, 11.5);
  }

  plant(): void {
    const { plant } = this.site;
    const s = this.deck.slide("The plant");
    this.figure(s, plant.image, MARGIN, FLOOR + 14, LEFT, BODY_TOP + 10 - FLOOR - 14);
    const y = s.bullets(plant.points, RIGHT_X, s.title("Rooftop heat-rejection yard", RIGHT_X, BODY_TOP, RIGHT), RIGHT, 11);
    const inset = Math.min(y - 18 - FLOOR - 14, 120);
    if (inset > 60) this.figure(s, plant.inset, RIGHT_X, FLOOR + 14, RIGHT, inset, true);
  }

  location(): void {
    const { location } = this.site;
    const s = this.deck.slide("Location and connectivity");
    this.figure(s, location.image, MARGIN, FLOOR + 14, LEFT, BODY_TOP + 10 - FLOOR - 14);
    s.points(location.points, RIGHT_X, BODY_TOP, RIGHT);
  }
}

/** The site's section: a divider over its photo, then a slide for each part of its profile. */
async function siteSection(deck: Deck, site: SiteContent): Promise<void> {
  const section = new SiteSection(deck, site, await embedSiteImages(deck.doc, site));
  section.divider();
  section.property();
  section.why();
  section.capacity();
  section.reliability();
  section.efficiency();
  section.plant();
  section.location();
}

function nextSteps(deck: Deck, p: PresentationContent): void {
  const steps = linesOf(p.nextSteps);
  const s = deck.slide("Next steps");
  const { fonts } = s;
  const panel = 300;
  const listWidth = steps.length ? CONTENT - panel - COLUMN_GAP : 0;
  let y = BODY_TOP - 6;
  steps.forEach((step, i) => {
    if (y < FLOOR + 20) return;
    s.text(String(i + 1).padStart(2, "0"), MARGIN, y, fonts.mono, 11, ACCENT, 1);
    for (const line of wrapClamped(step, fonts.regular, 14, listWidth - 44, 2)) {
      s.text(line, MARGIN + 40, y, fonts.regular, 14, INK);
      y -= 19;
    }
    s.hairline(MARGIN, y + 4, listWidth);
    y -= 22;
  });

  const x = steps.length ? MARGIN + CONTENT - panel : MARGIN;
  let cy = s.title("Contact", x, BODY_TOP, panel);
  s.line(p.contactName || BRAND.company, x, cy - 10, panel, fonts.display, 24, INK);
  cy -= 40;
  if (p.contactEmail) {
    const width = s.line(p.contactEmail, x, cy, panel, fonts.regular, 12, INK);
    s.link(x, cy - 3, width, 15, `mailto:${p.contactEmail}`);
    cy -= 20;
  }
  const width = s.line(BRAND.domain, x, cy, panel, fonts.regular, 12, SECONDARY);
  s.link(x, cy - 3, width, 15, SITE_URL);
}

/** The presentation's PDF, dated `today` (`YYYY-MM-DD`). */
export async function renderPresentationPdf(presentation: PresentationContent, today: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { fonts, wordmark } = await embedBrand(doc);
  const p = presentation;
  const deck = new Deck(doc, fonts, wordmark, p.address);

  cover(deck, p, today);
  atAGlance(deck, p);
  // A site's own section covers what the deployment's site slide would.
  if (!p.site) site(deck, p);
  rollout(deck, p);
  cluster(deck, p);
  for (const added of p.sections) section(deck, added);
  terms(deck, p);
  if (p.site) await siteSection(deck, p.site);
  nextSteps(deck, p);
  deck.footers(today);

  doc.setTitle(`ZODE \u2013 ${p.title}`);
  doc.setSubject(p.subtitle || "Site overview");
  doc.setAuthor(BRAND.company);
  doc.setCreator(BRAND.domain);
  doc.setProducer(BRAND.domain);
  doc.setLanguage("en-US");
  doc.catalog.set(PDFName.of("ViewerPreferences"), doc.context.obj({ DisplayDocTitle: true }));
  return doc.save();
}
