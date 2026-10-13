/**
 * Downloads the headline face named by DISPLAY_FONT (src/features/styleguide/brand.ts)
 * from Google Fonts into src/assets/fonts/display: latin woff2 files for the
 * site (next/font/local in src/lib/fonts.ts), full TTFs for the deployment PDF
 * and the family's license. Runs before `dev` and `build`, and does nothing
 * until DISPLAY_FONT names a different family than the files on disk.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { DISPLAY_FONT } from "../src/features/styleguide/brand.ts";

const DIR = new URL("../src/assets/fonts/display/", import.meta.url);
const WEIGHTS = { light: 300, regular: 400 };
// Google picks the format by user agent: a browser with woff2 but without variable
// fonts (Chrome 60) gets static woff2 per weight and subset; anything else, whole TTFs.
const WOFF2_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36";

const onDisk = await readFile(new URL("family.txt", DIR), "utf8").catch(() => "");
if (onDisk.trim() === DISPLAY_FONT) process.exit(0);

async function faces(userAgent) {
  const family = DISPLAY_FONT.replaceAll(" ", "+");
  const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${Object.values(WEIGHTS).join(";")}`;
  const res = await fetch(url, { headers: { "user-agent": userAgent } });
  if (!res.ok) throw new Error(`Google Fonts has no "${DISPLAY_FONT}" in weights ${Object.values(WEIGHTS).join(" and ")} (HTTP ${res.status})`);
  const css = await res.text();
  return [...css.matchAll(/(?:\/\* ([\w-]+) \*\/\s*)?@font-face\s*{([^}]*)}/g)].map(([, subset, body]) => ({
    subset,
    weight: Number(/font-weight:\s*(\d+)/.exec(body)?.[1]),
    url: /url\((https:[^)]+)\)/.exec(body)?.[1],
  }));
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  await writeFile(new URL(file, DIR), Buffer.from(await res.arrayBuffer()));
}

const [web, desktop] = await Promise.all([faces(WOFF2_UA), faces("curl/8")]);
await mkdir(DIR, { recursive: true });

for (const [name, weight] of Object.entries(WEIGHTS)) {
  const woff2 = web.find((f) => f.weight === weight && f.subset === "latin");
  const ttf = desktop.find((f) => f.weight === weight && f.url?.endsWith(".ttf"));
  if (!woff2 || !ttf) throw new Error(`Google Fonts returned no ${weight} weight for "${DISPLAY_FONT}"`);
  await Promise.all([download(woff2.url, `${name}.woff2`), download(ttf.url, `${name}.ttf`)]);
}

const slug = DISPLAY_FONT.toLowerCase().replace(/[^a-z0-9]/g, "");
let licensed = false;
for (const [dir, file] of [["ofl", "OFL.txt"], ["apache", "LICENSE.txt"], ["ufl", "UFL.txt"]]) {
  const res = await fetch(`https://raw.githubusercontent.com/google/fonts/main/${dir}/${slug}/${file}`);
  if (!res.ok) continue;
  await writeFile(new URL("LICENSE.txt", DIR), await res.text());
  licensed = true;
  break;
}
if (!licensed) {
  await rm(new URL("LICENSE.txt", DIR), { force: true });
  console.warn(`[fonts] No license found for "${DISPLAY_FONT}" in google/fonts; add src/assets/fonts/display/LICENSE.txt by hand.`);
}

await writeFile(new URL("family.txt", DIR), `${DISPLAY_FONT}\n`);
console.log(`[fonts] Display face is now ${DISPLAY_FONT}.`);
