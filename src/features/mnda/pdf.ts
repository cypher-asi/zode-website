import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { TEMPLATE_VERSION, ZODE_PARTY, consentText } from "./agreement";
import type { MndaParty } from "./parse";

/** Loaded with fs from the project root; next.config's outputFileTracingIncludes ships them with the routes that sign. */
const ASSETS = path.join(process.cwd(), "src/features/mnda/assets");

let assets: Promise<{ template: Buffer; regular: Buffer; bold: Buffer; italic: Buffer }> | undefined;

function loadAssets() {
  assets ??= Promise.all(
    ["zode-mnda-v1.pdf", "LiberationSans-Regular.ttf", "LiberationSans-Bold.ttf", "LiberationSans-Italic.ttf"].map(
      (name) => readFile(path.join(ASSETS, name)),
    ),
  ).then(([template, regular, bold, italic]) => ({ template, regular, bold, italic }));
  return assets;
}

export interface ExecutedMndaInput {
  id: string;
  party: MndaParty;
  zodeSigner: { name: string; title: string };
  signedAt: Date;
  ip: string | null;
  userAgent: string | null;
  /** How the signer reached the form, for the certificate. */
  method: { kind: "public" } | { kind: "data-room"; roomName: string; userId: string };
}

const INK = rgb(0.05, 0.05, 0.08);
const FIELD = rgb(0.06, 0.16, 0.42);
const MUTED = rgb(0.4, 0.4, 0.45);

const longDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(date);
const monthDay = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(date);

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

interface Fit {
  size: number;
  lines: string[];
}

/**
 * The largest size, down to `minSize`, at which `text` fits `width` on one
 * line; failing that, the largest that fits on `maxLines`; failing that, one
 * line shrunk to whatever fits. Values are never cut short on the agreement.
 */
function fit(
  text: string,
  font: PDFFont,
  width: number,
  maxSize: number,
  minSize: number,
  maxLines = 1,
  wrappedMax = minSize,
): Fit {
  for (let size = maxSize; size >= minSize; size -= 0.25) {
    if (font.widthOfTextAtSize(text, size) <= width) return { size, lines: [text] };
  }
  for (let size = wrappedMax; maxLines > 1 && size >= 3.5; size -= 0.25) {
    const lines = wrap(text, font, size, width);
    if (lines.length <= maxLines && lines.every((l) => font.widthOfTextAtSize(l, size) <= width)) return { size, lines };
  }
  return { size: (width / font.widthOfTextAtSize(text, 1)) * 0.98, lines: [text] };
}

interface Blank {
  x: number;
  /** Baseline of the printed line the blank sits on. */
  y: number;
  width: number;
}

/** Writes `text` into a blank, the last line just above `y` and any others stacked above it. */
function fillBlank(
  page: PDFPage,
  text: string,
  blank: Blank,
  font: PDFFont,
  opts: {
    maxSize: number;
    minSize: number;
    maxLines?: number;
    /** Largest size once wrapped, so stacked lines stay clear of the printed line above. */
    wrappedMax?: number;
    align?: "left" | "center";
    lift?: number;
  },
): void {
  const { size, lines } = fit(text, font, blank.width - 4, opts.maxSize, opts.minSize, opts.maxLines, opts.wrappedMax);
  const lift = lines.length > 1 ? 0.3 : (opts.lift ?? 1.5);
  lines.forEach((line, i) => {
    const lineWidth = font.widthOfTextAtSize(line, size);
    const x = opts.align === "center" ? blank.x + (blank.width - lineWidth) / 2 : blank.x + 2;
    page.drawText(line, { x, y: blank.y + lift + (lines.length - 1 - i) * size * 0.95, size, font, color: FIELD });
  });
}

// Positions on the template, in PDF points from the bottom left, measured
// from zode-mnda-v1.pdf. A new template version needs them re-measured.

/** Page 1, the preamble's first two lines. */
const PREAMBLE = {
  date: { x: 330.7, y: 651.95, width: 72 },
  year: { x: 419.2, y: 651.95, width: 9.5 },
  entityName: { x: 151.5, y: 641.6, width: 130.5 },
  entityType: { x: 294.2, y: 641.6, width: 126 },
};

/** Page 3, the signature blocks; `y` is each rule's height. */
const SIGNATURES = {
  zodeBy: { x: 54, y: 654, width: 234 },
  zodeName: { x: 68, y: 625, width: 220 },
  zodeTitle: { x: 68, y: 605, width: 220 },
  entityName: { x: 335.5, y: 673, width: 199.5 },
  entityBy: { x: 323, y: 654, width: 235 },
  entityPrintedName: { x: 337, y: 625, width: 221 },
  entityAddress: [
    { x: 350, y: 605, width: 208 },
    { x: 306, y: 596, width: 252 },
    { x: 306, y: 586, width: 252 },
  ],
};

/** The template, filled in and signed by both parties, with a signature certificate appended. */
export async function renderExecutedMnda(input: ExecutedMndaInput): Promise<{ bytes: Uint8Array; sha256: string }> {
  const { template, regular: regularBytes, bold: boldBytes, italic: italicBytes } = await loadAssets();
  const doc = await PDFDocument.load(template);
  doc.registerFontkit(fontkit);
  const [regular, bold, italic] = await Promise.all([
    doc.embedFont(regularBytes, { subset: true }),
    doc.embedFont(boldBytes, { subset: true }),
    doc.embedFont(italicBytes, { subset: true }),
  ]);
  const { party, zodeSigner, signedAt } = input;
  const pages = doc.getPages();
  if (pages.length !== 3) throw new Error(`MNDA template has ${pages.length} pages; expected 3.`);
  const [first, , signaturePage] = pages;

  fillBlank(first, monthDay(signedAt), PREAMBLE.date, regular, { maxSize: 8, minSize: 5, align: "center" });
  fillBlank(first, String(signedAt.getUTCFullYear() % 100).padStart(2, "0"), PREAMBLE.year, regular, {
    maxSize: 8,
    minSize: 5,
    align: "center",
  });
  const preambleFit = { maxSize: 8, minSize: 5.5, maxLines: 2, wrappedMax: 4 };
  fillBlank(first, party.entityName, PREAMBLE.entityName, regular, preambleFit);
  fillBlank(first, party.entityType, PREAMBLE.entityType, regular, preambleFit);

  const signed = `Signed electronically ${longDate(signedAt)} \u00b7 ID ${input.id}`;
  const signature = (blank: Blank, name: string) => {
    fillBlank(signaturePage, name, blank, italic, { maxSize: 14, minSize: 7, lift: 2 });
    fillBlank(signaturePage, signed, { ...blank, y: blank.y - 7.5 }, regular, { maxSize: 5.5, minSize: 4, lift: 0 });
  };
  signature(SIGNATURES.zodeBy, zodeSigner.name);
  fillBlank(signaturePage, zodeSigner.name, SIGNATURES.zodeName, regular, { maxSize: 8.5, minSize: 5.5 });
  fillBlank(signaturePage, zodeSigner.title, SIGNATURES.zodeTitle, regular, { maxSize: 8.5, minSize: 5.5 });

  fillBlank(signaturePage, party.entityName, SIGNATURES.entityName, bold, { maxSize: 8.5, minSize: 5.5, maxLines: 2 });
  signature(SIGNATURES.entityBy, party.signerName);
  fillBlank(signaturePage, `${party.signerName}, ${party.signerTitle}`, SIGNATURES.entityPrintedName, regular, {
    maxSize: 8.5,
    minSize: 5.5,
  });
  party.entityAddress
    .split("\n")
    .slice(0, SIGNATURES.entityAddress.length)
    .forEach((line, i) =>
      fillBlank(signaturePage, line, SIGNATURES.entityAddress[i], regular, { maxSize: 7.5, minSize: 4.5, lift: 1.2 }),
    );

  drawCertificate(doc, input, { regular, bold }, createHash("sha256").update(template).digest("hex"));

  doc.setTitle(`ZODE Mutual Nondisclosure Agreement \u2013 ${party.entityName}`);
  doc.setSubject(`Executed ${longDate(signedAt)} (ID ${input.id})`);
  doc.setAuthor("ZODE Inc.");
  doc.setCreator("zode.org");
  doc.setProducer("zode.org");
  doc.setCreationDate(signedAt);
  doc.setModificationDate(signedAt);

  const bytes = await doc.save();
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}

function drawCertificate(
  doc: PDFDocument,
  input: ExecutedMndaInput,
  fonts: { regular: PDFFont; bold: PDFFont },
  templateSha256: string,
): void {
  const page = doc.addPage([612, 792]);
  const left = 54;
  const labelWidth = 150;
  const valueX = left + labelWidth;
  const valueWidth = 612 - 54 - valueX;
  let y = 720;

  page.drawText("Electronic Signature Certificate", { x: left, y, size: 16, font: fonts.bold, color: INK });
  y -= 18;
  page.drawText("ZODE Mutual Nondisclosure Agreement", { x: left, y, size: 10, font: fonts.regular, color: MUTED });
  y -= 30;

  const { party, method } = input;
  const section = (title: string, rows: [string, string][]) => {
    page.drawText(title.toUpperCase(), { x: left, y, size: 7.5, font: fonts.bold, color: MUTED });
    y -= 6;
    page.drawLine({ start: { x: left, y }, end: { x: 612 - 54, y }, thickness: 0.5, color: MUTED });
    y -= 14;
    for (const [label, value] of rows) {
      const lines = wrap(value, fonts.regular, 9, valueWidth);
      page.drawText(label, { x: left, y, size: 9, font: fonts.bold, color: INK });
      lines.forEach((line, i) => page.drawText(line, { x: valueX, y: y - i * 12, size: 9, font: fonts.regular, color: INK }));
      y -= lines.length * 12 + 4;
    }
    y -= 14;
  };

  section("Agreement", [
    ["Agreement ID", input.id],
    ["Template", `${TEMPLATE_VERSION} (SHA-256 ${templateSha256})`],
    ["Effective date", longDate(input.signedAt)],
  ]);
  section("Entity", [
    ["Legal name", party.entityName],
    ["Entity type", party.entityType],
    ["Address", party.entityAddress],
  ]);
  section("Signed for the entity by", [
    ["Name", party.signerName],
    ["Title", party.signerTitle],
    ["Email", party.signerEmail],
    ["Signature", `Typed name "${party.signerName}"`],
    ["Signed at", `${input.signedAt.toISOString()} (UTC)`],
    ["IP address", input.ip ?? "Unknown"],
    ["User agent", input.userAgent ?? "Unknown"],
    [
      "Identity",
      method.kind === "data-room"
        ? `Signed while logged in to ZODE account ${method.userId}, from a data room invite (${method.roomName}) delivered to this email address.`
        : "Email address entered by the signer on zode.org/mnda; not independently verified.",
    ],
    ["Consent", consentText(party.entityName)],
  ]);
  section(`Signed for ${ZODE_PARTY.name} by`, [
    ["Name", input.zodeSigner.name],
    ["Title", input.zodeSigner.title],
    ["Signed at", `${input.signedAt.toISOString()} (UTC)`],
    [
      "Method",
      `Countersigned automatically on ${ZODE_PARTY.name}'s standing authorization for its standard mutual nondisclosure agreement.`,
    ],
  ]);

  page.drawText("Both parties received this executed copy by email.", {
    x: left,
    y: 48,
    size: 7.5,
    font: fonts.regular,
    color: MUTED,
  });
}
