/**
 * Prints the Long Compute Fund I investment memo to a letter PDF, its figures
 * computed from ZODE's master model:
 *
 *   npm run memo:long-compute -- [--memo loan|leasing] \
 *     [--model ~/Downloads/CORE/ZODE_MasterModel_26.11.09_v2.xlsx] [--out <pdf>] [--dry-run]
 *
 * `loan` (scripts/memos/long-compute-fund-i, three pages) finances GPUs as loans
 * with a kicker; `leasing` (scripts/memos/long-compute-fund-i-leasing, four pages)
 * has each investor own its GPUs in a Deployment LLC that leases them to ZODE.
 * One MW of critical IT is costed from the model's Toronto and Zode Inc. inputs,
 * read by their labels in column B (a missing label fails the run), and sold
 * three ways: a contracted offtake, merchant and inference, at the memo's rates
 * below. The fund plan sizes each close to the GPUs it finances, and the proposed
 * loan (coupon, kicker) gives the fund's return per scenario; the lease charges the
 * same as base rent and participation, and its example deployments (Toronto,
 * Calgary, South Dakota) are sized from their own sheets. `--dry-run` prints the
 * figures without opening a browser. Needs a local Chrome, Chromium or Brave; set
 * CHROME to its path if it isn't found. Fails if a page overflows or the PDF has
 * the wrong page count.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { strFromU8, unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
// Both versions share the loan memo's stylesheet and logo.
const ASSETS = join(ROOT, "scripts/memos/long-compute-fund-i");
const MEMOS = {
  loan: {
    dir: ASSETS,
    pages: 3,
    title: "Long Compute Fund I · Investment Memo",
    out: "~/Downloads/CORE/Long_Compute_Fund_I_Memo_v2.pdf",
  },
  leasing: {
    dir: join(ROOT, "scripts/memos/long-compute-fund-i-leasing"),
    pages: 4,
    title: "Long Compute Fund I · Investment Memo · Leasing Structure",
    out: "~/Downloads/CORE/Long_Compute_Fund_I_Leasing_Memo.pdf",
  },
};
const PORT = 9335;

const { values: args } = parseArgs({
  options: {
    memo: { type: "string", default: "loan" },
    model: { type: "string", default: "~/Downloads/CORE/ZODE_MasterModel_26.11.09_v2.xlsx" },
    out: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`[memo] ${message}`);
  process.exit(1);
};

const MEMO = MEMOS[args.memo] ?? fail(`No memo "${args.memo}"; use ${Object.keys(MEMOS).join(" or ")}.`);
const expand = (p) => resolve(p.replace(/^~(?=$|\/)/, homedir()));
const MODEL = expand(args.model);
const OUT = expand(args.out ?? MEMO.out);

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
  const lookup = (label) => {
    const row = [...rows.values()].find((r) => String(r.B ?? "").trim() === label);
    if (typeof row?.D !== "number") fail(`${modelName}: no number for "${label}" on ${sheetName}.`);
    return row.D;
  };
  /** The sum of the inputs whose labels match, such as a site's capacity blocks. */
  lookup.sum = (pattern) => {
    const values = [...rows.values()].filter((r) => pattern.test(String(r.B ?? "").trim()) && typeof r.D === "number");
    if (!values.length) fail(`${modelName}: no numbers labelled ${pattern} on ${sheetName}.`);
    return values.reduce((a, r) => a + r.D, 0);
  };
  return lookup;
}

const toronto = inputs("Toronto");
const topco = inputs("Zode Inc.");
const calgary = inputs("Calgary");
const bigWatt = inputs("BigWatt");

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
    cash,
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

/* ---------- The fund: closes and the proposed GPU financing ---------- */

// The fund lends against the GPUs only (nodes, network, storage); ZODE and its site partners fund the data
// center, deployment and operations. The loan amortizes at a fixed coupon with recourse, and earns a kicker on
// the cluster's cash after operating costs and the loan payment, resale included.
const COUPON = 0.12;
const TERM_MONTHS = 36;
const KICKER = 0.3;
const CLOSES = [
  { mw: 1, size: 50e6 },
  { mw: 30 },
  { mw: 100 },
];

const loanPayment = (hardware * (COUPON / 12)) / (1 - (1 + COUPON / 12) ** -TERM_MONTHS);
const loanTotal = loanPayment * TERM_MONTHS;

/** Annualized IRR of monthly flows, the first at month 0. */
function irr(flows) {
  const npv = (r) => flows.reduce((a, f, m) => a + f / (1 + r) ** m, 0);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (1 + lo) ** 12 - 1;
}

function financing(s, rate, kind) {
  const flows = [-hardware];
  let coverage = Infinity;
  let kicker = 0;
  s.cash.forEach((c, m) => {
    const resale = m === s.cash.length - 1 ? M.resale * hardware : 0;
    const service = m < TERM_MONTHS ? loanPayment : 0;
    if (service) coverage = Math.min(coverage, c / service);
    const kick = KICKER * Math.max(0, c + resale - service);
    kicker += kick;
    flows.push(service + kick);
  });
  if (coverage < 1) fail(`The ${kind} cluster's cash falls short of the fund's loan payment; it would rest on recourse.`);
  const util = kind === "inference" ? INFERENCE.utilization : M.merchantUtil;
  const fees = kind === "inference" ? inferenceFees : merchantFees;
  const breakeven = (opexFor(kind === "inference") + 12 * loanPayment) / (util * gpuHours * (1 - fees));
  return {
    cover1: s.cash.slice(0, 12).reduce((a, b) => a + b, 0) / (12 * loanPayment),
    cushion: 1 - breakeven / rate,
    kicker,
    receipts1: flows.slice(1, 13).reduce((a, b) => a + b, 0),
    irr: irr(flows),
    multiple: flows.slice(1).reduce((a, b) => a + b, 0) / hardware,
  };
}
const funded = scenarios.slice(1).map((s) => financing(s, s.rate, s.kind));

const receipts1 = funded[0].receipts1;
let priorMw = 0;
let cumulative = 0;
const closes = CLOSES.map((close) => {
  const newMw = close.mw - priorMw;
  const needed = newMw * hardware;
  const size = close.size ?? needed;
  if (size < needed) fail(`Close to ${close.mw} MW raises ${size}, short of the ${needed} its GPUs cost.`);
  const reinvested = Math.min(needed, priorMw * receipts1);
  cumulative += size;
  const row = { mw: close.mw, newMw, needed, size, cumulative, reinvested, lp: size - reinvested, receipts: close.mw * receipts1 };
  priorMw = close.mw;
  return row;
});

/* ---------- The leasing structure: an investor's Deployment LLC per deployment ---------- */

// The LLC owns the GPUs and net-leases them to the operator: base rent equal to the loan payment above for its
// term, plus participation rent of the kicker's share of cluster cash after base rent, and it keeps the resale.
// LCF takes an acquisition fee and a management fee on unreturned capital, and carry once the investor has its
// preferred return and capital back; depreciation is allocated to the investor.
const ACQ_FEE = 0.01;
const MGMT_FEE = 0.015;
const PREF = 0.08;
const CARRY = 0.2;
const TAX_RATE = 0.37;
const equity = hardware * (1 + ACQ_FEE);
const lifeYears = M.lifeMonths / 12;
if (!Number.isInteger(lifeYears)) fail(`An operating life of ${M.lifeMonths} months isn't whole years.`);

// Depreciation as a share of basis by year in service. US property takes 100% bonus depreciation; property used
// predominantly outside the US must use ADS, five-year straight line with a half-year convention, no bonus.
const SCHEDULES = { us: [1], nonUs: [0.1, 0.2, 0.2, 0.2, 0.2, 0.1] };

/** Deductions by year for GPUs sold at the end of their life (half a year's in the year of sale), and the basis left. */
function depreciation(schedule) {
  const years = Array.from({ length: lifeYears }, (_, y) => (schedule[y] ?? 0) * (y === lifeYears - 1 && y < schedule.length - 1 ? 0.5 : 1));
  return { years, left: 1 - years.reduce((a, b) => a + b, 0) };
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

function leasing(s) {
  const base = s.cash.map((_, m) => (m < TERM_MONTHS ? loanPayment : 0));
  const participation = s.cash.map((c, m) => KICKER * Math.max(0, c - base[m]));
  const resale = M.resale * hardware;
  const rent = s.cash.map((_, m) => base[m] + participation[m] + (m === s.cash.length - 1 ? resale : 0));

  let capital = equity;
  let owed = 0;
  let back = null;
  const fees = [];
  const carry = [];
  const investor = [];
  rent.forEach((r, m) => {
    owed += (capital * PREF) / 12;
    const fee = (capital * MGMT_FEE) / 12;
    let cash = r - fee;
    if (cash < 0) fail(`Month ${m + 1}'s rent doesn't cover the management fee.`);
    const pref = Math.min(cash, owed);
    owed -= pref;
    cash -= pref;
    const returned = Math.min(cash, capital);
    capital -= returned;
    cash -= returned;
    if (back === null && capital <= 0) back = m + 1;
    fees.push(fee);
    carry.push(CARRY * cash);
    investor.push(pref + returned + cash * (1 - CARRY));
  });

  // Tax is settled at the end of each year in service, on rent less fees, carry and depreciation; at the sale the
  // basis left is recovered, so resale above it is ordinary income (recapture). Assumes the losses are usable.
  const afterTax = (schedule) => {
    const { years, left } = depreciation(schedule);
    const flows = [-equity, ...investor];
    years.forEach((d, y) => {
      const months = rent.slice(12 * y, 12 * (y + 1)).map((r, i) => r - fees[12 * y + i] - carry[12 * y + i]);
      const income = sum(months) - d * equity - (y === lifeYears - 1 ? left * equity : 0);
      flows[12 * (y + 1)] -= TAX_RATE * income;
    });
    return irr(flows);
  };

  return {
    participation: sum(participation),
    grossX: sum(rent) / hardware,
    grossIrr: irr([-hardware, ...rent]),
    fees: ACQ_FEE * hardware + sum(fees),
    carry: sum(carry),
    netX: sum(investor) / equity,
    netIrr: irr([-equity, ...investor]),
    back,
    usIrr: afterTax(SCHEDULES.us),
    nonUsIrr: afterTax(SCHEDULES.nonUs),
  };
}
const leased = scenarios.slice(1).map(leasing);
if (leased.some((l) => l.back === null)) fail("A lease never returns the investor's capital.");

// The memo's example Deployment LLCs, each a first deployment at a site, sized from its own sheet.
const SITES = [
  { key: "TOR", us: false, mw: toronto("Toronto cluster (64 B300 nodes)"), gpusPerMw: toronto("GPUs per MW"), perGpu: toronto("Hardware cost per GPU, all-in") },
  { key: "CAL", us: false, mw: calgary.sum(/^(Calgary|Olds) block \d+$/), gpusPerMw: calgary("GPUs per MW"), perGpu: calgary("Hardware cost per GPU, all-in") },
  { key: "SD", us: true, mw: bigWatt("Tranche 1"), gpusPerMw: bigWatt("GPUs per MW"), perGpu: bigWatt("Hardware cost per GPU, all-in") },
].map((site) => {
  const gpus = site.mw * site.gpusPerMw;
  const cost = gpus * site.perGpu;
  const basis = cost * (1 + ACQ_FEE);
  const { years, left } = depreciation(site.us ? SCHEDULES.us : SCHEDULES.nonUs);
  return {
    ...site,
    gpus,
    cost,
    basis,
    dep1: years[0] * basis,
    depLater: sum(years.slice(1)) * basis,
    left: left * basis,
    resale: M.resale * cost,
    gain: M.resale * cost - left * basis,
  };
});

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
const bn = (v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : mm(v, 1));
const times = (v, digits = 1) => `${v.toFixed(digits)}x`;
F.COUPON = pct(COUPON);
F.TERM = String(TERM_MONTHS);
F.KICKER = pct(KICKER);
F.LOAN_SERVICE = mm(12 * loanPayment);
F.LOAN_X = times(loanTotal / hardware, 2);
F.SITE_CAPEX = mm(M.setup + M.nrc, 2);
F.RESERVE = mm(CLOSES[0].size - hardware);
F.DEBT_X = times((debt + interestOver(M.amortMonths)) / debt, 2);
closes.forEach((c, i) => {
  const n = `C${i + 1}`;
  F[`${n}_MW`] = String(c.mw);
  F[`${n}_NEW`] = String(c.newMw);
  F[`${n}_NEEDED`] = bn(c.needed);
  F[`${n}_SIZE`] = bn(c.size);
  F[`${n}_CUM`] = bn(c.cumulative);
  F[`${n}_REINVEST`] = c.reinvested ? bn(c.reinvested) : "None";
  F[`${n}_LP`] = bn(c.lp);
  F[`${n}_RECEIPTS`] = bn(c.receipts);
  F[`${n}_FUNDS_MW`] = (c.receipts / hardware).toFixed(0);
});
["MER", "I20", "I30", "I40"].forEach((n, i) => {
  const f = funded[i];
  F[`${n}_FUND_COVER`] = times(f.cover1);
  F[`${n}_FUND_CUSHION`] = pct(f.cushion);
  F[`${n}_KICK`] = mm(f.kicker);
  F[`${n}_FUND_IRR`] = f.irr > 1 ? ">100%" : pct(f.irr);
  F[`${n}_FUND_X`] = times(f.multiple);
});

for (const s of split) {
  F[`${s.key}_YR`] = mm(s.value);
  F[`${s.key}_HR`] = usd(s.value / tokenHours, 2);
  F[`${s.key}_SHARE`] = pct(s.value / tokenValue, 1);
  F[`${s.key}_BAR`] = (100 * (s.value / tokenValue)).toFixed(2);
}

const money = (v) => (v < 1 ? "None" : v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : mm(v, v >= 1e7 ? 1 : 2));
const signed = (v) => (v < 0 ? `(${money(-v)})` : money(v));
const irrText = (v) => (v > 1 ? ">100%" : pct(v));
F.ACQ_FEE = pct(ACQ_FEE);
F.MGMT_FEE = pct(MGMT_FEE, 1);
F.PREF = pct(PREF);
F.CARRY = pct(CARRY);
F.INVESTOR_SHARE = pct(1 - CARRY);
F.TAX_RATE = pct(TAX_RATE);
F.L_EQUITY = money(equity);
F.L_ACQ = money(ACQ_FEE * hardware);
F.L_MGMT1 = money(MGMT_FEE * equity);
F.L_RESALE = money(M.resale * hardware);
F.US_TAX1 = money(TAX_RATE * depreciation(SCHEDULES.us).years[0] * equity);
F.NONUS_TAX1 = money(TAX_RATE * depreciation(SCHEDULES.nonUs).years[0] * equity);
["MER", "I20", "I30", "I40"].forEach((n, i) => {
  const l = leased[i];
  F[`${n}_L_PART`] = money(l.participation);
  F[`${n}_L_GROSS_X`] = times(l.grossX);
  F[`${n}_L_GROSS_IRR`] = irrText(l.grossIrr);
  F[`${n}_L_FEES`] = money(l.fees);
  F[`${n}_L_CARRY`] = money(l.carry);
  F[`${n}_L_NET_X`] = times(l.netX);
  F[`${n}_L_NET_IRR`] = irrText(l.netIrr);
  F[`${n}_L_BACK`] = String(l.back);
  F[`${n}_L_US_IRR`] = irrText(l.usIrr);
  F[`${n}_L_NONUS_IRR`] = irrText(l.nonUsIrr);
});
for (const s of SITES) {
  F[`${s.key}_MW`] = String(s.mw);
  F[`${s.key}_GPUS`] = s.gpus.toLocaleString("en-US");
  F[`${s.key}_GPMW`] = String(s.gpusPerMw);
  F[`${s.key}_COST`] = money(s.cost);
  F[`${s.key}_ACQ`] = money(ACQ_FEE * s.cost);
  F[`${s.key}_MGMT`] = money(MGMT_FEE * s.basis);
  F[`${s.key}_BASIS`] = money(s.basis);
  F[`${s.key}_DEP1`] = money(s.dep1);
  F[`${s.key}_TAX1`] = money(TAX_RATE * s.dep1);
  F[`${s.key}_DEPLATER`] = money(s.depLater);
  F[`${s.key}_LEFT`] = money(s.left);
  F[`${s.key}_RESALE`] = money(s.resale);
  F[`${s.key}_GAIN`] = signed(s.gain);
}

if (args["dry-run"]) {
  console.table(scenarios.map(({ cash, ...s }) => ({ ...s, revenue1: s.revenue1 / 1e6, margin1: s.margin1 / 1e6, atRisk: s.atRisk / 1e6, prepay: s.prepay / 1e6 })));
  console.table(funded);
  console.table(closes);
  if (args.memo === "leasing") {
    console.table(leased);
    console.table(SITES);
  }
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
  const html = (await readFile(join(MEMO.dir, "memo.html"), "utf8")).replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in F)) throw new Error(`memo.html has a placeholder nothing fills: ${match}`);
    return F[key];
  });
  await writeFile(join(work, "memo.css"), await readFile(join(ASSETS, "memo.css"), "utf8"));
  await copyFile(join(ASSETS, "logo.png"), join(work, "logo.png"));
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
    ready = await evaluate(
      "document.readyState === 'complete' && [...document.images].every((img) => img.complete && img.naturalWidth > 0)",
    ).catch(() => false);
  }
  if (!ready) throw new Error("The memo didn't finish loading; the logo may be missing.");
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
  if (pdf.getPageCount() !== MEMO.pages) throw new Error(`The PDF has ${pdf.getPageCount()} pages, not ${MEMO.pages}.`);
  pdf.setTitle(MEMO.title);
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
