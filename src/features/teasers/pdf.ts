import "server-only";
import { PDFDocument, PDFName, PDFString, type Color, type PDFFont, type PDFPage } from "pdf-lib";
import { dayOf, formatMonthYear } from "@/features/deployments/format";
import {
  ACCENT,
  BORDER,
  DIAMOND,
  INK,
  PAGE,
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
import type { TeaserContent } from "./types";

/*
 * A teaser as one ZODE-branded page: the wordmark on an ink band, the
 * headline and key figures, an overview beside the highlights, the
 * availability table, the specs, and the terms and contact in a panel above
 * the footer. Every block clamps its lines, and the limits in ./types keep
 * the longest teaser the save action allows on the page.
 */

const MARGIN = 48;
const CONTENT = PAGE.width - MARGIN * 2;
const BAND = 84;
const FOOTER = 40;
const PANEL = 52;
const PANEL_TOP = FOOTER + 14 + PANEL;
/** Where the body has to stop, clear of the terms and contact panel. */
const BODY_FLOOR = PANEL_TOP + 14;

class Page {
  y = PAGE.height - BAND - 34;

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
  label(value: string, x: number, y: number, width: number): void {
    this.line(value.toUpperCase(), x, y, width, this.fonts.mono, 6.3, SECONDARY, 1.2);
  }

  hairline(x: number, y: number, width: number): void {
    this.page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.5, color: BORDER });
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
    this.text(value.toUpperCase(), x, y, this.fonts.mono, 7, SECONDARY, 1.6);
    this.hairline(x, y - 7, width);
    return y - 22;
  }
}

/** The largest size up to `max` at which `value` fits `width`. */
const fitSize = (value: string, font: PDFFont, max: number, width: number): number =>
  Math.max(8, Math.min(max, (max * width) / Math.max(font.widthOfTextAtSize(value, max), 1)));

/** The teaser's one-page PDF, dated `today` (`YYYY-MM-DD`). */
export async function renderTeaserPdf(teaser: TeaserContent, today: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { fonts, wordmark } = await embedBrand(doc);
  const p = new Page(doc, doc.addPage([PAGE.width, PAGE.height]), fonts);
  const { page } = p;
  const t = teaser;

  // The band.
  page.drawRectangle({ x: 0, y: PAGE.height - BAND, width: PAGE.width, height: BAND, color: INK });
  drawWordmark(page, wordmark, MARGIN, PAGE.height - 35, 14, WHITE);
  drawTextRight(page, "COMPUTE OFFERING", PAGE.width - MARGIN, PAGE.height - 41, fonts.mono, 7, PAPER, 1.1);
  drawTextRight(
    page,
    `CONFIDENTIAL · ${formatMonthYear(dayOf(today)).toUpperCase()}`,
    PAGE.width - MARGIN,
    PAGE.height - 53,
    fonts.mono,
    6.5,
    TERTIARY,
    0.6,
  );

  // The heading.
  if (t.eyebrow) {
    p.line(t.eyebrow.toUpperCase(), MARGIN, p.y, CONTENT, fonts.mono, 7.5, SECONDARY, 1.6);
    p.y -= 27;
  } else {
    p.y -= 18;
  }
  for (const line of wrapClamped(t.headline, fonts.display, 26, CONTENT, 2)) {
    p.text(line, MARGIN, p.y, fonts.display, 26, INK);
    p.y -= 29;
  }
  if (t.subheadline) {
    p.y += 10;
    for (const line of wrapClamped(t.subheadline, fonts.regular, 10, CONTENT, 2)) {
      p.text(line, MARGIN, p.y, fonts.regular, 10, SECONDARY);
      p.y -= 14;
    }
  }
  p.y -= 12;

  // Key figures.
  const stats = t.stats.filter((stat) => stat.value || stat.label);
  if (stats.length) {
    const gap = 8;
    const height = 52;
    const width = (CONTENT - gap * (stats.length - 1)) / stats.length;
    stats.forEach((stat, i) => {
      const x = MARGIN + i * (width + gap);
      page.drawSvgPath(roundedRect(width, height, 6), { x, y: p.y, borderColor: BORDER, borderWidth: 0.75 });
      const size = fitSize(stat.value, fonts.semibold, 15, width - 24);
      p.line(stat.value, x + 12, p.y - 24, width - 24, fonts.semibold, size, INK);
      p.line(stat.label, x + 12, p.y - 39, width - 24, fonts.regular, 7.5, SECONDARY);
    });
    p.y -= height + 22;
  }

  // Overview beside highlights.
  const highlights = t.highlights.split("\n").filter(Boolean);
  if (t.summary || highlights.length) {
    const gap = 24;
    const both = Boolean(t.summary && highlights.length);
    const left = both ? 296 : CONTENT;
    const top = p.y;
    let leftY = top;
    let rightY = top;
    if (t.summary) {
      leftY = p.title("Overview", MARGIN, top, left);
      for (const line of wrapClamped(t.summary, fonts.regular, 9.3, left, 6)) {
        p.text(line, MARGIN, leftY, fonts.regular, 9.3, INK);
        leftY -= 13.5;
      }
    }
    if (highlights.length) {
      const x = both ? MARGIN + left + gap : MARGIN;
      const width = both ? CONTENT - left - gap : CONTENT;
      rightY = p.title("Highlights", x, top, width);
      for (const highlight of highlights) {
        page.drawSvgPath(DIAMOND, { x: x + 2.5, y: rightY + 3, scale: 0.55, color: ACCENT });
        for (const line of wrapClamped(highlight, fonts.regular, 8.8, width - 12, 2)) {
          p.text(line, x + 12, rightY, fonts.regular, 8.8, INK);
          rightY -= 12.5;
        }
        rightY -= 3;
      }
    }
    p.y = Math.min(leftY, rightY) - 10;
  }

  // Availability.
  if (t.availability.length && p.y - 60 > BODY_FLOOR) {
    p.y = p.title("Availability", MARGIN, p.y, CONTENT);
    const cols = [CONTENT * 0.27, CONTENT * 0.5, CONTENT * 0.23];
    p.text("PHASE", MARGIN, p.y, fonts.mono, 6, SECONDARY, 1);
    p.text("CAPACITY", MARGIN + cols[0], p.y, fonts.mono, 6, SECONDARY, 1);
    drawTextRight(page, "READY FOR SERVICE", MARGIN + CONTENT, p.y, fonts.mono, 6, SECONDARY, 1);
    p.y -= 8;
    for (const [i, row] of t.availability.entries()) {
      if (p.y - 18.5 < BODY_FLOOR) break;
      p.hairline(MARGIN, p.y, CONTENT);
      p.y -= 12.5;
      page.drawSvgPath(DIAMOND, { x: MARGIN + 3.5, y: p.y + 3, scale: 0.6, color: i === 0 ? ACCENT : INK });
      p.line(row.label, MARGIN + 13, p.y, cols[0] - 25, fonts.semibold, 8.5, INK);
      p.line(row.capacity, MARGIN + cols[0], p.y, cols[1] - 12, fonts.regular, 8.5, INK);
      drawTextRight(page, clampLine(row.date, fonts.medium, 8.5, cols[2] - 4), MARGIN + CONTENT, p.y, fonts.medium, 8.5, INK);
      p.y -= 6;
    }
    p.hairline(MARGIN, p.y, CONTENT);
    p.y -= 20;
  }

  // Specifications, four to a row.
  if (t.specs.length && p.y - 57 > BODY_FLOOR) {
    p.y = p.title("Specifications", MARGIN, p.y, CONTENT);
    const columns = 4;
    const gap = 16;
    const width = (CONTENT - gap * (columns - 1)) / columns;
    for (let start = 0; start < t.specs.length; start += columns) {
      if (p.y - 26 < BODY_FLOOR) break;
      t.specs.slice(start, start + columns).forEach((spec, i) => {
        const x = MARGIN + i * (width + gap);
        p.label(spec.label, x, p.y, width);
        p.line(spec.value, x, p.y - 14, width, fonts.medium, 9, INK);
      });
      p.y -= 35;
    }
  }

  // Terms and contact.
  page.drawSvgPath(roundedRect(CONTENT, PANEL, 8), {
    x: MARGIN,
    y: PANEL_TOP,
    color: PAPER,
    borderColor: BORDER,
    borderWidth: 0.75,
  });
  const contactWidth = 186;
  const contactX = MARGIN + CONTENT - 16 - contactWidth;
  if (t.terms.length) {
    const column = (contactX - 18 - (MARGIN + 16)) / t.terms.length;
    t.terms.forEach((term, i) => {
      const x = MARGIN + 16 + i * column;
      p.label(term.label, x, PANEL_TOP - 18, column - 12);
      p.line(term.value, x, PANEL_TOP - 34, column - 12, fonts.semibold, 10, INK);
    });
  }
  page.drawLine({
    start: { x: contactX - 18, y: PANEL_TOP - 11 },
    end: { x: contactX - 18, y: PANEL_TOP - PANEL + 11 },
    thickness: 0.5,
    color: BORDER,
  });
  p.label("Contact", contactX, PANEL_TOP - 18, contactWidth);
  p.line(t.contactName || BRAND.company, contactX, PANEL_TOP - 31, contactWidth, fonts.semibold, 9.5, INK);
  const reach = t.contactEmail || BRAND.domain;
  const reachWidth = p.line(reach, contactX, PANEL_TOP - 42.5, contactWidth, fonts.regular, 8.5, SECONDARY);
  p.link(contactX, PANEL_TOP - 45.5, reachWidth, 11, t.contactEmail ? `mailto:${t.contactEmail}` : SITE_URL);

  // Footer.
  p.hairline(MARGIN, FOOTER, CONTENT);
  p.text(`${BRAND.company.toUpperCase()} · ${BRAND.domain.toUpperCase()}`, MARGIN, FOOTER - 14, fonts.mono, 6.5, SECONDARY, 1);
  drawTextRight(
    page,
    "INDICATIVE AND NON-BINDING · SUBJECT TO A DEFINITIVE AGREEMENT",
    PAGE.width - MARGIN,
    FOOTER - 14,
    fonts.mono,
    6.5,
    SECONDARY,
    1,
  );

  doc.setTitle(`ZODE \u2013 ${t.headline}`);
  doc.setSubject(t.subheadline || "Compute offering");
  doc.setAuthor(BRAND.company);
  doc.setCreator(BRAND.domain);
  doc.setProducer(BRAND.domain);
  doc.setLanguage("en-US");
  doc.catalog.set(PDFName.of("ViewerPreferences"), doc.context.obj({ DisplayDocTitle: true }));
  return doc.save();
}
