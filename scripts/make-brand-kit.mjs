/**
 * Builds the press kit in public/brand from the master artwork: the wordmark
 * (public/wordmark.svg) and the monogram path (src/lib/brandMarks.ts), in ink
 * and white, as SVG and PNG, plus the app icon and a zip of everything with
 * the product renders. Rerun after changing either master:
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

// Narrower than the favicon's 75% (app/icon.tsx) so the Z clears circular and
// rounded-square avatar masks.
const ICON = 1024;
const iconScale = (ICON * 0.62) / mw;
const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON} ${ICON}"><rect width="${ICON}" height="${ICON}" fill="${INK}"/><path d="${MONOGRAM_PATH}" fill="${WHITE}" transform="translate(${(ICON - mw * iconScale) / 2} ${(ICON - mh * iconScale) / 2}) scale(${iconScale})"/></svg>\n`;

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
