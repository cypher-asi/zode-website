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
  roundedRect,
  wrapClamped,
  type Fonts,
} from "@/features/pdf/brand";
import { BRAND } from "@/features/styleguide/brand";
import { SITE_URL } from "@/lib/site";
import { linesOf, type LabeledValue, type PresentationContent, type Section } from "./types";

/*
 * A presentation as 16:9 ZODE-branded slides: an ink cover, then a slide for
 * each part that has something in it (at a glance, the site, capacity and
 * rollout, the cluster, the team's own slides, terms, next steps), each under
 * the wordmark with a numbered kicker and a footer. Every block clamps its
 * lines, and the limits in ./types keep the longest text on its slide.
 */

const W = 960;
const H = 540;
const MARGIN = 56;
const CONTENT = W - MARGIN * 2;
/** Where a slide's body starts, under its heading. */
const BODY_TOP = H - 138;
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

  hairline(x: number, y: number, width: number, fill: Color = BORDER): void {
    this.page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.6, color: fill });
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

  /** A caps title over a hairline, `width` wide from `x`; returns the y under it. */
  title(value: string, x: number, y: number, width: number): number {
    this.text(value.toUpperCase(), x, y, this.fonts.mono, 7.5, SECONDARY, 1.6);
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

  /** Labels over values, `columns` to a row, from `y` down; returns the y under them. */
  facts(items: readonly LabeledValue[], x: number, y: number, width: number, columns: number, floor = FLOOR): number {
    const gap = 22;
    const cell = (width - gap * (columns - 1)) / columns;
    for (let start = 0; start < items.length; start += columns) {
      if (y - 30 < floor) break;
      let lowest = y;
      items.slice(start, start + columns).forEach((item, i) => {
        const cx = x + i * (cell + gap);
        this.label(item.label, cx, y, cell);
        let vy = y - 18;
        for (const line of wrapClamped(item.value, this.fonts.medium, 12.5, cell, 2)) {
          this.text(line, cx, vy, this.fonts.medium, 12.5, INK);
          vy -= 16;
        }
        lowest = Math.min(lowest, vy);
      });
      this.hairline(x, lowest + 2, width);
      y = lowest - 18;
    }
    return y;
  }
}

/** The PDF's slides, each content slide numbered in its kicker. */
class Deck {
  private count = 0;

  constructor(
    readonly doc: PDFDocument,
    readonly fonts: Fonts,
    readonly wordmark: string,
  ) {}

  /** A content slide under the wordmark, with its kicker and heading; returns it to fill from BODY_TOP. */
  slide(kicker: string, heading: string): Slide {
    const page = this.doc.addPage([W, H]);
    const s = new Slide(this.doc, page, this.fonts);
    this.count += 1;
    drawWordmark(page, this.wordmark, MARGIN, H - 30, 10, INK);
    drawTextRight(
      page,
      `${String(this.count).padStart(2, "0")} · ${kicker.toUpperCase()}`,
      W - MARGIN,
      H - 38,
      this.fonts.mono,
      7,
      SECONDARY,
      1.4,
    );
    for (const [i, line] of wrapClamped(heading, this.fonts.display, 30, CONTENT, 1).entries()) {
      s.text(line, MARGIN, H - 96 - i * 34, this.fonts.display, 30, INK);
    }
    return s;
  }

  /** Every slide's footer, numbered of the total, the cover's in white. */
  footers(): void {
    const pages = this.doc.getPages();
    pages.forEach((page, i) => {
      const cover = i === 0;
      const fill = cover ? TERTIARY : SECONDARY;
      page.drawLine({
        start: { x: MARGIN, y: 42 },
        end: { x: W - MARGIN, y: 42 },
        thickness: 0.6,
        color: cover ? SECONDARY : BORDER,
      });
      drawText(page, `${BRAND.company.toUpperCase()} · ${BRAND.domain.toUpperCase()}`, MARGIN, 26, this.fonts.mono, 6.5, fill, 1);
      drawTextRight(page, `CONFIDENTIAL · ${i + 1} / ${pages.length}`, W - MARGIN, 26, this.fonts.mono, 6.5, fill, 1);
    });
  }
}

function cover(deck: Deck, p: PresentationContent, today: string): void {
  const { fonts } = deck;
  const page = deck.doc.addPage([W, H]);
  const s = new Slide(deck.doc, page, fonts);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: INK });
  drawWordmark(page, deck.wordmark, MARGIN, H - 48, 18, WHITE);
  drawTextRight(page, "SITE OVERVIEW", W - MARGIN, H - 52, fonts.mono, 7.5, PAPER, 1.4);
  drawTextRight(page, `CONFIDENTIAL · ${formatMonthYear(dayOf(today)).toUpperCase()}`, W - MARGIN, H - 66, fonts.mono, 7, TERTIARY, 1);

  const title = wrapClamped(p.title, fonts.display, 48, CONTENT - 80, 2);
  const subtitle = p.subtitle ? wrapClamped(p.subtitle, fonts.regular, 14, CONTENT - 160, 3) : [];
  // Set from the bottom up so a short cover sits as low as a long one.
  let y = 118 + subtitle.length * 21 + (subtitle.length ? 18 : 0) + title.length * 54;
  if (p.eyebrow) {
    s.line(p.eyebrow.toUpperCase(), MARGIN, y + 20, CONTENT, fonts.mono, 9, ACCENT, 1.6);
  }
  for (const line of title) {
    y -= 54;
    s.text(line, MARGIN, y + 12, fonts.display, 48, WHITE);
  }
  y -= 18;
  for (const line of subtitle) {
    y -= 21;
    s.text(line, MARGIN, y + 12, fonts.regular, 14, PAPER);
  }
  if (p.contactEmail) {
    drawTextRight(page, p.contactEmail, W - MARGIN, 60, fonts.regular, 9, PAPER);
    const width = fonts.regular.widthOfTextAtSize(p.contactEmail, 9);
    s.link(W - MARGIN - width, 57, width, 12, `mailto:${p.contactEmail}`);
  }
}

function atAGlance(deck: Deck, p: PresentationContent): void {
  const stats = p.stats.filter((stat) => stat.value || stat.label);
  const highlights = linesOf(p.highlights);
  if (!stats.length && !p.summary && !highlights.length) return;
  const s = deck.slide("At a glance", "At a glance");
  const { fonts } = deck;
  let y = BODY_TOP;
  if (stats.length) {
    const gap = 12;
    const height = 78;
    const width = (CONTENT - gap * (stats.length - 1)) / stats.length;
    stats.forEach((stat, i) => {
      const x = MARGIN + i * (width + gap);
      s.page.drawSvgPath(roundedRect(width, height, 8), { x, y: y + 12, color: PAPER, borderColor: BORDER, borderWidth: 0.75 });
      s.line(stat.value, x + 16, y - 22, width - 32, fonts.semibold, fitSize(stat.value, fonts.semibold, 24, width - 32), INK);
      s.line(stat.label, x + 16, y - 44, width - 32, fonts.regular, 9, SECONDARY);
    });
    y -= height + 30;
  }
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
  const s = deck.slide("The site", "The site");
  twoColumns(
    s,
    BODY_TOP,
    p.siteSummary ? { title: "Overview", text: p.siteSummary } : null,
    p.siteFacts.length ? { title: "Key facts", facts: p.siteFacts } : null,
  );
}

function rollout(deck: Deck, p: PresentationContent): void {
  if (!p.rollout.length) return;
  const s = deck.slide("Capacity and rollout", "Capacity and rollout");
  const { fonts, page } = s;
  const cols = [0, CONTENT * 0.24, CONTENT * 0.66];
  let y = BODY_TOP;
  s.label("Phase", MARGIN, y, cols[1] - 12);
  s.label("Capacity", MARGIN + cols[1], y, cols[2] - cols[1] - 12);
  s.label("Power", MARGIN + cols[2], y, CONTENT * 0.14);
  drawTextRight(page, "READY FOR SERVICE", MARGIN + CONTENT, y, fonts.mono, 7, SECONDARY, 1.2);
  y -= 10;
  for (const [i, row] of p.rollout.entries()) {
    s.hairline(MARGIN, y, CONTENT);
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

function cluster(deck: Deck, p: PresentationContent): void {
  if (!p.clusterSummary && !p.specs.length) return;
  const s = deck.slide("The cluster", "The cluster");
  twoColumns(
    s,
    BODY_TOP,
    p.clusterSummary ? { title: "Overview", text: p.clusterSummary } : null,
    p.specs.length ? { title: "Specifications", facts: p.specs } : null,
  );
}

function section(deck: Deck, section: Section): void {
  const s = deck.slide(section.title, section.title);
  const bullets = linesOf(section.bullets);
  const text = section.body || bullets.length ? { title: "Overview", text: section.body, items: bullets } : null;
  twoColumns(s, BODY_TOP, text, section.facts.length ? { title: "Key facts", facts: section.facts, columns: text ? 1 : 3 } : null);
}

function terms(deck: Deck, p: PresentationContent): void {
  if (!p.terms.length) return;
  const s = deck.slide("Commercial", "Commercial terms");
  const { fonts } = deck;
  const gap = 12;
  const height = 96;
  const width = (CONTENT - gap * (p.terms.length - 1)) / p.terms.length;
  p.terms.forEach((term, i) => {
    const x = MARGIN + i * (width + gap);
    s.page.drawSvgPath(roundedRect(width, height, 8), { x, y: BODY_TOP + 12, color: PAPER, borderColor: BORDER, borderWidth: 0.75 });
    s.label(term.label, x + 18, BODY_TOP - 14, width - 36);
    s.line(term.value, x + 18, BODY_TOP - 50, width - 36, fonts.semibold, fitSize(term.value, fonts.semibold, 22, width - 36), INK);
  });
  s.text(
    "Indicative and non-binding, subject to a definitive agreement.",
    MARGIN,
    BODY_TOP - height - 28,
    fonts.regular,
    11.5,
    SECONDARY,
  );
}

function nextSteps(deck: Deck, p: PresentationContent): void {
  const steps = linesOf(p.nextSteps);
  const s = deck.slide("Next steps", "Next steps");
  const { fonts, page } = s;
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
  const top = BODY_TOP + 12;
  page.drawSvgPath(roundedRect(panel, 156, 10), { x, y: top, color: PAPER, borderColor: BORDER, borderWidth: 0.75 });
  s.label("Contact", x + 22, top - 30, panel - 44);
  s.line(p.contactName || BRAND.company, x + 22, top - 60, panel - 44, fonts.semibold, 16, INK);
  let ly = top - 84;
  if (p.contactEmail) {
    const width = s.line(p.contactEmail, x + 22, ly, panel - 44, fonts.regular, 12, INK);
    s.link(x + 22, ly - 3, width, 15, `mailto:${p.contactEmail}`);
    ly -= 22;
  }
  const width = s.line(BRAND.domain, x + 22, ly, panel - 44, fonts.regular, 12, SECONDARY);
  s.link(x + 22, ly - 3, width, 15, SITE_URL);
}

/** The presentation's PDF, dated `today` (`YYYY-MM-DD`). */
export async function renderPresentationPdf(presentation: PresentationContent, today: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { fonts, wordmark } = await embedBrand(doc);
  const deck = new Deck(doc, fonts, wordmark);
  const p = presentation;

  cover(deck, p, today);
  atAGlance(deck, p);
  site(deck, p);
  rollout(deck, p);
  cluster(deck, p);
  for (const added of p.sections) section(deck, added);
  terms(deck, p);
  nextSteps(deck, p);
  deck.footers();

  doc.setTitle(`ZODE \u2013 ${p.title}`);
  doc.setSubject(p.subtitle || "Site overview");
  doc.setAuthor(BRAND.company);
  doc.setCreator(BRAND.domain);
  doc.setProducer(BRAND.domain);
  doc.setLanguage("en-US");
  doc.catalog.set(PDFName.of("ViewerPreferences"), doc.context.obj({ DisplayDocTitle: true }));
  return doc.save();
}
