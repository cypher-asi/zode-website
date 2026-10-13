/**
 * Builds the press kit in public/brand from the master artwork: the wordmark
 * (public/wordmark.svg) and the monogram path (src/lib/brandMarks.ts), in ink
 * and white, as SVG and PNG, plus the app icon and a zip of everything with
 * the product renders, and src/app/favicon.ico. Rerun after changing either
 * master:
 *
 *   npm run brand:kit
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import sharp from "sharp";
import { downloadZip } from "client-zip";
import { MONOGRAM_PATH, MONOGRAM_VIEWBOX } from "../src/lib/brandMarks.ts";
import { COLOR_GROUPS, IMAGE_ASSETS, PRESS, BRAND } from "../src/features/styleguide/brand.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const OUT = join(ROOT, "public/brand");
const color = (token) => COLOR_GROUPS.flatMap((g) => g.tokens).find((t) => t.token === token).value;
const INK = color("--color-ink");
const WHITE = color("--color-white");

const wordmark = await readFile(join(ROOT, "public/wordmark.svg"), "utf8");
const { width: mw, height: mh } = MONOGRAM_VIEWBOX;
const monogram = (fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mw} ${mh}"><path d="${MONOGRAM_PATH}" fill="${fill}"/></svg>\n`;

const tile = (size, markWidth) => {
  const scale = (size * markWidth) / mw;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${INK}"/><path d="${MONOGRAM_PATH}" fill="${WHITE}" transform="translate(${(size - mw * scale) / 2} ${(size - mh * scale) / 2}) scale(${scale})"/></svg>\n`;
};

// Narrower than the favicon's 75% (app/icon.tsx) so the Z clears circular and
// rounded-square avatar masks.
const ICON = 1024;
const appIcon = tile(ICON, 0.62);

const svgs = {
  "zode-wordmark-black.svg": wordmark.replaceAll('fill="#ffffff"', `fill="${INK}"`),
  "zode-wordmark-white.svg": wordmark.replaceAll('fill="#ffffff"', `fill="${WHITE}"`),
  "zode-monogram-black.svg": monogram(INK),
  "zode-monogram-white.svg": monogram(WHITE),
  "zode-app-icon.svg": appIcon,
};
const pngWidths = {
  "zode-wordmark-black.svg": 2400,
  "zode-wordmark-white.svg": 2400,
  "zode-monogram-black.svg": 1024,
  "zode-monogram-white.svg": 1024,
  "zode-app-icon.svg": 1024,
};

await mkdir(OUT, { recursive: true });
const files = [];
for (const [name, svg] of Object.entries(svgs)) {
  const png = await sharp(Buffer.from(svg), { density: 300 }).resize({ width: pngWidths[name] }).png().toBuffer();
  const pngName = name.replace(/\.svg$/, ".png");
  await writeFile(join(OUT, name), svg);
  await writeFile(join(OUT, pngName), png);
  files.push({ name: `logos/${name}`, input: svg }, { name: `logos/${pngName}`, input: png });
}

for (const asset of IMAGE_ASSETS) {
  files.push({ name: `renders/${basename(asset.file)}`, input: await readFile(join(ROOT, "public", asset.file)) });
}

files.push({
  name: "README.txt",
  input: [
    `${BRAND.name} press kit`,
    "",
    PRESS.boilerplate,
    "",
    PRESS.terms,
    "",
    `Brand guidelines: https://${BRAND.domain}/styleguide`,
    `Questions: ${BRAND.email}`,
    "",
  ].join("\n"),
});

const lastModified = new Date("2026-01-01T00:00:00Z");
const zip = await downloadZip(files.map((file) => ({ ...file, lastModified }))).arrayBuffer();
await writeFile(join(OUT, "zode-press-kit.zip"), Buffer.from(zip));
console.log(`public/brand: ${Object.keys(svgs).length * 2} logo files and zode-press-kit.zip (${files.length} entries)`);

// app/favicon.ico, for clients that fetch /favicon.ico without reading the
// page's icon links. ICO entries may hold PNG data, so each size is a PNG.
const FAVICON_SIZES = [16, 32, 48];
const faviconPngs = await Promise.all(
  FAVICON_SIZES.map((size) => sharp(Buffer.from(tile(size, 0.75)), { density: 300 }).resize(size).png().toBuffer()),
);
const icoHeader = Buffer.alloc(6 + 16 * FAVICON_SIZES.length);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(FAVICON_SIZES.length, 4);
let icoOffset = icoHeader.length;
FAVICON_SIZES.forEach((size, i) => {
  const entry = 6 + 16 * i;
  icoHeader.writeUInt8(size, entry);
  icoHeader.writeUInt8(size, entry + 1);
  icoHeader.writeUInt16LE(1, entry + 4);
  icoHeader.writeUInt16LE(32, entry + 6);
  icoHeader.writeUInt32LE(faviconPngs[i].length, entry + 8);
  icoHeader.writeUInt32LE(icoOffset, entry + 12);
  icoOffset += faviconPngs[i].length;
});
await writeFile(join(ROOT, "src/app/favicon.ico"), Buffer.concat([icoHeader, ...faviconPngs]));
console.log(`src/app/favicon.ico: ${FAVICON_SIZES.join(", ")}px`);
