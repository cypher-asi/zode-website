import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFOperator, PDFOperatorNames, drawSvgPath, rgb, type Color, type PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import { COLOR_GROUPS } from "@/features/styleguide/brand";

/*
 * What ZODE's PDFs share: the styleguide's type (the display face in Light
 * for headlines, Inter text, Geist Mono labels and figures) and palette, the
 * wordmark, and text helpers. Fonts are read with fs from the deployments
 * feature's assets and the shared display face, the wordmark from public/;
 * next.config's outputFileTracingIncludes ships them with each PDF route.
 */

const ASSETS = path.join(process.cwd(), "src/features/deployments/assets");
const DISPLAY_FACE = path.join(process.cwd(), "src/assets/fonts/display/light.ttf");
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
      path.join(ASSETS, "Inter-Regular.ttf"),
      path.join(ASSETS, "Inter-Medium.ttf"),
      path.join(ASSETS, "Inter-SemiBold.ttf"),
      DISPLAY_FACE,
      path.join(ASSETS, "GeistMono-Regular.ttf"),
    ].map((file) => readFile(file)),
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

export interface Fonts {
  regular: PDFFont;
  medium: PDFFont;
  semibold: PDFFont;
  display: PDFFont;
  mono: PDFFont;
}

/** The brand fonts embedded in `doc`, and the wordmark's SVG path. */
export async function embedBrand(doc: PDFDocument): Promise<{ fonts: Fonts; wordmark: string }> {
  const files = await loadAssets();
  doc.registerFontkit(fontkit);
  // pdf-lib's subsetter drops glyphs from Inter, so its files are pre-cut to Latin-1 and embedded whole.
  // Contextual alternates are off: they swap in glyphs no character maps to, like Inter's raised "+" in
  // "N+1", which a whole embed leaves out of the widths, so viewers space them wrong.
  const features = { calt: false };
  const [regular, medium, semibold, display, mono] = await Promise.all([
    doc.embedFont(files.regular, { subset: false, features }),
    doc.embedFont(files.medium, { subset: false, features }),
    doc.embedFont(files.semibold, { subset: false, features }),
    doc.embedFont(files.display, { subset: true, features }),
    doc.embedFont(files.mono, { subset: true, features }),
  ]);
  return { fonts: { regular, medium, semibold, display, mono }, wordmark: files.wordmark };
}

const TOKENS = new Map(COLOR_GROUPS.flatMap((group) => group.tokens).map((t) => [t.token, t.value]));

function color(token: string): Color {
  const hex = TOKENS.get(token);
  if (!hex?.startsWith("#") || hex.length !== 7) throw new Error(`${token} isn't a hex colour token`);
  const n = Number.parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export const INK = color("--color-ink");
export const PAPER = color("--color-paper");
export const WHITE = color("--color-white");
export const SECONDARY = color("--color-text-secondary");
export const TERTIARY = color("--color-text-tertiary");
export const BORDER = color("--color-border");
export const BORDER_STRONG = color("--color-border-strong");
export const ACCENT = color("--color-accent-strong");
export const ACCENT_SOFT = color("--color-accent-soft");

/** US Letter, in points. */
export const PAGE = { width: 612, height: 792 } as const;

/** Greedy word wrap at one size; a word wider than the line gets a line of its own. */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
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

/**
 * `wrap`, cut to `max` lines, the last ending in dots when text was cut. Three
 * periods rather than an ellipsis, which the Latin-1 cut of Inter lacks.
 */
export function wrapClamped(text: string, font: PDFFont, size: number, width: number, max: number): string[] {
  const lines = wrap(text, font, size, width);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last && font.widthOfTextAtSize(`${last}...`, size) > width) last = last.slice(0, -1);
  kept[max - 1] = `${last.trimEnd()}...`;
  return kept;
}

/** `text` on one line no wider than `width`, ending in dots when cut, even inside a single long word. */
export function clampLine(text: string, font: PDFFont, size: number, width: number, tracking = 0): string {
  if (trackedWidth(text, font, size, tracking) <= width) return text;
  let kept = text;
  while (kept && trackedWidth(`${kept}...`, font, size, tracking) > width) kept = kept.slice(0, -1);
  return `${kept.trimEnd()}...`;
}

/** A rounded rectangle as an SVG path from its top left, for `drawSvgPath`. */
export const roundedRect = (width: number, height: number, r: number): string =>
  `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width} ${r} V ${height - r} A ${r} ${r} 0 0 1 ${width - r} ${height} ` +
  `H ${r} A ${r} ${r} 0 0 1 0 ${height - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;

export const DIAMOND = "M 0 -4.5 L 4.5 0 L 0 4.5 L -4.5 0 Z";

/** The wordmark's counters are subpaths that only read as holes under the even-odd rule, as in its SVG. */
export function drawWordmark(page: PDFPage, wordmark: string, x: number, top: number, height: number, fill: Color): void {
  const ops = drawSvgPath(wordmark, {
    x,
    y: top,
    scale: height / WORDMARK_VIEWBOX.height,
    color: fill,
    borderColor: undefined,
    borderWidth: 0,
  });
  page.pushOperators(
    ...ops.map((op) =>
      op.toString() === PDFOperatorNames.FillNonZero ? PDFOperator.of(PDFOperatorNames.FillEvenOdd) : op,
    ),
  );
}

/** Text with letter spacing in ems, as the styleguide's caps and eyebrows want; returns its width. */
export function drawText(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  fill: Color,
  tracking = 0,
): number {
  if (!tracking) {
    page.drawText(value, { x, y, size, font, color: fill });
    return font.widthOfTextAtSize(value, size);
  }
  let cursor = x;
  for (const char of value) {
    page.drawText(char, { x: cursor, y, size, font, color: fill });
    cursor += font.widthOfTextAtSize(char, size) + size * tracking * 0.1;
  }
  return cursor - x;
}

export function trackedWidth(value: string, font: PDFFont, size: number, tracking = 0): number {
  return tracking
    ? [...value].reduce((sum, char) => sum + font.widthOfTextAtSize(char, size) + size * tracking * 0.1, 0)
    : font.widthOfTextAtSize(value, size);
}

export function drawTextRight(
  page: PDFPage,
  value: string,
  right: number,
  y: number,
  font: PDFFont,
  size: number,
  fill: Color,
  tracking = 0,
): void {
  drawText(page, value, right - trackedWidth(value, font, size, tracking), y, font, size, fill, tracking);
}
