/**
 * Writes a data room's diligence summary, the room's landing page, from a
 * JSON file of findings:
 *
 *   node --env-file=.env.production.local scripts/write-room-summary.mjs \
 *     --room <room id> --file ~/Downloads/olds-vdr-work/summary.json [--as n3o@zero.tech] [--dry-run]
 *
 * The file holds `diligence` (headline, detail, status and sources for each
 * question in src/features/data-room/summary.ts) and `economics`, whose shape
 * follows the room's kind:
 *
 * - purchase: purchase price, conversion cost, critical IT MW and the FX rate;
 * - lease or colo: rent terms (USD base rent, escalation, NNN, operations fee,
 *   power rate and PUE), the capital contribution, critical IT MW and the FX rate.
 *
 * A purchase under terms swaps `criticalItMw` for a `deal`, which the summary
 * shows as its Deal section and the model runs from closing:
 *
 *   "deal": {
 *     "facilityPower": { "mw": 8, "pue": 1.3, "estimate": true, "note": "...", "sources": [] },
 *     "contract": { "pricePerGpuHour": 4.8, "months": 48, "estimate": true, "note": "...", "sources": [] },
 *     "deposit": { "amount": 500000, "currency": "CAD", "estimate": false, "note": "...", "sources": [] },
 *     "conditionDate": "2026-10-30",
 *     "closingDate": "2026-11-30",
 *     "conversionMonths": 8,
 *     "financing": { "ltv": 0.5, "rate": 0.075, "amortizationYears": 25, "reserveMonths": 6,
 *                    "estimate": true, "note": "...", "sources": [] }
 *   }
 *
 * Critical IT is then facility power over PUE; `contract` is optional and
 * falls back to the model's standard GPU contract. `conversionCost.perMw: true`
 * prices conversion per MW of critical IT instead of as a total.
 *
 * Details and notes may use blank lines between paragraphs, "- " lines for a
 * list and **bold** for a lead-in.
 *
 * Sources are paths inside the room, such as "05 Power and Electrical/04 .../file.pdf";
 * each must name one live file, and is stored with that file's id so later
 * renames and moves keep the link.
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { neon } from "@neondatabase/serverless";

const KEYS = ["location", "power", "powerNow", "powerScaling", "zoning", "fiber", "moratorium", "conversion"];
const STATUSES = ["confirmed", "claimed", "gap", "risk"];
const RENT_NUMBERS = ["baseLease", "leaseEscalation", "nnn", "operations", "electricityRate", "pue"];

const { values: args } = parseArgs({
  options: {
    room: { type: "string" },
    file: { type: "string" },
    as: { type: "string", default: "n3o@zero.tech" },
    "dry-run": { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`[summary] ${message}`);
  process.exit(1);
};

if (!args.room) fail("--room is required.");
if (!args.file) fail("--file is required.");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set.");

const sql = neon(databaseUrl);
const [room] = await sql`select id, name, kind from data_rooms where id = ${args.room}`;
if (!room) fail(`No room ${args.room}.`);
const lease = room.kind !== "purchase";

const input = JSON.parse(await readFile(args.file.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"), "utf8"));
const problems = [];
const text = (value, where) => {
  if (typeof value !== "string" || !value.trim()) problems.push(`${where}: expected text`);
};
const number = (value, where, nullable = false) => {
  if (!(nullable && value === null) && !(typeof value === "number" && Number.isFinite(value))) {
    problems.push(`${where}: expected a number${nullable ? " or null" : ""}`);
  }
};
const flag = (value, where) => {
  if (typeof value !== "boolean") problems.push(`${where}: expected true or false`);
};
const paths = (value, where) => {
  if (!Array.isArray(value) || value.some((p) => typeof p !== "string")) problems.push(`${where}: expected a list of paths`);
};

const extra = Object.keys(input.diligence ?? {}).filter((key) => !KEYS.includes(key));
if (extra.length) problems.push(`diligence: unknown ${extra.join(", ")}`);
for (const key of KEYS) {
  const item = input.diligence?.[key];
  if (!item) {
    problems.push(`diligence.${key}: missing`);
    continue;
  }
  text(item.headline, `diligence.${key}.headline`);
  text(item.detail, `diligence.${key}.detail`);
  if (!STATUSES.includes(item.status)) problems.push(`diligence.${key}.status: one of ${STATUSES.join(", ")}`);
  paths(item.sources, `diligence.${key}.sources`);
}

const e = input.economics ?? {};
const deal = !lease && e.deal !== undefined;
const MONEY_KEYS = lease ? ["capitalContribution"] : ["purchasePrice", "conversionCost"];
const ALLOWED = [...MONEY_KEYS, deal ? "deal" : "criticalItMw", "fx", ...(lease ? ["rent"] : ["siteResidual"])];
const unknown = Object.keys(e).filter((key) => !ALLOWED.includes(key));
if (unknown.length) problems.push(`economics: unknown for a ${room.kind} room${deal ? " with a deal" : ""}: ${unknown.join(", ")}`);
const money = (value, where) => {
  const m = value ?? {};
  number(m.amount, `${where}.amount`, true);
  if (!["USD", e.fx?.currency].includes(m.currency)) problems.push(`${where}.currency: USD or the fx currency`);
  flag(m.estimate, `${where}.estimate`);
  text(m.note, `${where}.note`);
  paths(m.sources, `${where}.sources`);
};
for (const key of MONEY_KEYS) money(e[key], `economics.${key}`);
if (!lease && e.conversionCost?.perMw !== undefined) flag(e.conversionCost.perMw, "economics.conversionCost.perMw");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = (value, where) => {
  if (!DATE.test(value ?? "") || Number.isNaN(Date.parse(value))) problems.push(`${where}: expected YYYY-MM-DD`);
};
const between = (value, min, max, where) => {
  number(value, where);
  if (typeof value === "number" && (value < min || value > max)) problems.push(`${where}: expected ${min} to ${max}`);
};
if (deal) {
  const d = e.deal ?? {};
  const DEAL_KEYS = ["facilityPower", "contract", "deposit", "conditionDate", "closingDate", "conversionMonths", "financing"];
  const extraDeal = Object.keys(d).filter((key) => !DEAL_KEYS.includes(key));
  if (extraDeal.length) problems.push(`economics.deal: unknown ${extraDeal.join(", ")}`);
  const power = d.facilityPower ?? {};
  between(power.mw, 0.1, 1000, "economics.deal.facilityPower.mw");
  between(power.pue, 1, 2, "economics.deal.facilityPower.pue");
  flag(power.estimate, "economics.deal.facilityPower.estimate");
  text(power.note, "economics.deal.facilityPower.note");
  paths(power.sources, "economics.deal.facilityPower.sources");
  if (d.contract !== undefined) {
    const c = d.contract ?? {};
    between(c.pricePerGpuHour, 0.5, 20, "economics.deal.contract.pricePerGpuHour");
    between(c.months, 6, 72, "economics.deal.contract.months");
    if (!Number.isInteger(c.months)) problems.push("economics.deal.contract.months: whole months");
    flag(c.estimate, "economics.deal.contract.estimate");
    text(c.note, "economics.deal.contract.note");
    paths(c.sources, "economics.deal.contract.sources");
  }
  money(d.deposit, "economics.deal.deposit");
  date(d.conditionDate, "economics.deal.conditionDate");
  date(d.closingDate, "economics.deal.closingDate");
  if (DATE.test(d.conditionDate ?? "") && DATE.test(d.closingDate ?? "") && d.closingDate < d.conditionDate) {
    problems.push("economics.deal.closingDate: on or after the condition date");
  }
  // The model forecasts 85 months, so six years of operation must follow conversion.
  between(d.conversionMonths, 0, 12, "economics.deal.conversionMonths");
  if (!Number.isInteger(d.conversionMonths)) problems.push("economics.deal.conversionMonths: whole months");
  const f = d.financing ?? {};
  between(f.ltv, 0, 0.9, "economics.deal.financing.ltv");
  between(f.rate, 0, 0.3, "economics.deal.financing.rate");
  between(f.amortizationYears, 1, 40, "economics.deal.financing.amortizationYears");
  between(f.reserveMonths, 0, 24, "economics.deal.financing.reserveMonths");
  flag(f.estimate, "economics.deal.financing.estimate");
  text(f.note, "economics.deal.financing.note");
  paths(f.sources, "economics.deal.financing.sources");
}
if (lease) {
  const rent = e.rent ?? {};
  for (const key of RENT_NUMBERS) number(rent[key], `economics.rent.${key}`);
  flag(rent.estimate, "economics.rent.estimate");
  text(rent.note, "economics.rent.note");
  paths(rent.sources, "economics.rent.sources");
}
if (!deal) {
  number(e.criticalItMw?.value, "economics.criticalItMw.value");
  flag(e.criticalItMw?.estimate, "economics.criticalItMw.estimate");
  text(e.criticalItMw?.note, "economics.criticalItMw.note");
  paths(e.criticalItMw?.sources, "economics.criticalItMw.sources");
}
text(e.fx?.currency, "economics.fx.currency");
number(e.fx?.usdPerUnit, "economics.fx.usdPerUnit");
if (!DATE.test(e.fx?.asOf ?? "")) problems.push("economics.fx.asOf: expected YYYY-MM-DD");
text(e.fx?.source, "economics.fx.source");
if (!lease && e.siteResidual !== undefined) number(e.siteResidual, "economics.siteResidual");

if (problems.length) {
  for (const problem of problems) console.error(`  ${problem}`);
  fail(`${problems.length} problem(s) in ${args.file} for a ${room.kind} room.`);
}

// Every live file by its path inside the room.
const [folders, files] = await Promise.all([
  sql`select id, parent_id, name from data_room_folders where room_id = ${args.room}`,
  sql`select id, folder_id, name from data_room_files where room_id = ${args.room} and deleted_at is null`,
]);
const folderById = new Map(folders.map((f) => [String(f.id), f]));
const folderPath = (id) => {
  const parts = [];
  for (let at = id, depth = 0; at && depth < 64; depth += 1) {
    const folder = folderById.get(at);
    if (!folder) break;
    parts.unshift(String(folder.name));
    at = folder.parent_id == null ? null : String(folder.parent_id);
  }
  return parts.join("/");
};
const fileByPath = new Map();
for (const file of files) {
  const dir = file.folder_id == null ? "" : folderPath(String(file.folder_id));
  fileByPath.set(dir ? `${dir}/${file.name}` : String(file.name), String(file.id));
}

const unresolved = [];
const resolve = (list, where) =>
  list.map((p) => {
    const fileId = fileByPath.get(p.replace(/^\/+/, ""));
    if (!fileId) unresolved.push(`${where}: ${p}`);
    return { path: p, fileId };
  });

const diligence = Object.fromEntries(
  KEYS.map((key) => {
    const { headline, detail, status, sources } = input.diligence[key];
    return [key, { headline: headline.trim(), detail: detail.trim(), status, sources: resolve(sources, `diligence.${key}`) }];
  }),
);
const withSources = (key) => ({ ...e[key], sources: resolve(e[key].sources, `economics.${key}`) });
const dealWithSources = () => {
  const d = e.deal;
  const part = (key) => ({ ...d[key], sources: resolve(d[key].sources, `economics.deal.${key}`) });
  return {
    facilityPower: part("facilityPower"),
    ...(d.contract === undefined ? {} : { contract: part("contract") }),
    deposit: part("deposit"),
    conditionDate: d.conditionDate,
    closingDate: d.closingDate,
    conversionMonths: d.conversionMonths,
    financing: part("financing"),
  };
};
const economics = {
  ...Object.fromEntries(MONEY_KEYS.map((key) => [key, withSources(key)])),
  ...(lease ? { rent: withSources("rent") } : {}),
  ...(deal ? { deal: dealWithSources() } : { criticalItMw: withSources("criticalItMw") }),
  fx: e.fx,
  ...(lease || e.siteResidual === undefined ? {} : { siteResidual: e.siteResidual }),
};
const cited = (x) => x.sources.map((s) => s.fileId);

if (unresolved.length) {
  for (const line of unresolved) console.error(`  not in the room: ${line}`);
  fail(`${unresolved.length} source(s) don't name a live file in "${room.name}".`);
}

const citing = [
  ...Object.values(diligence),
  ...[...MONEY_KEYS, ...(lease ? ["rent"] : []), ...(deal ? [] : ["criticalItMw"])].map((key) => economics[key]),
  ...(deal
    ? [economics.deal.facilityPower, economics.deal.contract, economics.deal.deposit, economics.deal.financing].filter(Boolean)
    : []),
];
const citedFiles = new Set(citing.flatMap(cited)).size;
console.log(
  `[summary] "${room.name}" (${room.kind}): ${KEYS.length} answers${deal ? ", deal terms" : ""}, ${citedFiles} cited files, all resolved.`,
);

if (args["dry-run"]) {
  console.log("[summary] dry run: nothing written.");
  process.exit(0);
}

await sql`
  insert into data_room_summaries (room_id, diligence, economics, updated_by_email)
  values (${args.room}, ${JSON.stringify(diligence)}::jsonb, ${JSON.stringify(economics)}::jsonb, ${args.as.trim().toLowerCase()})
  on conflict (room_id) do update
    set diligence = excluded.diligence, economics = excluded.economics,
        updated_at = now(), updated_by_email = excluded.updated_by_email
`;
console.log(`[summary] wrote the summary for "${room.name}" to ${new URL(databaseUrl).hostname}.`);
