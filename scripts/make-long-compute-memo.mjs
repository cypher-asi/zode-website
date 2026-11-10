/**
 * Prints the Long Compute Fund I investment memo (scripts/memos/long-compute-fund-i)
 * to a two-page letter PDF, its figures computed from ZODE's master model:
 *
 *   npm run memo:long-compute -- [--model ~/Downloads/CORE/ZODE_MasterModel_26.11.09_v2.xlsx] \
 *     [--out ~/Downloads/CORE/Long_Compute_Fund_I_Memo_v2.pdf] [--dry-run]
 *
 * One MW of critical IT is costed from the model's Toronto and Zode Inc. inputs,
 * read by their labels in column B (a missing label fails the run), and sold
 * three ways: a contracted offtake, merchant and inference, at the memo's rates
 * below. `--dry-run` prints the figures without opening a browser. Needs a local
 * Chrome, Chromium or Brave; set CHROME to its path if it isn't found. Fails if a
 * page overflows or the PDF isn't two pages.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { strFromU8, unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const MEMO = join(ROOT, "scripts/memos/long-compute-fund-i");
const PORT = 9335;
const PAGES = 2;

const { values: args } = parseArgs({
  options: {
    model: { type: "string", default: "~/Downloads/CORE/ZODE_MasterModel_26.11.09_v2.xlsx" },
    out: { type: "string", default: "~/Downloads/CORE/Long_Compute_Fund_I_Memo_v2.pdf" },
    "dry-run": { type: "boolean", default: false },
  },
});
const expand = (p) => resolve(p.replace(/^~(?=$|\/)/, homedir()));
const MODEL = expand(args.model);
const OUT = expand(args.out);

const fail = (message) => {
  console.error(`[memo] ${message}`);
  process.exit(1);
};

// The memo's three ways to sell the hours; everything else comes from the model.
const OFFTAKE = { price: 5, prepay: 0.275, termMonths: 36, billed: 1 };
const INFERENCE = { prices: [20, 30, 40], utilization: 0.91 };
const TOKEN_VALUE = 30;

/* ---------- The model's inputs ---------- */

const zip = unzipSync(new Uint8Array(await readFile(MODEL)));
const modelName = MODEL.split("/").pop();
const part = (name) => (zip[name] ? strFromU8(zip[name]) : fail(`${modelName}: no ${name}; is it an .xlsx workbook?`));
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e] ?? match),
  );
const texts = (xml) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");
const attr = (attrs, name) => {
  const value = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];
  return value === undefined ? undefined : decode(value);
};
const shared = zip["xl/sharedStrings.xml"]
  ? [...part("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]))
  : [];
const rels = new Map(
  [...part("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [attr(m[1], "Id"), attr(m[1], "Target")]),
);
const sheets = [...part("xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/>/g)].map((m) => ({
  name: attr(m[1], "name"),
  target: rels.get(attr(m[1], "r:id")),
}));

/** A sheet's input column (D) by the label in column B, for rows above its monthly build. */
function inputs(sheetName) {
  const target = sheets.find((s) => s.name === sheetName)?.target ?? fail(`${modelName}: no "${sheetName}" sheet.`);
  const rows = new Map();
  for (const m of part(target.startsWith("/") ? target.slice(1) : `xl/${target}`).matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = /\br="([A-Z]+)(\d+)"/.exec(m[1]);
    if (!ref || (ref[1] !== "B" && ref[1] !== "D")) continue;
    const type = attr(m[1], "t");
    const raw = /<v>([\s\S]*?)<\/v>/.exec(m[2] ?? "")?.[1];
    let value;
    if (type === "s") value = raw === undefined ? undefined : shared[Number(raw)];
    else if (type === "inlineStr") value = texts(m[2] ?? "");
    else value = raw === undefined ? undefined : Number(raw);
    if (value === undefined || value === "") continue;
    const row = Number(ref[2]);
    if (!rows.has(row)) rows.set(row, {});
    rows.get(row)[ref[1]] = value;
  }
  return (label) => {
    const row = [...rows.values()].find((r) => String(r.B ?? "").trim() === label);
    if (typeof row?.D !== "number") fail(`${modelName}: no number for "${label}" on ${sheetName}.`);
    return row.D;
  };
}

const toronto = inputs("Toronto");
const topco = inputs("Zode Inc.");

const M = {
  gpus: toronto("GPUs per MW"),
  hardwarePerGpu: toronto("Hardware cost per GPU, all-in"),
  nodeCost: topco("B300 HGX server ($ per 8-GPU node)"),
  networkPct: topco("Networking and storage (% of server)"),
  setup: toronto("Deployment and setup ($ per MW, each generation)"),
  nrc: toronto("NRC + legal per MW"),
  lifeMonths: toronto("Operating life (months; no refresh)"),
  resale: topco("Hardware resale at end of each generation (% of cost)"),
  power: toronto("Power ($/kWh)"),
  load: toronto("Average IT load"),
  pue: topco("PUE"),
  rent: toronto("CORE rate ($ per kW-month, all-in; no NNN)"),
  software: toronto("Software, security and overhead ($ per MW per year)"),
  insurance: topco("Equipment insurance and hardware support (% of hardware per year)"),
  contingency: topco("Operating contingency (% of power, rent and operating costs)"),
  inferenceTeam: toronto("Inference team, fixed ($ per year, at 100% inference)"),
  merchantPrice: toronto("Merchant price at launch ($/GPU-hour)"),
  merchantUtil: toronto("Merchant utilization"),
  merchantDecline: toronto("Merchant price decline per year of GPU age"),
  merchantFee: topco("Merchant sales and marketplace costs (% of merchant revenue)"),
  inferenceDecline: toronto("Inference decline per year of GPU age"),
  inferenceFloor: topco("Inference floor ($/GPU-hour)"),
  platformTake: topco("Inference platform take (% of inference revenue)"),
  sla: topco("SLA credits (% of revenue)"),
  bankPct: toronto("Bank debt (% of GPU hardware)"),
  bankRate: toronto("Bank debt rate"),
  mezzPct: toronto("Mezzanine debt (% of GPU hardware)"),
  mezzRate: toronto("Mezzanine rate"),
  amortMonths: toronto("Amortization (months)"),
};

/* ---------- One MW, sold three ways ---------- */

const HOURS = 8760;
const gpuHours = M.gpus * HOURS;
const hardware = M.gpus * M.hardwarePerGpu;
const capex = hardware + M.setup + M.nrc;
const powerCost = 1000 * M.load * M.pue * HOURS * M.power;
const rentCost = M.rent * 1000 * 12;
const insuranceCost = M.insurance * hardware;
const opexFor = (inference) => {
  const base = powerCost + rentCost + insuranceCost + M.software + (inference ? M.inferenceTeam : 0);
  return base * (1 + M.contingency);
};
const debt = (M.bankPct + M.mezzPct) * hardware;
const debtRate = (M.bankPct * M.bankRate + M.mezzPct * M.mezzRate) / (M.bankPct + M.mezzPct);
const principal = debt / M.amortMonths;
const interestOver = (months) =>
  Array.from({ length: Math.min(months, M.amortMonths) }, (_, k) => (debt - principal * k) * (debtRate / 12)).reduce((a, b) => a + b, 0);
const debtService1 = Math.min(12, M.amortMonths) * principal + interestOver(12);

const merchantFees = M.merchantFee + M.sla;
const inferenceFees = M.platformTake + M.sla;

/** Monthly revenue, fees and operating cost for month m (0 = first month in service). */
function monthOf(kind, price, m) {
  const age = Math.floor(m / 12);
  const merchant = () => {
    const rate = M.merchantPrice * (1 - M.merchantDecline) ** age;
    const revenue = (rate * M.merchantUtil * gpuHours) / 12;
    return { revenue, fees: revenue * merchantFees, opex: opexFor(false) / 12 };
  };
  if (kind === "offtake") {
    if (m >= OFFTAKE.termMonths) return merchant();
    const revenue = (OFFTAKE.price * OFFTAKE.billed * gpuHours) / 12;
    return { revenue, fees: revenue * M.sla, opex: opexFor(false) / 12, credit: prepayOf() / OFFTAKE.termMonths };
  }
  if (kind === "merchant") return merchant();
  const rate = Math.max(M.inferenceFloor, price * (1 - M.inferenceDecline) ** age);
  const revenue = (rate * INFERENCE.utilization * gpuHours) / 12;
  return { revenue, fees: revenue * inferenceFees, opex: opexFor(true) / 12 };
}
const prepayOf = () => OFFTAKE.prepay * OFFTAKE.price * OFFTAKE.billed * gpuHours * (OFFTAKE.termMonths / 12);

function scenario(kind, price) {
  const prepay = kind === "offtake" ? prepayOf() : 0;
  const months = Array.from({ length: M.lifeMonths }, (_, m) => monthOf(kind, price, m));
  // Cash in each month: invoices less fees and operating costs; prepaid hours are credited, not invoiced.
  const cash = months.map((x) => x.revenue - (x.credit ?? 0) - x.fees - x.opex);
  const year1 = months.slice(0, 12);
  const revenue1 = year1.reduce((a, x) => a + x.revenue, 0);
  const margin1 = year1.reduce((a, x) => a + x.revenue - x.fees - x.opex, 0);
  const cash1 = cash.slice(0, 12).reduce((a, b) => a + b, 0);

  let cumulative = prepay - capex;
  let payback = null;
  cash.forEach((c, m) => {
    cumulative += c;
    if (payback === null && cumulative >= 0) payback = m + 1;
  });

  // Months for the debt to be repaid if every dollar of cash went to it.
  let balance = debt;
  let debtFree = null;
  for (let m = 0; m < cash.length && debtFree === null; m++) {
    balance += balance * (debtRate / 12) - cash[m];
    if (balance <= 0) debtFree = m + 1;
  }

  // The year-1 rate that just covers operating costs and debt service at this scenario's utilization and fees.
  const util = kind === "inference" ? INFERENCE.utilization : M.merchantUtil;
  const fees = kind === "inference" ? inferenceFees : merchantFees;
  const breakeven = (opexFor(kind === "inference") + debtService1) / (util * gpuHours * (1 - fees));
  const rate = kind === "offtake" ? OFFTAKE.price : kind === "merchant" ? M.merchantPrice : price;

  const lifetime = prepay + cash.reduce((a, b) => a + b, 0) + M.resale * hardware;
  return {
    kind,
    rate,
    prepay,
    revenue1,
    margin1,
    dscr1: cash1 / debtService1,
    atRisk: capex - prepay,
    payback,
    debtFree,
    breakeven,
    cushion: 1 - breakeven / rate,
    multiple: lifetime / capex,
  };
}

const scenarios = [
  scenario("offtake"),
  scenario("merchant"),
  ...INFERENCE.prices.map((p) => scenario("inference", p)),
];
if (scenarios.some((s) => s.payback === null || s.debtFree === null)) fail("A scenario never pays back its capital or its debt.");

/* ---------- One MW of tokens at $30, under today's contracted structure ---------- */

const tokenHours = gpuHours * INFERENCE.utilization;
const tokenValue = TOKEN_VALUE * tokenHours;
const contract = OFFTAKE.price * OFFTAKE.billed * gpuHours;
const hardwareYear = (hardware * (1 - M.resale) * 12) / M.lifeMonths;
const siteYear = (powerCost + rentCost) * (1 + M.contingency);
const otherYear = opexFor(false) - siteYear + contract * M.sla;
const interestYear = interestOver(12);
const equityYear = contract - hardwareYear - siteYear - otherYear - interestYear;
const prepay = prepayOf();
const equityIn = capex - debt - prepay;
const split = [
  { key: "OFFTAKER", value: tokenValue - contract },
  { key: "NVIDIA", value: hardwareYear },
  { key: "SITE", value: siteYear },
  { key: "OTHER", value: otherYear },
  { key: "DEBT", value: interestYear },
  { key: "EQUITY", value: equityYear },
];
const splitTotal = split.reduce((a, s) => a + s.value, 0);
if (Math.abs(splitTotal - tokenValue) > 1) fail(`The token split adds to ${splitTotal}, not ${tokenValue}.`);

/* ---------- Figures for the page ---------- */

const usd = (v, digits = 2) => `$${v.toFixed(digits)}`;
const mm = (v, digits = 1) => `$${(v / 1e6).toFixed(digits)}M`;
const pct = (v, digits = 0) => `${(v * 100).toFixed(digits)}%`;
const k = (v) => `$${Math.round(v / 1000).toLocaleString("en-US")}K`;

const F = {
  GPUS: String(M.gpus),
  HW_PER_GPU: `$${M.hardwarePerGpu.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
  HW_PER_GPU_K: `$${(M.hardwarePerGpu / 1000).toFixed(1)}K`,
  NODE: k(M.nodeCost),
  NETWORK_PCT: pct(M.networkPct),
  HARDWARE: mm(hardware),
  CAPEX: mm(capex),
  SETUP: k(M.setup),
  NRC: mm(M.nrc, 2),
  POWER: usd(M.power, 2),
  LOAD: pct(M.load),
  PUE: String(M.pue),
  RENT: `$${M.rent}`,
  SOFTWARE: k(M.software),
  INSURANCE: pct(M.insurance, 1),
  CONTINGENCY: pct(M.contingency),
  MERCHANT_FEE: pct(M.merchantFee),
  PLATFORM_TAKE: pct(M.platformTake),
  SLA: pct(M.sla),
  INFERENCE_TEAM: mm(M.inferenceTeam),
  DECLINE: pct(M.merchantDecline),
  FLOOR: usd(M.inferenceFloor, 0),
  RESALE: pct(M.resale),
  LIFE_YEARS: String(M.lifeMonths / 12),
  DEBT: mm(debt),
  DEBT_PCT: pct(debt / capex),
  DEBT_HW_PCT: pct(M.bankPct + M.mezzPct),
  BANK_PCT: pct(M.bankPct),
  BANK_RATE: pct(M.bankRate),
  MEZZ_PCT: pct(M.mezzPct),
  MEZZ_RATE: pct(M.mezzRate),
  DEBT_RATE: pct(debtRate),
  AMORT: String(M.amortMonths),
  DEBT_SERVICE: mm(debtService1),
  INTEREST_LIFE: mm(interestOver(M.amortMonths), 2),
  MERCHANT_PRICE: usd(M.merchantPrice, 2),
  MERCHANT_UTIL: pct(M.merchantUtil),
  INFERENCE_UTIL: pct(INFERENCE.utilization),
  OFFTAKE_PRICE: usd(OFFTAKE.price, 2),
  OFFTAKE_PREPAY: pct(OFFTAKE.prepay, 1),
  OFFTAKE_YEARS: String(OFFTAKE.termMonths / 12),
  PREPAY: mm(prepay),
  PREPAY_PCT: pct(prepay / capex),
  EQUITY_IN: mm(equityIn),
  EQUITY_PCT: pct(equityIn / capex),
  TOKEN_PRICE: usd(TOKEN_VALUE, 0),
  TOKEN_HOURS: `${(tokenHours / 1e6).toFixed(2)}M`,
  TOKEN_VALUE: mm(tokenValue),
  CONTRACT: mm(contract),
  MAX_PAYBACK: String(Math.max(...scenarios.map((s) => s.payback))),
};

const names = ["OFF", "MER", "I20", "I30", "I40"];
scenarios.forEach((s, i) => {
  const n = names[i];
  F[`${n}_REV`] = mm(s.revenue1);
  F[`${n}_MARGIN`] = mm(s.margin1);
  F[`${n}_PREPAY`] = s.prepay ? mm(s.prepay) : "None";
  F[`${n}_RISK`] = mm(s.atRisk);
  F[`${n}_PAYBACK`] = String(s.payback);
  F[`${n}_BAR`] = (100 * (s.payback / Math.max(...scenarios.map((x) => x.payback)))).toFixed(1);
  F[`${n}_DEBTFREE`] = String(s.debtFree);
  F[`${n}_DSCR`] = `${s.dscr1.toFixed(1)}x`;
  F[`${n}_BREAKEVEN`] = usd(s.breakeven, 2);
  F[`${n}_CUSHION`] = pct(s.cushion);
  F[`${n}_MULTIPLE`] = `${s.multiple.toFixed(1)}x`;
});
for (const s of split) {
  F[`${s.key}_YR`] = mm(s.value);
  F[`${s.key}_HR`] = usd(s.value / tokenHours, 2);
  F[`${s.key}_SHARE`] = pct(s.value / tokenValue, 1);
  F[`${s.key}_BAR`] = (100 * (s.value / tokenValue)).toFixed(2);
}

if (args["dry-run"]) {
  console.table(scenarios.map((s) => ({ ...s, revenue1: s.revenue1 / 1e6, margin1: s.margin1 / 1e6, atRisk: s.atRisk / 1e6, prepay: s.prepay / 1e6 })));
  console.log(F);
  process.exit(0);
}

/* ---------- Print ---------- */

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

const work = await mkdtemp(join(tmpdir(), "zode-memo-"));
const profileDir = await mkdtemp(join(tmpdir(), "zode-memo-browser-"));
let browser;

try {
  const html = (await readFile(join(MEMO, "memo.html"), "utf8")).replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in F)) throw new Error(`memo.html has a placeholder nothing fills: ${match}`);
    return F[key];
  });
  await writeFile(join(work, "memo.css"), await readFile(join(MEMO, "memo.css"), "utf8"));
  await writeFile(join(work, "index.html"), html);

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
  for (let i = 0; i < 100 && !ready; i++) {
    await sleep(100);
    ready = await evaluate("document.readyState === 'complete'").catch(() => false);
  }
  if (!ready) throw new Error("The memo didn't finish loading.");
  await evaluate("document.fonts.ready.then(() => true)");

  await send("Emulation.setEmulatedMedia", { media: "print" });
  // Each page clips at its edges, so its body must end above the page's footer.
  const overflows = await evaluate(`[...document.querySelectorAll(".page")].flatMap((page, i) => {
    const body = page.querySelector(".body");
    const over = Math.ceil(body.scrollHeight - body.clientHeight);
    return over > 0 ? [\`page \${i + 1} by \${over}px\`] : [];
  })`);
  if (overflows.length) throw new Error(`Content overflows: ${overflows.join(", ")}.`);

  const { data } = await send("Page.printToPDF", {
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: false,
  });
  ws.close();

  const pdf = await PDFDocument.load(Buffer.from(data, "base64"));
  if (pdf.getPageCount() !== PAGES) throw new Error(`The PDF has ${pdf.getPageCount()} pages, not ${PAGES}.`);
  pdf.setTitle("Long Compute Fund I · Investment Memo");
  pdf.setAuthor("ZODE");
  await writeFile(OUT, await pdf.save());
  console.log(`Wrote ${OUT}`);
} finally {
  if (browser) {
    const exited = new Promise((resolve) => browser.once("exit", resolve));
    browser.kill();
    await exited;
  }
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5 });
  await rm(work, { recursive: true, force: true });
}
