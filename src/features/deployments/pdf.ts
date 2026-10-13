import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFName,
  PDFOperator,
  PDFOperatorNames,
  PDFString,
  drawSvgPath,
  rgb,
  type Color,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { BRAND, COLOR_GROUPS } from "@/features/styleguide/brand";
import { SITE_URL } from "@/lib/site";
import {
  formatCount,
  formatDay,
  formatMw,
  formatRate,
  formatTb,
  formatLeaseYears,
  formatTerm,
  formatUsd,
  plural,
} from "./format";
import { scheduleOf } from "./schedule";
import {
  coolingLabel,
  creditLabel,
  facilityLabel,
  networkingLabel,
  platformLabel,
  rackDesignHref,
  statusLabel,
  totalsOf,
  type Deployment,
} from "./types";

/*
 * A deployment as a ZODE-branded PDF: the styleguide's type (Newsreader Light
 * headlines, Inter text, Geist Mono labels and figures) and palette (ink,
 * paper and hairlines, the accent marking only the next RFS), with the
 * wordmark on an ink band. Fonts are read with fs from this feature's assets
 * and the wordmark from public/; next.config's outputFileTracingIncludes ships
 * both with the PDF route.
 */

const ASSETS = path.join(process.cwd(), "src/features/deployments/assets");
const WORDMARK = path.join(process.cwd(), "public/wordmark.svg");
const WORDMARK_VIEWBOX = { width: 2400, height: 416 };

interface Assets {
  regular: Buffer;
  medium: Buffer;
  semibold: Buffer;
  display: Buffer;
  mono: Buffer;
  wordmark: string;
}

let assets: Promise<Assets> | undefined;

function loadAssets(): Promise<Assets> {
  assets ??= Promise.all([
    ...[
      "Inter-Regular.ttf",
      "Inter-Medium.ttf",
      "Inter-SemiBold.ttf",
      "Newsreader-Light.ttf",
      "GeistMono-Regular.ttf",
    ].map((name) => readFile(path.join(ASSETS, name))),
    readFile(WORDMARK, "utf8"),
  ]).then(([regular, medium, semibold, display, mono, svg]) => {
    const wordmark = /\sd="([^"]+)"/.exec(svg as string)?.[1];
    if (!wordmark) throw new Error("public/wordmark.svg has no path");
    return {
      regular: regular as Buffer,
      medium: medium as Buffer,
      semibold: semibold as Buffer,
      display: display as Buffer,
      mono: mono as Buffer,
      wordmark,
    };
  });
  return assets;
}

const TOKENS = new Map(COLOR_GROUPS.flatMap((group) => group.tokens).map((t) => [t.token, t.value]));

function color(token: string): Color {
  const hex = TOKENS.get(token);
  if (!hex?.startsWith("#") || hex.length !== 7) throw new Error(`${token} isn't a hex colour token`);
  const n = Number.parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const INK = color("--color-ink");
const PAPER = color("--color-paper");
const WHITE = color("--color-white");
const SECONDARY = color("--color-text-secondary");
const TERTIARY = color("--color-text-tertiary");
const BORDER = color("--color-border");
const BORDER_STRONG = color("--color-border-strong");
const ACCENT = color("--color-accent-strong");
const ACCENT_SOFT = color("--color-accent-soft");

const PAGE = { width: 612, height: 792 } as const;
const MARGIN = 48;
const CONTENT = PAGE.width - MARGIN * 2;
const BAND = 92;
const FOOTER = 44;

interface Fonts {
  regular: PDFFont;
  medium: PDFFont;
  semibold: PDFFont;
  display: PDFFont;
  mono: PDFFont;
}

/** Greedy word wrap at one size; a word wider than the line gets a line of its own. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** A rounded rectangle as an SVG path from its top left, for `drawSvgPath`. */
const roundedRect = (width: number, height: number, r: number): string =>
  `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width} ${r} V ${height - r} A ${r} ${r} 0 0 1 ${width - r} ${height} ` +
  `H ${r} A ${r} ${r} 0 0 1 0 ${height - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;

const DIAMOND = "M 0 -4.5 L 4.5 0 L 0 4.5 L -4.5 0 Z";

interface Fact {
  label: string;
  value: string;
  wide?: boolean;
  href?: string;
}

/** Lays the document out top to bottom, starting a new page whenever the next block won't fit. */
class Writer {
  readonly pages: PDFPage[] = [];
  page!: PDFPage;
  y = 0;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts,
    private readonly wordmark: string,
    private readonly title: string,
  ) {}

  private addPage(): void {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.pages.push(this.page);
  }

  /** The first page's ink band: the wordmark, and what this is. */
  firstPage(exported: string): void {
    this.addPage();
    const { page, fonts } = this;
    page.drawRectangle({ x: 0, y: PAGE.height - BAND, width: PAGE.width, height: BAND, color: INK });
    this.drawWordmark(MARGIN, PAGE.height - 38, 15, WHITE);
    this.textRight("DEPLOYMENT SUMMARY", PAGE.width - MARGIN, PAGE.height - 47, fonts.mono, 7, PAPER, 1.1);
    this.textRight(`Exported ${exported}`, PAGE.width - MARGIN, PAGE.height - 59, fonts.mono, 7, TERTIARY, 0.4);
    this.y = PAGE.height - BAND - 36;
  }

  /** Later pages: a slim header with the wordmark in ink and the deployment's name. */
  private nextPage(): void {
    this.addPage();
    this.drawWordmark(MARGIN, PAGE.height - 34, 10, INK);
    this.textRight(
      this.title.toUpperCase(),
      PAGE.width - MARGIN,
      PAGE.height - 42,
      this.fonts.mono,
      6.5,
      SECONDARY,
      0.9,
    );
    this.page.drawLine({
      start: { x: MARGIN, y: PAGE.height - 54 },
      end: { x: PAGE.width - MARGIN, y: PAGE.height - 54 },
      thickness: 0.5,
      color: BORDER,
    });
    this.y = PAGE.height - 80;
  }

  /** Room for `height` more points, or a fresh page. */
  need(height: number): void {
    if (this.y - height < FOOTER + 16) this.nextPage();
  }

  /** The wordmark's counters are subpaths that only read as holes under the even-odd rule, as in its SVG. */
  private drawWordmark(x: number, top: number, height: number, fill: Color): void {
    const ops = drawSvgPath(this.wordmark, {
      x,
      y: top,
      scale: height / WORDMARK_VIEWBOX.height,
      color: fill,
      borderColor: undefined,
      borderWidth: 0,
    });
    this.page.pushOperators(
      ...ops.map((op) =>
        op.toString() === PDFOperatorNames.FillNonZero ? PDFOperator.of(PDFOperatorNames.FillEvenOdd) : op,
      ),
    );
  }

  /** Text with letter spacing in ems, as the styleguide's caps and eyebrows want. */
  text(value: string, x: number, y: number, font: PDFFont, size: number, fill: Color, tracking = 0): number {
    if (!tracking) {
      this.page.drawText(value, { x, y, size, font, color: fill });
      return font.widthOfTextAtSize(value, size);
    }
    let cursor = x;
    for (const char of value) {
      this.page.drawText(char, { x: cursor, y, size, font, color: fill });
      cursor += font.widthOfTextAtSize(char, size) + size * tracking * 0.1;
    }
    return cursor - x;
  }

  private trackedWidth(value: string, font: PDFFont, size: number, tracking: number): number {
    return tracking
      ? [...value].reduce((sum, char) => sum + font.widthOfTextAtSize(char, size) + size * tracking * 0.1, 0)
      : font.widthOfTextAtSize(value, size);
  }

  textRight(value: string, right: number, y: number, font: PDFFont, size: number, fill: Color, tracking = 0): void {
    this.text(value, right - this.trackedWidth(value, font, size, tracking), y, font, size, fill, tracking);
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

  /** The eyebrow, headline and address under the band. */
  heading(eyebrow: string, title: string, subtitle: string | null): void {
    const { fonts } = this;
    this.text(eyebrow, MARGIN, this.y, fonts.mono, 7.5, SECONDARY, 1.6);
    this.y -= 30;
    for (const line of wrap(title, fonts.display, 30, CONTENT)) {
      this.text(line, MARGIN, this.y, fonts.display, 30, INK);
      this.y -= 32;
    }
    if (subtitle) {
      this.y += 8;
      for (const line of wrap(subtitle, fonts.regular, 10, CONTENT)) {
        this.text(line, MARGIN, this.y, fonts.regular, 10, SECONDARY);
        this.y -= 14;
      }
    }
    this.y -= 14;
  }

  /** A row of headline figures in hairline tiles. */
  stats(items: readonly { value: string; label: string }[]): void {
    const gap = 8;
    const height = 54;
    const width = (CONTENT - gap * (items.length - 1)) / items.length;
    this.need(height);
    items.forEach((item, i) => {
      const x = MARGIN + i * (width + gap);
      this.page.drawSvgPath(roundedRect(width, height, 6), { x, y: this.y, borderColor: BORDER, borderWidth: 0.75 });
      this.text(item.value, x + 12, this.y - 25, this.fonts.semibold, 15, INK);
      this.text(item.label, x + 12, this.y - 41, this.fonts.regular, 8, SECONDARY);
    });
    this.y -= height + 26;
  }

  /** A section's caps title over a hairline. */
  section(title: string, height: number): void {
    this.need(height + 22);
    this.text(title.toUpperCase(), MARGIN, this.y, this.fonts.mono, 7, SECONDARY, 1.6);
    this.y -= 7;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE.width - MARGIN, y: this.y },
      thickness: 0.5,
      color: BORDER,
    });
    this.y -= 15;
  }

  /** Label over value, `columns` to a row; wide facts take a row of their own. */
  facts(title: string, items: readonly Fact[], columns = 3, x = MARGIN, width = CONTENT): void {
    const gap = 16;
    const column = (width - gap * (columns - 1)) / columns;
    const rows: Fact[][] = [];
    for (const item of items) {
      const last = rows.at(-1);
      if (item.wide || !last || last.length === columns || last[0]?.wide) rows.push([item]);
      else last.push(item);
    }
    const lineCount = (item: Fact) => wrap(item.value, this.fonts.medium, 9.5, item.wide ? width : column).length;
    const heightOf = (row: Fact[]) => 13 + Math.max(...row.map(lineCount)) * 13 + 10;
    if (title) this.section(title, heightOf(rows[0] ?? []));
    for (const row of rows) {
      const height = heightOf(row);
      this.need(height);
      row.forEach((item, i) => {
        const left = x + i * (column + gap);
        this.text(item.label.toUpperCase(), left, this.y, this.fonts.mono, 6.5, SECONDARY, 1.2);
        wrap(item.value, this.fonts.medium, 9.5, item.wide ? width : column).forEach((line, n) => {
          const lineY = this.y - 14 - n * 13;
          const drawn = this.text(line, left, lineY, this.fonts.medium, 9.5, INK);
          if (item.href) {
            this.page.drawLine({
              start: { x: left, y: lineY - 2 },
              end: { x: left + drawn, y: lineY - 2 },
              thickness: 0.5,
              color: INK,
            });
            this.link(left, lineY - 3, drawn, 12, item.href);
          }
        });
      });
      this.y -= height;
    }
    this.y -= 12;
  }

  /** The rollout gantt, as the detail page draws it, then each RFS and the running totals. */
  rollout(deployment: Deployment, today: string): void {
    const schedule = scheduleOf(deployment.phases, today);
    const { fonts } = this;
    if (!schedule) {
      this.section("Rollout", 20);
      this.text("No phases scheduled yet.", MARGIN, this.y, fonts.regular, 9, SECONDARY);
      this.y -= 26;
      return;
    }
    const labelWidth = 128;
    const trackX = MARGIN + labelWidth + 12;
    const trackWidth = CONTENT - labelWidth - 12;
    const rowHeight = 30;
    const axis = 16;
    const chartHeight = axis + schedule.rows.length * rowHeight;
    const xAt = (at: number) => trackX + at * trackWidth;

    this.section("Rollout", Math.min(chartHeight, 400));
    const totals = totalsOf(deployment);
    if (totals.scheduledNodes !== deployment.nodes) {
      this.text(
        `${formatCount(totals.scheduledNodes)} of ${formatCount(deployment.nodes)} nodes scheduled.`,
        MARGIN,
        this.y,
        fonts.regular,
        8.5,
        SECONDARY,
      );
      this.y -= 16;
    }

    const drawAxis = () => {
      for (const tick of schedule.ticks) {
        if (tick.at < 0.92) this.text(tick.label, xAt(tick.at) + 3, this.y - 8, fonts.mono, 6.5, SECONDARY, 0.4);
      }
      this.y -= axis;
    };
    drawAxis();

    schedule.rows.forEach((row) => {
      if (this.y - rowHeight < FOOTER + 16) {
        this.need(rowHeight + axis);
        drawAxis();
      }
      const top = this.y;
      const mid = top - rowHeight / 2;
      this.page.drawLine({
        start: { x: MARGIN, y: top },
        end: { x: PAGE.width - MARGIN, y: top },
        thickness: 0.5,
        color: BORDER,
      });
      for (const tick of schedule.ticks) {
        this.page.drawLine({
          start: { x: xAt(tick.at), y: top },
          end: { x: xAt(tick.at), y: top - rowHeight },
          thickness: 0.5,
          color: BORDER,
        });
      }
      if (schedule.today !== null) {
        this.page.drawLine({
          start: { x: xAt(schedule.today), y: top },
          end: { x: xAt(schedule.today), y: top - rowHeight },
          thickness: 0.6,
          color: TERTIARY,
          dashArray: [2, 2],
        });
      }

      const name = wrap(row.label, fonts.semibold, 8.5, labelWidth)[0] ?? row.label;
      this.text(name, MARGIN, mid + 2, fonts.semibold, 8.5, INK);
      const meta = `${plural(row.phase.nodes, "node")} · ${formatCount(row.gpus)} GPUs${row.phase.mw !== null ? ` · ${formatMw(row.phase.mw)}` : ""}`;
      this.text(meta, MARGIN, mid - 9, fonts.regular, 7, SECONDARY);

      const barWidth = Math.max((row.rfs - row.start) * trackWidth, 0);
      if (barWidth > 0) {
        this.page.drawSvgPath(roundedRect(barWidth, 6, Math.min(3, barWidth / 2)), {
          x: xAt(row.start),
          y: mid + 3,
          color: row.next ? ACCENT_SOFT : BORDER_STRONG,
        });
      }
      this.page.drawSvgPath(DIAMOND, {
        x: xAt(row.rfs),
        y: mid,
        color: row.next ? ACCENT : INK,
        borderColor: WHITE,
        borderWidth: 1,
      });

      const date = `RFS ${formatDay(row.phase.rfsOn)}`;
      const dateWidth = fonts.mono.widthOfTextAtSize(date, 6.5) + 6;
      const dateX =
        row.dateAt === "after"
          ? xAt(row.rfs) + 8
          : row.dateAt === "beforeBar"
            ? xAt(row.start) - 4 - dateWidth
            : xAt(row.rfs) - 8 - dateWidth;
      this.page.drawRectangle({ x: dateX, y: mid - 5, width: dateWidth, height: 10, color: WHITE });
      this.text(date, dateX + 3, mid - 2.3, fonts.mono, 6.5, INK);
      this.y -= rowHeight;
    });
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE.width - MARGIN, y: this.y },
      thickness: 0.5,
      color: BORDER,
    });
    if (schedule.today !== null) {
      const label = "TODAY";
      this.text(
        label,
        xAt(schedule.today) - fonts.mono.widthOfTextAtSize(label, 6) / 2,
        this.y - 9,
        fonts.mono,
        6,
        TERTIARY,
        0.6,
      );
    }
    this.y -= 28;

    const headers = ["Phase", "RFS", "Nodes", "GPUs", "MW", "Cumulative GPUs", "Cumulative MW"];
    const widths = [110, 84, 48, 52, 56, 86, 80];
    const scale = CONTENT / widths.reduce((a, b) => a + b, 0);
    const cols = widths.map((w) => w * scale);
    const cell = (values: string[], font: PDFFont, size: number, fill: Color, tracking = 0) => {
      let x = MARGIN;
      values.forEach((value, i) => {
        if (i === 0) this.text(value, x, this.y, font === fonts.mono ? font : fonts.semibold, size, fill, tracking);
        else this.textRight(value, x + cols[i], this.y, font, size, fill, tracking);
        x += cols[i];
      });
    };
    this.need(20 + 18);
    cell(
      headers.map((h) => h.toUpperCase()),
      fonts.mono,
      6,
      SECONDARY,
      1,
    );
    this.y -= 8;
    for (const row of schedule.rows) {
      this.need(18);
      this.page.drawLine({
        start: { x: MARGIN, y: this.y },
        end: { x: PAGE.width - MARGIN, y: this.y },
        thickness: 0.5,
        color: BORDER,
      });
      this.y -= 12;
      cell(
        [
          row.label,
          formatDay(row.phase.rfsOn),
          formatCount(row.phase.nodes),
          formatCount(row.gpus),
          row.phase.mw !== null ? formatMw(row.phase.mw) : "—",
          formatCount(row.cumulativeGpus),
          formatMw(row.cumulativeMw),
        ],
        fonts.regular,
        8,
        INK,
      );
      if (row.next) {
        const nameWidth = fonts.semibold.widthOfTextAtSize(row.label, 8);
        this.page.drawCircle({ x: MARGIN + nameWidth + 6, y: this.y + 2.8, size: 2.2, color: ACCENT });
      }
      this.y -= 6;
    }
    this.y -= 26;
  }

  /** Notes, wrapped and broken across pages as needed. */
  paragraph(title: string, body: string): void {
    const lines = wrap(body, this.fonts.regular, 9, CONTENT);
    this.section(title, Math.min(lines.length, 4) * 13);
    for (const line of lines) {
      this.need(13);
      this.text(line, MARGIN, this.y, this.fonts.regular, 9, INK);
      this.y -= 13;
    }
    this.y -= 14;
  }

  /** Every page's foot: who and where, and the page count. */
  footers(): void {
    this.pages.forEach((page, i) => {
      this.page = page;
      page.drawLine({
        start: { x: MARGIN, y: FOOTER },
        end: { x: PAGE.width - MARGIN, y: FOOTER },
        thickness: 0.5,
        color: BORDER,
      });
      this.text(
        `${BRAND.company.toUpperCase()} · ${BRAND.domain.toUpperCase()}`,
        MARGIN,
        FOOTER - 14,
        this.fonts.mono,
        6.5,
        SECONDARY,
        1,
      );
      this.textRight(
        `PAGE ${i + 1} OF ${this.pages.length}`,
        PAGE.width - MARGIN,
        FOOTER - 14,
        this.fonts.mono,
        6.5,
        SECONDARY,
        1,
      );
    });
  }
}

const yesNo = (value: boolean): string => (value ? "Yes" : "No");
const orDash = (value: string | null): string => value ?? "—";

/** The deployment's summary PDF, as of `today` (`YYYY-MM-DD`). */
export async function renderDeploymentPdf(deployment: Deployment, today: string): Promise<Uint8Array> {
  const files = await loadAssets();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // pdf-lib's subsetter drops glyphs from Inter, so its files are pre-cut to Latin-1 and embedded whole.
  const [regular, medium, semibold, display, mono] = await Promise.all([
    doc.embedFont(files.regular, { subset: false }),
    doc.embedFont(files.medium, { subset: false }),
    doc.embedFont(files.semibold, { subset: false }),
    doc.embedFont(files.display, { subset: true }),
    doc.embedFont(files.mono, { subset: true }),
  ]);
  const fonts: Fonts = { regular, medium, semibold, display, mono };
  const d = deployment;
  const totals = totalsOf(d);
  const next = d.phases.find((phase) => phase.rfsOn >= today);

  const w = new Writer(doc, fonts, files.wordmark, d.name);
  w.firstPage(formatDay(today));
  w.heading(
    `GPU DEPLOYMENT · ${statusLabel(d.status).toUpperCase()}`,
    d.name,
    d.address ? d.address.split("\n").join(", ") : null,
  );
  w.stats([
    { value: formatCount(totals.gpus), label: `${platformLabel(d.platform)} GPUs` },
    { value: formatCount(d.nodes), label: "Nodes" },
    { value: totals.mw ? formatMw(totals.mw) : "—", label: "Across the rollout" },
    { value: next ? formatDay(next.rfsOn) : "—", label: next ? "Next RFS" : "No RFS to come" },
  ]);

  const rackPath = rackDesignHref(d);
  w.facts("Deployment", [
    { label: "Platform", value: platformLabel(d.platform) },
    { label: "Nodes", value: formatCount(d.nodes) },
    { label: "Total GPUs", value: formatCount(totals.gpus) },
    { label: "Cooling", value: coolingLabel(d.cooling) },
    { label: "Networking", value: networkingLabel(d.networking) },
    {
      label: "Storage",
      value: d.storageTbPerNode
        ? `${formatTb(d.storageTbPerNode)} per node · ${formatTb(totals.storageTb)} total`
        : "None",
    },
    { label: "Facility", value: orDash(facilityLabel(d.facility)) },
    { label: "City", value: orDash(d.city) },
    rackPath
      ? { label: "Rack design", value: "Open in the cluster builder", href: `${SITE_URL}${rackPath}` }
      : { label: "Rack design", value: "Not in the cluster builder yet" },
    { label: "Data center address", value: orDash(d.address), wide: true },
  ]);

  w.rollout(d, today);

  w.facts("Commercial", [
    { label: "Term", value: d.termMonths !== null ? formatTerm(d.termMonths) : "—" },
    { label: "Price", value: d.priceGpuHr !== null ? formatRate(d.priceGpuHr) : "—" },
    { label: "Deposit", value: d.depositUsd !== null ? formatUsd(d.depositUsd) : "—" },
    { label: "Est. monthly", value: totals.monthlyUsd !== null ? formatUsd(totals.monthlyUsd) : "—" },
    { label: "Est. contract value", value: totals.contractUsd !== null ? formatUsd(totals.contractUsd) : "—" },
  ]);

  w.facts(
    "Credit",
    [
      { label: "Credit", value: orDash(creditLabel(d.creditRating)) },
      {
        label: "LOC required",
        value: d.locRequired ? `Yes${d.locYears !== null ? ` · ${formatLeaseYears(d.locYears)}` : ""}` : "No",
      },
      { label: "Credit guarantee", value: yesNo(d.creditGuarantee) },
      { label: "Lease guarantee", value: yesNo(d.leaseGuarantee) },
    ],
    4,
  );

  if (d.notes) w.paragraph("Notes", d.notes);
  w.footers();

  doc.setTitle(`ZODE Deployment \u2013 ${d.name}`);
  doc.setSubject(`${plural(totals.gpus, "GPU")} ${platformLabel(d.platform)} deployment, as of ${formatDay(today)}`);
  doc.setAuthor(BRAND.company);
  doc.setCreator(BRAND.domain);
  doc.setProducer(BRAND.domain);
  doc.setLanguage("en-US");
  doc.catalog.set(PDFName.of("ViewerPreferences"), doc.context.obj({ DisplayDocTitle: true }));

  return doc.save();
}
