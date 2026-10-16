/**
 * Prints the Chicago 801 S Canal site deck for prospective offtakers
 * (scripts/decks/chicago-801-canal) to a landscape PDF, one slide a page:
 *
 *   npm run deck:chicago -- --src "~/Downloads/Chicago Concept Data Room (1)" \
 *     [--out "~/Downloads/ZODE - Chicago 801 S Canal - Site Overview.pdf"]
 *
 * `--src` is the landlord's concept data room as delivered. The photos and
 * drawings are pulled from its PDFs into a temporary folder on each run, so
 * none of the site's imagery is committed. Needs poppler (pdfimages,
 * pdftoppm) and a local Chrome, Chromium or Brave; set CHROME to its path if
 * it isn't found. Fails if any slide overflows its page.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync, renameSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { PDFDocument } from "pdf-lib";
import { SITE_MAPS } from "../src/features/deck/art/siteMaps.ts";

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const DECK = join(ROOT, "scripts/decks/chicago-801-canal");
const PORT = 9334;

const { values: args } = parseArgs({
  options: {
    src: { type: "string" },
    out: { type: "string", default: "~/Downloads/ZODE - Chicago 801 S Canal - Site Overview.pdf" },
  },
});
const expand = (p) => resolve(p.replace(/^~(?=$|\/)/, homedir()));
if (!args.src) throw new Error("--src is required: the Chicago concept data room folder.");
const SRC = expand(args.src);
const OUT = expand(args.out);
const TENANT_DECK = join(SRC, "01 801_S_Canal_CD_Tenant_Deck_1.pdf");
const WELL_SITING = join(SRC, "Individual Sets/P1691 - 801 S Canal Well Siting_8 Well.pdf");
for (const file of [TENANT_DECK, WELL_SITING]) if (!existsSync(file)) throw new Error(`${file} is missing.`);

const BROWSERS = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "brave", "brave-browser"];
const MAC_APPS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
];

function findBrowser() {
  if (process.env.CHROME) return process.env.CHROME;
  const dirs = (process.env.PATH ?? "").split(delimiter);
  const onPath = BROWSERS.flatMap((name) => dirs.map((dir) => join(dir, name)));
  const found = [...onPath, ...MAC_APPS].find((path) => existsSync(path));
  if (!found) throw new Error("No Chrome, Chromium or Brave found; set CHROME to its path.");
  return found;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The largest image on `page` of `pdf`, written to `dest` as it's stored
 * (JPEG stays JPEG). Returns the file it wrote.
 */
function extractLargestImage(pdf, page, work, dest) {
  const list = execFileSync("pdfimages", ["-list", "-f", String(page), "-l", String(page), pdf], { encoding: "utf8" });
  const images = list
    .split("\n")
    .slice(2)
    .map((line) => line.trim().split(/\s+/))
    .filter((cols) => cols[2] === "image")
    .map((cols) => ({ num: Number(cols[1]), area: Number(cols[3]) * Number(cols[4]) }));
  if (!images.length) throw new Error(`${pdf} has no image on page ${page}.`);
  const { num } = images.reduce((a, b) => (b.area > a.area ? b : a));
  const prefix = join(work, `p${page}`);
  execFileSync("pdfimages", ["-all", "-f", String(page), "-l", String(page), pdf, prefix]);
  const name = readdirSync(work).find((file) => file.startsWith(`p${page}-${String(num).padStart(3, "0")}.`));
  const ext = name.slice(name.lastIndexOf("."));
  const out = join(work, dest + ext);
  renameSync(join(work, name), out);
  return out;
}

function chicagoMap() {
  const map = SITE_MAPS.chicago;
  return ["water", "waterways", "minor", "arterial", "major", "rail"]
    .map((layer) => `<path class="${layer}" d="${map[layer]}" />`)
    .join("\n");
}

const work = await mkdtemp(join(tmpdir(), "zode-chicago-deck-"));
const profileDir = await mkdtemp(join(tmpdir(), "zode-chicago-deck-browser-"));
let browser;

try {
  // Tenant deck: page 1's photo of the building, page 2's street view, page 3's
  // massing, page 7's roof plant and page 8's site plan.
  const images = {
    building: extractLargestImage(TENANT_DECK, 1, work, "building"),
    massing: extractLargestImage(TENANT_DECK, 3, work, "massing"),
    roof: extractLargestImage(TENANT_DECK, 7, work, "roof"),
    siteplan: extractLargestImage(TENANT_DECK, 8, work, "siteplan"),
  };
  // Page 2's largest image repeats page 1's, so take its second, the street view.
  const pageTwo = execFileSync("pdfimages", ["-list", "-f", "2", "-l", "2", TENANT_DECK], { encoding: "utf8" })
    .split("\n")
    .slice(2)
    .map((line) => line.trim().split(/\s+/))
    .filter((cols) => cols[2] === "image" && cols[8] === "jpeg")
    .map((cols) => ({ num: Number(cols[1]), width: Number(cols[3]) }))
    .sort((a, b) => b.width - a.width);
  if (pageTwo.length < 2) throw new Error("The tenant deck's page 2 no longer has its street view.");
  execFileSync("pdfimages", ["-j", "-f", "2", "-l", "2", TENANT_DECK, join(work, "p2")]);
  renameSync(join(work, `p2-${String(pageTwo[1].num).padStart(3, "0")}.jpg`), join(work, "street.jpg"));
  // The well field, cropped from the drawing's title block and notes at 200 dpi.
  execFileSync("pdftoppm", ["-r", "200", "-x", "60", "-y", "60", "-W", "1640", "-H", "800", "-png", "-singlefile", WELL_SITING, join(work, "wells")]);

  for (const [name, file] of Object.entries(images)) {
    const ext = file.slice(file.lastIndexOf("."));
    const expected = { building: ".jpg", massing: ".jpg", roof: ".png", siteplan: ".png" }[name];
    if (ext !== expected) execFileSync("magick", [file, join(work, name + expected)]);
  }

  const rootUrl = pathToFileURL(ROOT).href;
  const workUrl = pathToFileURL(work).href;
  const wordmark = (await readFile(join(ROOT, "public/wordmark.svg"), "utf8")).replace(/<\?xml[^>]*>/, "").trim();
  const css = (await readFile(join(DECK, "deck.css"), "utf8")).replaceAll("{{ROOT}}", rootUrl);
  const html = (await readFile(join(DECK, "deck.html"), "utf8"))
    .replaceAll("{{ASSETS}}", workUrl)
    .replaceAll("{{WORDMARK}}", wordmark)
    .replaceAll("{{CHICAGO_MAP}}", chicagoMap());
  const unfilled = html.match(/\{\{\w+\}\}/);
  if (unfilled) throw new Error(`deck.html has a placeholder nothing fills: ${unfilled[0]}`);
  await writeFile(join(work, "deck.css"), css);
  await writeFile(join(work, "index.html"), html);
  const slideCount = (html.match(/<section class="slide/g) ?? []).length;

  browser = spawn(
    findBrowser(),
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--allow-file-access-from-files",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let targets = null;
  for (let i = 0; i < 50 && !targets; i++) {
    await sleep(200);
    targets = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      .then((res) => res.json())
      .catch(() => null);
  }
  const target = targets?.find((t) => t.type === "page");
  if (!target) throw new Error("The browser didn't open a page to drive.");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    pending.get(msg.id)?.(msg);
    pending.delete(msg.id);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) =>
    (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;

  await send("Page.enable");
  await send("Page.navigate", { url: pathToFileURL(join(work, "index.html")).href });
  let ready = false;
  for (let i = 0; i < 150 && !ready; i++) {
    await sleep(200);
    ready = await evaluate(
      "document.readyState === 'complete' && [...document.images].every((img) => img.complete && img.naturalWidth > 0)",
    ).catch(() => false);
  }
  if (!ready) throw new Error("The deck didn't finish loading; an image may be missing.");
  await evaluate("document.fonts.ready.then(() => true)");

  await send("Emulation.setEmulatedMedia", { media: "print" });
  // Slides clip at their edges, so compare each one's lowest and rightmost content with its box.
  const overflows = await evaluate(`[...document.querySelectorAll(".slide")].flatMap((slide, i) => {
    const box = slide.getBoundingClientRect();
    const inner = [...slide.querySelectorAll("*")].filter((el) => !el.closest(".cover-photo, .cover-shade, svg"));
    const bottom = Math.max(...inner.map((el) => el.getBoundingClientRect().bottom));
    const right = Math.max(...inner.map((el) => el.getBoundingClientRect().right));
    const over = Math.ceil(Math.max(bottom - box.bottom, right - box.right));
    return over > 0 ? [\`slide \${i + 1} by \${over}px\`] : [];
  })`);
  if (overflows.length) throw new Error(`Content overflows: ${overflows.join(", ")}.`);

  const { data } = await send("Page.printToPDF", {
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: false,
  });
  ws.close();

  const pdf = await PDFDocument.load(Buffer.from(data, "base64"));
  if (pdf.getPageCount() !== slideCount) {
    throw new Error(`The PDF has ${pdf.getPageCount()} pages for ${slideCount} slides; a slide spilled onto another page.`);
  }
  pdf.setTitle("ZODE · Chicago · 801 S Canal · Site overview");
  pdf.setAuthor("ZODE");
  await writeFile(OUT, await pdf.save());
  console.log(`Wrote ${OUT} (${slideCount} slides)`);
} finally {
  if (browser) {
    const exited = new Promise((resolve) => browser.once("exit", resolve));
    browser.kill();
    await exited;
  }
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5 });
  await rm(work, { recursive: true, force: true });
}
