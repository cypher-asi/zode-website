/**
 * Writes the deck's revenue ramp (src/features/deck/revenueRamp.ts) from ZODE's
 * master model in a room: the consolidated monthly P&L and cash flow on its Zode Inc. tab,
 * every SPV at 100% with future sites, by month and summed by quarter and by
 * year from the model's first month to December of `--through`:
 *
 *   node --env-file=.env.production.local scripts/write-revenue-ramp.mjs \
 *     --room <room id> --model "02 MODEL/ZODE_MasterModel_26.11.09.xlsx" \
 *     [--through 2030] [--file <local .xlsx>] [--dry-run]
 *
 * Each period is its critical IT live (MW of GPU clusters in service, on
 * average over its months) and its revenue by how it's sold and where the cash
 * goes: power; op costs (colocation rent, site and cluster operations); TopCo
 * (staffing and G&A); interest paid; debt repaid; and the cash left, the
 * model's EBITDA less its debt service, before capex. Depreciation isn't cash,
 * so it's left out. Rows are read by their labels in column B under the
 * monthly header, as write-master-summary.mjs reads them; a missing label, a
 * row whose months don't add up to its total, revenue that isn't the sum of
 * its three kinds, or revenue less those costs that isn't the month's EBITDA
 * fails the run. `--file` reads the workbook from disk instead of the room, without
 * the database.
 */
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { neon } from "@neondatabase/serverless";
import { get } from "@vercel/blob";
import { strFromU8, unzipSync } from "fflate";

const { values: args } = parseArgs({
  options: {
    room: { type: "string" },
    model: { type: "string" },
    file: { type: "string" },
    through: { type: "string", default: "2030" },
    "dry-run": { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`[ramp] ${message}`);
  process.exit(1);
};

if (!args.model) fail("--model is required (the workbook's path in the room).");
if (!args.file && !args.room) fail("--room is required, or --file to read a local copy.");
if (!/^\d{4}$/.test(args.through)) fail(`--through ${args.through}: expected a year, such as 2030.`);
const THROUGH = Number(args.through);
const modelPath = args.model.replace(/^\/+/, "");
const modelName = modelPath.split("/").pop();

let bytes;
let roomName = null;
if (args.file) {
  bytes = new Uint8Array(await readFile(args.file.replace(/^~(?=$|\/)/, process.env.HOME ?? "~")));
} else {
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set.");
  if (!process.env.BLOB_READ_WRITE_TOKEN) fail("BLOB_READ_WRITE_TOKEN is not set.");
  const sql = neon(process.env.DATABASE_URL);
  const [room] = await sql`select id, name from data_rooms where id = ${args.room}`;
  if (!room) fail(`No room ${args.room}.`);
  roomName = String(room.name);
  const folders = await sql`select id, parent_id, name from data_room_folders where room_id = ${args.room}`;
  const byId = new Map(folders.map((f) => [String(f.id), f]));
  const pathOf = (id) => {
    const parts = [];
    for (let at = id, depth = 0; at && depth < 64; depth += 1) {
      const folder = byId.get(at);
      if (!folder) break;
      parts.unshift(String(folder.name));
      at = folder.parent_id == null ? null : String(folder.parent_id);
    }
    return parts.join("/");
  };
  const files = await sql`
    select folder_id, name, blob_pathname from data_room_files
    where room_id = ${args.room} and deleted_at is null and name = ${modelName}
  `;
  const dir = modelPath.split("/").slice(0, -1).join("/");
  const file = files.find((f) => (f.folder_id == null ? "" : pathOf(String(f.folder_id))) === dir);
  if (!file) fail(`No file "${modelPath}" in "${roomName}".`);
  const blob = await get(String(file.blob_pathname), { access: "private" });
  if (!blob?.stream) fail(`Couldn't read ${file.blob_pathname} from Blob.`);
  bytes = new Uint8Array(await new Response(blob.stream).arrayBuffer());
}

const zip = unzipSync(bytes);
const part = (name) => {
  const data = zip[name];
  if (!data) fail(`${modelName}: no ${name}; is it an .xlsx workbook?`);
  return strFromU8(data);
};
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
const sheetTarget = [...part("xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/>/g)]
  .map((m) => ({ name: attr(m[1], "name"), target: rels.get(attr(m[1], "r:id")) }))
  .find((s) => s.name === "Zode Inc.")?.target;
if (!sheetTarget) fail(`${modelName}: no "Zode Inc." sheet.`);

// The sheet's cells by row, then column letter.
const rows = new Map();
for (const m of part(sheetTarget.startsWith("/") ? sheetTarget.slice(1) : `xl/${sheetTarget}`).matchAll(
  /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
)) {
  const ref = /\br="([A-Z]+)(\d+)"/.exec(m[1]);
  if (!ref) continue;
  const type = attr(m[1], "t");
  const inner = m[2] ?? "";
  const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
  let value;
  if (type === "s") value = raw === undefined ? undefined : shared[Number(raw)];
  else if (type === "inlineStr") value = texts(inner);
  else if (type === "str" || type === "e") value = raw === undefined ? undefined : decode(raw);
  else value = raw === undefined ? undefined : Number(raw);
  if (value === undefined || value === "") continue;
  const row = Number(ref[2]);
  if (!rows.has(row)) rows.set(row, new Map());
  rows.get(row).set(ref[1], value);
}
const numbers = [...rows.keys()].sort((a, b) => a - b);
const label = (r) => String(rows.get(r)?.get("B") ?? "").trim();
const cell = (r, col) => rows.get(r)?.get(col);
const rowOf = (text, from = 0) =>
  numbers.find((r) => r > from && label(r).toLowerCase().startsWith(text.toLowerCase())) ??
  fail(`${modelName}: no "${text}" row on Zode Inc.${from ? ` after row ${from}` : ""}.`);

// The monthly header: a "Total" in D, then a month's Excel date in each column after.
const header = rowOf("Month", rowOf("MONTHLY: ZODE INC. CONSOLIDATED"));
if (cell(header, "D") !== "Total") fail(`${modelName}: expected "Total" in D${header} on Zode Inc.`);
const colIndex = (col) => [...col].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const columns = [...rows.get(header).keys()].filter((col) => colIndex(col) > 4).sort((a, b) => colIndex(a) - colIndex(b));
const months = columns.map((col) => {
  const serial = cell(header, col);
  if (typeof serial !== "number") fail(`${modelName}: month heading ${col}${header} isn't a date.`);
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000).toISOString().slice(0, 7);
});
const last = months.indexOf(`${THROUGH}-12`);
if (last < 0) fail(`${modelName}: the monthly build has no Dec ${THROUGH}.`);

/** A row's monthly values, once its months are seen to add up to its total; a level, such as MW, has none. */
function series(text, { level = false } = {}) {
  const r = rowOf(text, header);
  const values = columns.map((col) => {
    const v = cell(r, col) ?? 0;
    if (typeof v !== "number" || !Number.isFinite(v)) fail(`${modelName}: "${label(r)}" ${col}${r} isn't a number.`);
    return v;
  });
  if (level) return values;
  const total = cell(r, "D");
  const sum = values.reduce((a, b) => a + b, 0);
  if (typeof total !== "number" || Math.abs(sum - total) > Math.max(1, Math.abs(total) * 1e-9)) {
    fail(`${modelName}: "${label(r)}" totals ${total}, not the sum of its months (${sum}).`);
  }
  return values;
}

const revenue = series("Total revenue");
const liveMw = series("MW of GPU clusters in service", { level: true });
const S = {
  offtake: series("Offtake"),
  merchant: series("Merchant"),
  inference: series("Inference"),
  power: series("Power"),
  rent: series("Colocation rent"),
  siteOps: series("Site operations"),
  clusterOps: series("Cluster operations"),
  staffing: series("Staffing:"),
  ga: series("G&A"),
  ebitda: series("EBITDA"),
  interest: series("Interest paid"),
  principal: series("Debt repaid"),
};
const COSTS = ["power", "rent", "siteOps", "clusterOps", "staffing", "ga"];
months.forEach((month, i) => {
  const kinds = S.offtake[i] + S.merchant[i] + S.inference[i];
  if (Math.abs(kinds - revenue[i]) > 1) fail(`${modelName}: ${month} offtake, merchant and inference add up to ${kinds}, not its revenue of ${revenue[i]}.`);
  const ebitda = COSTS.reduce((total, key) => total + S[key][i], revenue[i]);
  if (Math.abs(ebitda - S.ebitda[i]) > 1) fail(`${modelName}: ${month} revenue less its costs is ${ebitda}, not its EBITDA of ${S.ebitda[i]}.`);
});

// Costs are negative in the workbook; the ramp carries them as positive amounts.
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const quarters = [];
const monthly = [];
const yearly = [];
const add = (periods, period, i) => {
  if (periods.at(-1)?.period !== period) {
    periods.push({
      period,
      revenue: { inference: 0, merchant: 0, offtake: 0 },
      costs: { power: 0, opCosts: 0, topco: 0, interest: 0, principal: 0 },
      net: { cash: 0 },
      mwMonths: [],
    });
  }
  const p = periods.at(-1);
  p.mwMonths.push(liveMw[i]);
  p.revenue.inference += S.inference[i];
  p.revenue.merchant += S.merchant[i];
  p.revenue.offtake += S.offtake[i];
  p.costs.power -= S.power[i];
  p.costs.opCosts -= S.rent[i] + S.siteOps[i] + S.clusterOps[i];
  p.costs.topco -= S.staffing[i] + S.ga[i];
  p.costs.interest -= S.interest[i];
  p.costs.principal -= S.principal[i];
  p.net.cash += S.ebitda[i] + S.interest[i] + S.principal[i];
};
for (let i = 0; i <= last; i += 1) {
  const [year, month] = months[i].split("-").map(Number);
  add(quarters, `Q${Math.floor((month - 1) / 3) + 1} ${year}`, i);
  add(monthly, `${MONTH_NAMES[month - 1]} ${year}`, i);
  add(yearly, String(year), i);
}
for (const p of [...quarters, ...monthly, ...yearly]) {
  for (const group of [p.revenue, p.costs, p.net]) {
    for (const key of Object.keys(group)) group[key] = Math.round(group[key]) || 0;
  }
  // Critical IT live on average over the period's months, as the data room's summaries give a year's.
  p.mw = Math.round((p.mwMonths.reduce((a, b) => a + b, 0) / p.mwMonths.length) * 10) / 10 || 0;
}

const usdM = (n) => `$${(n / 1e6).toFixed(1)}M`;
for (const q of quarters) {
  const total = q.revenue.inference + q.revenue.merchant + q.revenue.offtake;
  const costs = Object.values(q.costs).reduce((a, b) => a + b, 0);
  console.log(`[ramp] ${q.period}: revenue ${usdM(total)}, costs and debt service ${usdM(costs)}, cash ${usdM(q.net.cash)}`);
}
console.log(`[ramp] ${monthly.length} months, ${monthly[0].period} to ${monthly.at(-1).period}.`);
for (const y of yearly) {
  const total = y.revenue.inference + y.revenue.merchant + y.revenue.offtake;
  console.log(`[ramp] ${y.period}: ${y.mw} MW live on average, revenue ${usdM(total)}, cash after debt service ${usdM(y.net.cash)}`);
}

const periodsOut = (periods) =>
  periods
    .map(
      (p) =>
        `    {\n      period: "${p.period}",\n      mw: ${p.mw},\n      revenue: { inference: ${p.revenue.inference}, merchant: ${p.revenue.merchant}, offtake: ${p.revenue.offtake} },\n      costs: { power: ${p.costs.power}, opCosts: ${p.costs.opCosts}, topco: ${p.costs.topco}, interest: ${p.costs.interest}, principal: ${p.costs.principal} },\n      cash: ${p.net.cash},\n    },`,
    )
    .join("\n");

const source = roomName ? `${modelPath} in ${roomName}` : modelName;
const out = `import "server-only";
import type { RampPeriod } from "./slides";

/**
 * Written by scripts/write-revenue-ramp.mjs from ${source}:
 * the consolidated monthly P&L and cash flow on its Zode Inc. tab, by quarter, month and year to Dec ${THROUGH}.
 * Whole USD; costs and debt service are positive. Rerun the script with each new model.
 */
export const REVENUE_RAMP: {
  readonly model: string;
  readonly quarters: readonly RampPeriod[];
  readonly months: readonly RampPeriod[];
  readonly years: readonly RampPeriod[];
} = {
  model: ${JSON.stringify(modelName)},
  quarters: [
${periodsOut(quarters)}
  ],
  months: [
${periodsOut(monthly)}
  ],
  years: [
${periodsOut(yearly)}
  ],
};
`;

if (args["dry-run"]) {
  console.log("[ramp] dry run: nothing written.");
  process.exit(0);
}
const target = new URL("../src/features/deck/revenueRamp.ts", import.meta.url);
await writeFile(target, out);
console.log(`[ramp] wrote ${quarters.length} quarters, ${monthly.length} months and ${yearly.length} years from ${source} to src/features/deck/revenueRamp.ts.`);
