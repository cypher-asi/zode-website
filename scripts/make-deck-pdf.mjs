/**
 * Prints the investor deck (/deck) to PDF twice: the public slides ending on
 * the gate, and with a data room's share token the whole deck. Run with the
 * site up (`npm run dev` or `npm start`) to write both to ~/Downloads:
 *
 *   DECK_ROOM_TOKEN=<share token> npm run deck:pdf -- [--out ~/Downloads]
 *
 * With `--upload` they go to the private Blob store instead
 * (BLOB_READ_WRITE_TOKEN), where /deck/download hands them out
 * (src/features/deck/pdf.ts). The Deck PDF workflow does this against
 * zode.org after every production deploy, so the PDFs follow the deck.
 *
 * DECK_URL prints another origin. Drives a local Chrome, Chromium or Brave
 * over the DevTools protocol; set CHROME to its path if it isn't found.
 * Fails if a page count is off or the full print came out gated, so a
 * revoked token can't upload the public deck as the full one.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { put } from "@vercel/blob";
import { PDFDocument } from "pdf-lib";
import { DECK_PDFS } from "../src/features/deck/pdf.ts";

const DECK_URL = process.env.DECK_URL ?? "http://localhost:3000/deck";
const ROOM_TOKEN = process.env.DECK_ROOM_TOKEN;
const PORT = 9335;
/** The slides' layout is in units of the window, so print at a 16:9 one like the page. */
const VIEWPORT = { width: 1600, height: 900 };
/** Time for what slides fetch as they come near (the states slide's local pauses) once every one is open. */
const SETTLE_MS = 2500;

const { values: args } = parseArgs({
  options: {
    out: { type: "string", default: "~/Downloads" },
    upload: { type: "boolean", default: false },
  },
});
const expand = (p) => resolve(p.replace(/^~(?=$|\/)/, homedir()));

if (args.upload && !ROOM_TOKEN) throw new Error("Uploading needs DECK_ROOM_TOKEN, or the full deck would go stale.");
if (args.upload && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Uploading needs BLOB_READ_WRITE_TOKEN.");

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

const IMAGES_READY = "[...document.images].every((img) => img.complete)";
/** The same, lazy images included, which a parked slide never asks for on its own. Only once hydrated, so React's markup still matches. */
const ALL_IMAGES_READY = `(() => {
  for (const img of document.images) img.loading = "eager";
  return ${IMAGES_READY};
})()`;

async function connect() {
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
  return { ws, send, evaluate };
}

/** One version of the deck as PDF bytes, checked against what the page laid out. */
async function printDeck({ send, evaluate }, version) {
  const url = new URL(DECK_URL);
  if (version === "full") url.searchParams.set("room", ROOM_TOKEN);

  await send("Emulation.setEmulatedMedia", { media: "screen" });
  await send("Page.navigate", { url: url.toString() });
  let ready = false;
  for (let i = 0; i < 150 && !ready; i++) {
    await sleep(200);
    ready = await evaluate(
      `document.readyState === "complete" && !!document.querySelector("[data-slot]") && ${IMAGES_READY}`,
    ).catch(() => false);
  }
  if (!ready) throw new Error(`${DECK_URL} didn't finish loading; is the site running?`);
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

  // Each slide is a page, and so is each detail slide printed after its own.
  const { pages, gated } = await evaluate(`({
    pages: document.querySelector("[data-slot]").parentElement.querySelectorAll(":scope > section").length,
    gated: !!document.querySelector('[data-slot] [data-kind="gate"]'),
  })`);
  if (gated !== (version === "public")) {
    throw new Error(
      version === "full"
        ? "The full deck printed gated; DECK_ROOM_TOKEN isn't a live share link."
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

const profileDir = await mkdtemp(join(tmpdir(), "zode-deck-"));
const browser = spawn(
  findBrowser(),
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    // Ubuntu's AppArmor refuses Chrome's sandbox to CI runners; the page printed is the site's own.
    ...(process.env.CI ? ["--no-sandbox"] : []),
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  const page = await connect();
  await page.send("Page.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });

  const versions = ROOM_TOKEN ? ["public", "full"] : ["public"];
  if (!ROOM_TOKEN) console.log("No DECK_ROOM_TOKEN, so printing the public deck only.");
  for (const version of versions) {
    const { bytes, pages } = await printDeck(page, version);
    const { pathname, filename } = DECK_PDFS[version];
    if (args.upload) {
      await put(pathname, Buffer.from(bytes), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/pdf",
      });
      console.log(`Uploaded the ${version} deck, ${pages} pages, to ${pathname}`);
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
}
