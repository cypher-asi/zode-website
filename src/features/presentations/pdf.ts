import "server-only";
import { PDFDocument, PDFName, PDFString, type Color, type PDFFont, type PDFPage } from "pdf-lib";
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
  wrapClamped,
  type Fonts,
} from "@/features/pdf/brand";
import { BRAND } from "@/features/styleguide/brand";
import { SITE_URL } from "@/lib/site";
import { clusterArt } from "./clusterArt";
import { linesOf, type LabeledValue, type PresentationContent, type Section, type SpecCell } from "./types";

/*
 * A presentation as 16:9 ZODE-branded slides, set like a spec sheet: an ink
 * cover with the site's name and number large over an exploded drawing of the
 * cluster and a grid of its specs, then a slide for each part that has
 * something in it (at a glance, the site, capacity and rollout, the cluster,
 * the notes, terms, next steps), each numbered large beside its heading, over
 * a footer with the wordmark. Every block clamps its lines, and the limits in
 * ./types keep the longest text on its slide.
 */

const W = 960;
const H = 540;
const MARGIN = 56;
const CONTENT = W - MARGIN * 2;
/** The baseline of a slide's heading and number. */
const HEADER = H - 92;
/** The light display face's cap height, per point of size. */
const CAP = 0.7;
/** Room for the two-line caps label beside a heading. */
const LABEL = 180;
/** Where a slide's body starts, under its header. */
const BODY_TOP = H - 146;
/** Where a slide's body has to stop, clear of the footer. */
const FLOOR = 64;
const COLUMN_GAP = 44;
/** The left column of a two-column slide. */
const LEFT = 470;
const RIGHT_X = MARGIN + LEFT + COLUMN_GAP;
const RIGHT = CONTENT - LEFT - COLUMN_GAP;

/** The largest size up to `max` at which `value` fits `width`. */
const fitSize = (value: string, font: PDFFont, max: number, width: number): number =>
  Math.max(9, Math.min(max, (max * width) / Math.max(font.widthOfTextAtSize(value, max), 1)));

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

  /** Two lines of small caps, as set beside a large heading, their tops at `top`. */
  caption(lines: readonly string[], x: number, top: number, width: number, fill: Color): void {
    lines.forEach((value, i) => this.line(value.toUpperCase(), x, top - 6 - i * 10.5, width, this.fonts.regular, 7.5, fill, 0.6));
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
}

/** The PDF's slides, each content slide numbered large beside its heading. */
class Deck {
  constructor(
    readonly doc: PDFDocument,
    readonly fonts: Fonts,
    readonly wordmark: string,
    /** Set beside every content slide's heading. */
    readonly caption: readonly string[],
  ) {}

  /** A content slide under its heading and number; returns it to fill from BODY_TOP. */
  slide(heading: string): Slide {
    const page = this.doc.addPage([W, H]);
    const s = new Slide(this.doc, page, this.fonts);
    const { display } = this.fonts;
    const number = String(this.doc.getPageCount()).padStart(2, "0");
    const numberWidth = display.widthOfTextAtSize(number, 64);
    s.text(number, W - MARGIN - numberWidth, HEADER, display, 64, INK);
    const room = CONTENT - numberWidth - LABEL - 40;
    const size = fitSize(heading, display, 40, room);
    const width = s.line(heading, MARGIN, HEADER, room, display, size, INK);
    s.caption(this.caption, MARGIN + width + 18, HEADER + size * CAP, LABEL, SECONDARY);
    s.hairline(MARGIN, HEADER - 20, CONTENT);
    return s;
  }

  /** Every slide's footer, the wordmark and the page of the total, the cover's in white. */
  footers(today: string): void {
    const pages = this.doc.getPages();
    const month = formatMonthYear(dayOf(today)).toUpperCase();
    pages.forEach((page, i) => {
      const cover = i === 0;
      const fill = cover ? TERTIARY : SECONDARY;
      page.drawLine({
        start: { x: MARGIN, y: 42 },
        end: { x: W - MARGIN, y: 42 },
        thickness: 0.6,
        color: cover ? SECONDARY : BORDER,
      });
      drawWordmark(page, this.wordmark, MARGIN, 32.5, 7, cover ? WHITE : INK);
      drawText(page, BRAND.domain.toUpperCase(), MARGIN + 54, 26, this.fonts.mono, 6.5, fill, 1);
      drawTextRight(page, `CONFIDENTIAL · ${month} · ${i + 1} / ${pages.length}`, W - MARGIN, 26, this.fonts.mono, 6.5, fill, 1);
    });
  }
}

/** One cell of the cover's spec grid: its heading, then its text or its figures in pairs. */
function coverCell(s: Slide, cell: SpecCell, x: number, top: number, width: number): void {
  const { fonts } = s;
  s.line(cell.title.toUpperCase(), x, top, width, fonts.semibold, 8.5, WHITE, 1.2);
  if (cell.text) {
    wrapClamped(cell.text, fonts.regular, 9, Math.min(width, 300), 3).forEach((line, i) =>
      s.text(line, x, top - 16 - i * 11.5, fonts.regular, 9, PAPER),
    );
  }
  const column = Math.min(150, width / Math.max(cell.values.length, 1));
  cell.values.forEach((value, i) => {
    const cx = x + i * column;
    s.line(value.value, cx, top - 17, column - 14, fonts.medium, 11, WHITE);
    s.line(value.label, cx, top - 29, column - 14, fonts.regular, 8, TERTIARY);
  });
}

function cover(deck: Deck, p: PresentationContent): void {
  const { fonts } = deck;
  const page = deck.doc.addPage([W, H]);
  const s = new Slide(deck.doc, page, fonts);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: INK });

  const top = H - 112;
  const numberWidth = fonts.display.widthOfTextAtSize("01", 76);
  s.text("01", W - MARGIN - numberWidth, top, fonts.display, 76, WHITE);
  const caption = p.eyebrow.split(" · ");
  const captionWidth = Math.max(...caption.map((line) => trackedWidth(line.toUpperCase(), fonts.regular, 7.5, 0.6)), 0);
  const room = CONTENT - numberWidth - Math.min(captionWidth, LABEL) - 48;
  const size = fitSize(p.title, fonts.display, 76, room);
  const width = s.line(p.title, MARGIN, top, room, fonts.display, size, WHITE);
  s.caption(caption, MARGIN + width + 16, top + size * CAP, LABEL, PAPER);

  const grid = 104;
  clusterArt(p.cooling).draw(page, { x: MARGIN, y: grid + 28, width: CONTENT, height: top - 24 - (grid + 28) }, {
    ground: INK,
    stroke: WHITE,
    edge: 0.75,
    fine: 0.4,
  });

  const gap = 28;
  const cell = (CONTENT - gap * (p.cover.length - 1)) / Math.max(p.cover.length, 1);
  p.cover.forEach((spec, i) => coverCell(s, spec, MARGIN + i * (cell + gap), grid, cell));
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

function terms(deck: Deck, p: PresentationContent): void {
  if (!p.terms.length) return;
  const s = deck.slide("Commercial terms");
  const bottom = s.figures(p.terms, MARGIN, BODY_TOP + 10, CONTENT, 28);
  s.text("Indicative and non-binding, subject to a definitive agreement.", MARGIN, bottom - 26, s.fonts.regular, 11.5, SECONDARY);
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
  const deck = new Deck(doc, fonts, wordmark, [p.title, "Site overview"]);

  cover(deck, p);
  atAGlance(deck, p);
  site(deck, p);
  rollout(deck, p);
  cluster(deck, p);
  for (const added of p.sections) section(deck, added);
  terms(deck, p);
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
