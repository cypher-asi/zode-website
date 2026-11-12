/**
 * Prints the investor deck (/deck) to PDF twice: the public slides ending on
 * the gate, and the whole deck. Every production build runs it after
 * `next build` (`postbuild`) with `--deploy`: it starts the site it just
 * built, prints it, and uploads both to the private Blob store
 * (BLOB_READ_WRITE_TOKEN, already set on the project), where /deck/pdf
 * hands them out (src/features/deck/pdf.ts). So the PDFs always match the
 * deck that's deployed; a failed print fails the build rather than leave
 * them behind it. Preview builds skip it.
 *
 * The full deck is behind data room access. The server started here gets a
 * random `DECK_PRINT_KEY`, and the print sends it back (access.ts), so no
 * one's session or share link is involved and no deployed server knows a key.
 *
 * Run by hand against the dev server (`npm run dev`) to write them to
 * ~/Downloads; it prints the full deck too if the server and this share a
 * DECK_PRINT_KEY (e.g. from .env.local):
 *
 *   npm run deck:pdf -- [--out ~/Downloads]
 *
 * DECK_URL prints another origin. Locally it drives Chrome, Chromium or Brave
 * (CHROME sets its path); on Vercel, the Chromium in @sparticuz/chromium.
 * Fails if a page count is off or a version printed with the wrong slides.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { put } from "@vercel/blob";
import { PDFDocument } from "pdf-lib";
import { DECK_PDFS, DECK_PRINT_HEADER } from "../src/features/deck/pdf.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const CDP_PORT = 9335;
const SITE_PORT = 3939;
/** The slides' layout is in units of the window, so print at a 16:9 one like the page. */
const VIEWPORT = { width: 1600, height: 900 };
/** Time for what slides fetch as they come near (the states slide's local pauses) once every one is open. */
const SETTLE_MS = 2500;

const { values: args } = parseArgs({
  options: {
    out: { type: "string", default: "~/Downloads" },
    deploy: { type: "boolean", default: false },
  },
});
const expand = (p) => resolve(p.replace(/^~(?=$|\/)/, homedir()));

if (args.deploy && process.env.VERCEL_ENV !== "production") {
  console.log("[deck:pdf] Not a production build, so the deck's PDFs stay as they are.");
  process.exit(0);
}
if (args.deploy && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error("[deck:pdf] Uploading needs BLOB_READ_WRITE_TOKEN.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BROWSERS = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "brave", "brave-browser"];
const MAC_APPS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
];

/** The browser and the flags it runs headless with. */
async function findBrowser() {
  if (process.env.VERCEL) {
    const { default: chromium } = await import("@sparticuz/chromium");
    return { path: await chromium.executablePath(), flags: chromium.args };
  }
  const flags = ["--headless=new", "--disable-gpu"];
  if (process.env.CHROME) return { path: process.env.CHROME, flags };
  const dirs = (process.env.PATH ?? "").split(delimiter);
  const onPath = BROWSERS.flatMap((name) => dirs.map((dir) => join(dir, name)));
  const found = [...onPath, ...MAC_APPS].find((path) => existsSync(path));
  if (!found) throw new Error("No Chrome, Chromium or Brave found; set CHROME to its path.");
  return { path: found, flags };
}

/** The site this build made, with a key for the full deck that only it and this script know. */
async function startSite(key) {
  const site = spawn(
    process.execPath,
    [join(ROOT, "node_modules/next/dist/bin/next"), "start", "-p", String(SITE_PORT), "-H", "127.0.0.1"],
    { env: { ...process.env, DECK_PRINT_KEY: key }, stdio: ["ignore", "ignore", "inherit"] },
  );
  const url = `http://127.0.0.1:${SITE_PORT}/deck`;
  for (let i = 0; i < 150; i++) {
    if (site.exitCode !== null) throw new Error(`The built site exited (${site.exitCode}) before it served the deck.`);
    const ok = await fetch(url).then((res) => res.ok, () => false);
    if (ok) return { site, url };
    await sleep(200);
  }
  site.kill();
  throw new Error("The built site didn't serve the deck within 30 seconds.");
}

/** Every image loaded, lazy ones included, which a parked slide never asks for on its own. Only once hydrated, so React's markup still matches. */
const ALL_IMAGES_READY = `(() => {
  for (const img of document.images) img.loading = "eager";
  return [...document.images].every((img) => img.complete);
})()`;

async function connect() {
  let targets = null;
  for (let i = 0; i < 50 && !targets; i++) {
    await sleep(200);
    targets = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
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
  return { ws, send, evaluate };
}

/** One version of the deck as PDF bytes, checked against what the page laid out. */
async function printDeck({ send, evaluate }, url, version, key) {
  // Asking not to be tracked keeps the print out of the site's analytics.
  const headers = { DNT: "1", "Sec-GPC": "1" };
  if (version === "full") headers[DECK_PRINT_HEADER] = key;
  await send("Network.setExtraHTTPHeaders", { headers });
  await send("Emulation.setEmulatedMedia", { media: "screen" });
  await send("Page.navigate", { url });
  let ready = false;
  for (let i = 0; i < 150 && !ready; i++) {
    await sleep(200);
    ready = await evaluate(`document.readyState === "complete" && !!document.querySelector("[data-slot]")`).catch(
      () => false,
    );
  }
  if (!ready) throw new Error(`${url} didn't finish loading; is the site running?`);
  await evaluate("document.fonts.ready.then(() => true)");

  // The deck lays out every slide for print on `beforeprint` (Deck.tsx), opening every parked one, once it has hydrated.
  let opened = false;
  for (let i = 0; i < 100 && !opened; i++) {
    opened = await evaluate(`(window.dispatchEvent(new Event("beforeprint")), !document.querySelector("[data-parked]"))`);
    if (!opened) await sleep(200);
  }
  if (!opened) throw new Error("The deck never laid out its slides for print.");
  await send("Emulation.setEmulatedMedia", { media: "print" });
  await sleep(SETTLE_MS);
  let loaded = false;
  for (let i = 0; i < 100 && !loaded; i++) {
    loaded = await evaluate(ALL_IMAGES_READY);
    if (!loaded) await sleep(200);
  }
  if (!loaded) throw new Error("The deck's images didn't all load.");
  await evaluate("document.fonts.ready.then(() => true)");

  // Each slide is a page; the detail slides that open from one on screen aren't printed.
  const { pages, gated } = await evaluate(`({
    pages: document.querySelector("[data-slot]").parentElement.querySelectorAll(":scope > section").length,
    gated: !!document.querySelector('[data-slot] [data-kind="gate"]'),
  })`);
  if (gated !== (version === "public")) {
    throw new Error(
      version === "full"
        ? "The full deck printed gated; the server didn't take the print's DECK_PRINT_KEY."
        : "The public deck printed without its gate.",
    );
  }

  const { data } = await send("Page.printToPDF", {
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: false,
  });
  const pdf = await PDFDocument.load(Buffer.from(data, "base64"));
  if (pdf.getPageCount() !== pages) {
    throw new Error(`The ${version} PDF has ${pdf.getPageCount()} pages for ${pages} slides; a slide spilled onto another page.`);
  }
  pdf.setTitle(version === "full" ? "ZODE investor deck (confidential)" : "ZODE investor deck");
  pdf.setAuthor("ZODE");
  return { bytes: await pdf.save(), pages };
}

const key = args.deploy ? randomBytes(32).toString("base64url") : process.env.DECK_PRINT_KEY;
const { site, url } = args.deploy
  ? await startSite(key)
  : { site: null, url: process.env.DECK_URL ?? "http://localhost:3000/deck" };
const { path: browserPath, flags } = await findBrowser();
const profileDir = await mkdtemp(join(tmpdir(), "zode-deck-"));
const browser = spawn(
  browserPath,
  [
    ...flags,
    "--hide-scrollbars",
    "--no-first-run",
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  const page = await connect();
  await page.send("Page.enable");
  await page.send("Network.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });

  const versions = key ? ["public", "full"] : ["public"];
  if (!key) console.log("No DECK_PRINT_KEY, so printing the public deck only.");
  for (const version of versions) {
    const { bytes, pages } = await printDeck(page, url, version, key);
    const { pathname, filename } = DECK_PDFS[version];
    if (args.deploy) {
      await put(pathname, Buffer.from(bytes), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/pdf",
      });
      console.log(`[deck:pdf] Uploaded the ${version} deck, ${pages} pages, to ${pathname}`);
    } else {
      const out = join(expand(args.out), filename);
      await writeFile(out, bytes);
      console.log(`Wrote the ${version} deck, ${pages} pages, to ${out}`);
    }
  }
  page.ws.close();
} finally {
  const exited = new Promise((resolve) => browser.once("exit", resolve));
  browser.kill();
  await exited;
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5 });
  if (site) {
    const stopped = new Promise((resolve) => site.once("exit", resolve));
    site.kill();
    await stopped;
  }
}
