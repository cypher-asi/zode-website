/**
 * Prints the Chicago 801 S Canal site deck for prospective offtakers
 * (scripts/decks/chicago-801-canal) to a landscape PDF, one slide a page:
 *
 *   npm run deck:chicago -- [--out "~/Downloads/ZODE - Chicago 801 S Canal - Site Overview.pdf"]
 *
 * The photos and drawings are the presentation's site images
 * (src/features/presentations/sites/chicago-801-canal), taken from the
 * landlord's data room. Needs a local Chrome, Chromium or Brave; set CHROME
 * to its path if it isn't found. Fails if any slide overflows its page.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { PDFDocument } from "pdf-lib";
import { SITE_MAPS } from "../src/features/deck/art/siteMaps.ts";

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const DECK = join(ROOT, "scripts/decks/chicago-801-canal");
const IMAGES = join(ROOT, "src/features/presentations/sites/chicago-801-canal");
const IMAGE_FILES = ["building.jpg", "street.jpg", "massing.jpg", "roof.jpg", "siteplan.jpg", "wells.jpg"];
const PORT = 9334;

const { values: args } = parseArgs({
  options: {
    out: { type: "string", default: "~/Downloads/ZODE - Chicago 801 S Canal - Site Overview.pdf" },
  },
});
const expand = (p) => resolve(p.replace(/^~(?=$|\/)/, homedir()));
const OUT = expand(args.out);

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
  await Promise.all(IMAGE_FILES.map((file) => copyFile(join(IMAGES, file), join(work, file))));

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
