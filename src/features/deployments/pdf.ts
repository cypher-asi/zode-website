import "server-only";
import { PDFDocument, PDFName, PDFString, type Color, type PDFFont, type PDFPage } from "pdf-lib";
import {
  ACCENT,
  ACCENT_SOFT,
  BORDER,
  BORDER_STRONG,
  DIAMOND,
  INK,
  PAGE,
  PAPER,
  SECONDARY,
  TERTIARY,
  WHITE,
  drawText,
  drawTextRight,
  drawWordmark,
  embedBrand,
  roundedRect,
  wrap,
  type Fonts,
} from "@/features/pdf/brand";
import { BRAND } from "@/features/styleguide/brand";
import { SITE_URL } from "@/lib/site";
import {
  formatCount,
  formatDay,
  formatDeposit,
  formatMw,
  formatRate,
  formatTb,
  formatLeaseYears,
  formatTerm,
  formatUsd,
  plural,
} from "./format";
import { valueLabel, type ConfigKey } from "./config/catalog";
import { fieldsFor, resolveConfig } from "./config/resolve";
import { scheduleOf } from "./schedule";
import {
  coolingLabel,
  creditLabel,
  facilityLabel,
  networkingLabel,
  platformBreakdown,
  platformLabel,
  platformSummary,
  rackDesignHref,
  statusLabel,
  totalsOf,
  type Deployment,
} from "./types";

/*
 * A deployment as a ZODE-branded PDF in the styleguide's type and palette
 * (ink, paper and hairlines, the accent marking only the next RFS), with the
 * wordmark on an ink band.
 */

const MARGIN = 48;
const CONTENT = PAGE.width - MARGIN * 2;
const BAND = 92;
const FOOTER = 44;

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

  private drawWordmark(x: number, top: number, height: number, fill: Color): void {
    drawWordmark(this.page, this.wordmark, x, top, height, fill);
  }

  text(value: string, x: number, y: number, font: PDFFont, size: number, fill: Color, tracking = 0): number {
    return drawText(this.page, value, x, y, font, size, fill, tracking);
  }

  textRight(value: string, right: number, y: number, font: PDFFont, size: number, fill: Color, tracking = 0): void {
    drawTextRight(this.page, value, right, y, font, size, fill, tracking);
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
      const meta = `${platformLabel(row.phase.platform)} · ${plural(row.phase.nodes, "node")} · ${formatCount(row.gpus)} GPUs${row.phase.mw !== null ? ` · ${formatMw(row.phase.mw)}` : ""}`;
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

    const headers = ["Phase", "Platform", "RFS", "Nodes", "GPUs", "MW", "Cumulative GPUs", "Cumulative MW"];
    const widths = [96, 66, 76, 44, 48, 50, 80, 72];
    const scale = CONTENT / widths.reduce((a, b) => a + b, 0);
    const cols = widths.map((w) => w * scale);
    const cell = (values: string[], font: PDFFont, size: number, fill: Color, tracking = 0) => {
      let x = MARGIN;
      values.forEach((value, i) => {
        if (i === 0) this.text(value, x, this.y, font === fonts.mono ? font : fonts.semibold, size, fill, tracking);
        else if (i === 1) this.text(value, x + 8, this.y, font, size, fill, tracking);
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
          platformLabel(row.phase.platform),
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

/** The configuration a reader of the PDF weighs; the rest is for the BOM. */
const PDF_CONFIG = new Set<ConfigKey>([
  "oversubscription",
  "optics",
  "frontEndNic",
  "storagePlatform",
  "capacityTierPb",
  "wan",
  "orchestration",
  "rackU",
  "power",
  "supportYears",
  "supportLevel",
]);

/**
 * The deployment's summary PDF, as of `today` (`YYYY-MM-DD`), with its
 * external notes; internal notes never go in. The `public` audience, behind
 * its share link, also leaves out its data room and credit.
 */
export async function renderDeploymentPdf(
  deployment: Deployment,
  today: string,
  { audience = "team" }: { audience?: "team" | "public" } = {},
): Promise<Uint8Array> {
  const internal = audience === "team";
  const doc = await PDFDocument.create();
  const { fonts, wordmark } = await embedBrand(doc);
  const d = deployment;
  const totals = totalsOf(d);
  const next = d.phases.find((phase) => phase.rfsOn >= today);

  const w = new Writer(doc, fonts, wordmark, d.name);
  w.firstPage(formatDay(today));
  w.heading(
    `GPU DEPLOYMENT · ${statusLabel(d.status).toUpperCase()}`,
    d.name,
    d.address ? d.address.split("\n").join(", ") : null,
  );
  w.stats([
    { value: formatCount(totals.gpus), label: `${platformSummary(totals.byPlatform)} GPUs` },
    { value: formatCount(d.nodes), label: "Nodes" },
    { value: totals.mw ? formatMw(totals.mw) : "—", label: "Across the rollout" },
    { value: next ? formatDay(next.rfsOn) : "—", label: next ? "Next RFS" : "No RFS to come" },
  ]);

  const rackPath = rackDesignHref(d);
  w.facts("Deployment", [
    { label: "Platform", value: platformSummary(totals.byPlatform) },
    { label: "Nodes", value: formatCount(d.nodes) },
    {
      label: "Total GPUs",
      value:
        totals.byPlatform.length > 1
          ? `${formatCount(totals.gpus)} · ${platformBreakdown(totals.byPlatform)}`
          : formatCount(totals.gpus),
    },
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
    ...(internal ? [{ label: "Data room", value: orDash(d.dataRoomName) }] : []),
    rackPath
      ? { label: "Rack design", value: "Open in the cluster builder", href: `${SITE_URL}${rackPath}` }
      : { label: "Rack design", value: "Not in the cluster builder yet" },
    { label: "Data center address", value: orDash(d.address), wide: true },
  ]);

  const config = resolveConfig(d);
  w.facts(
    "Configuration",
    fieldsFor(config)
      .filter((f) => PDF_CONFIG.has(f.key))
      .map((f) => ({ label: f.label, value: valueLabel(f.key, config[f.key]) })),
  );

  w.rollout(d, today);

  w.facts("Commercial", [
    { label: "Term", value: d.termMonths !== null ? formatTerm(d.termMonths) : "—" },
    { label: "Price", value: d.priceGpuHr !== null ? formatRate(d.priceGpuHr) : "—" },
    { label: "Deposit", value: formatDeposit(d.depositUsd, d.depositPct) ?? "—" },
    { label: "Est. monthly", value: totals.monthlyUsd !== null ? formatUsd(totals.monthlyUsd) : "—" },
    { label: "Est. contract value", value: totals.contractUsd !== null ? formatUsd(totals.contractUsd) : "—" },
  ]);

  if (internal) {
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
  }
  if (d.externalNotes) w.paragraph("Notes", d.externalNotes);
  w.footers();

  doc.setTitle(`ZODE Deployment \u2013 ${d.name}`);
  doc.setSubject(
    `${plural(totals.gpus, "GPU")} ${platformSummary(totals.byPlatform)} deployment, as of ${formatDay(today)}`,
  );
  doc.setAuthor(BRAND.company);
  doc.setCreator(BRAND.domain);
  doc.setProducer(BRAND.domain);
  doc.setLanguage("en-US");
  doc.catalog.set(PDFName.of("ViewerPreferences"), doc.context.obj({ DisplayDocTitle: true }));

  return doc.save();
}
