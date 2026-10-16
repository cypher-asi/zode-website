/**
 * Prints the company profile (/company-profile) to
 * public/zode-company-profile.pdf, the file its Export PDF link downloads.
 * Rerun after changing the deck's figures or the profile's copy, with the
 * site running (`npm run dev` or `npm start`):
 *
 *   npm run profile:pdf
 *
 * Drives a local Chrome, Chromium or Brave over the DevTools protocol; set
 * CHROME to its path if it isn't found, and PROFILE_URL to print another
 * origin. Fails if the sheet overflows its page.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { PDFDocument } from "pdf-lib";

const ROOT = new URL("../", import.meta.url).pathname;
const OUT = join(ROOT, "public/zode-company-profile.pdf");
const URL_TO_PRINT = process.env.PROFILE_URL ?? "http://localhost:3000/company-profile";
const PORT = 9333;

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

const profileDir = await mkdtemp(join(tmpdir(), "zode-profile-"));
const browser = spawn(
  findBrowser(),
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
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
  await send("Page.navigate", { url: URL_TO_PRINT });
  let ready = false;
  for (let i = 0; i < 150 && !ready; i++) {
    await sleep(200);
    ready = await evaluate(
      "document.readyState === 'complete' && !!document.querySelector('article') && [...document.images].every((img) => img.complete)",
    ).catch(() => false);
  }
  if (!ready) throw new Error(`${URL_TO_PRINT} didn't finish loading; is the site running?`);
  await evaluate("document.fonts.ready.then(() => true)");

  await send("Emulation.setEmulatedMedia", { media: "print" });
  // The sheet clips at its edge, so compare its lowest element with that edge rather than read scrollHeight,
  // which also counts the bottom padding the content may run into.
  const overflow = await evaluate(`(() => {
    const sheet = document.querySelector("article");
    const lowest = Math.max(...[...sheet.querySelectorAll("*")].map((el) => el.getBoundingClientRect().bottom));
    return Math.ceil(lowest - sheet.getBoundingClientRect().bottom);
  })()`);
  if (overflow > 0) throw new Error(`The sheet overflows its page by ${overflow}px; trim it before printing.`);

  const { data } = await send("Page.printToPDF", {
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: false,
  });
  ws.close();

  const pdf = await PDFDocument.load(Buffer.from(data, "base64"));
  if (pdf.getPageCount() !== 1) throw new Error(`The PDF has ${pdf.getPageCount()} pages, not one.`);
  pdf.setTitle("ZODE company profile");
  pdf.setAuthor("ZODE");
  await writeFile(OUT, await pdf.save());
  console.log(`Wrote ${OUT}`);
} finally {
  const exited = new Promise((resolve) => browser.once("exit", resolve));
  browser.kill();
  await exited;
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5 });
}
