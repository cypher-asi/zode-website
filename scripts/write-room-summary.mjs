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
const MONEY_KEYS = lease ? ["capitalContribution"] : ["purchasePrice", "conversionCost"];
const ALLOWED = [...MONEY_KEYS, "criticalItMw", "fx", ...(lease ? ["rent"] : ["siteResidual"])];
const unknown = Object.keys(e).filter((key) => !ALLOWED.includes(key));
if (unknown.length) problems.push(`economics: unknown for a ${room.kind} room: ${unknown.join(", ")}`);
for (const key of MONEY_KEYS) {
  const money = e[key] ?? {};
  number(money.amount, `economics.${key}.amount`, true);
  if (!["USD", e.fx?.currency].includes(money.currency)) problems.push(`economics.${key}.currency: USD or the fx currency`);
  flag(money.estimate, `economics.${key}.estimate`);
  text(money.note, `economics.${key}.note`);
  paths(money.sources, `economics.${key}.sources`);
}
if (lease) {
  const rent = e.rent ?? {};
  for (const key of RENT_NUMBERS) number(rent[key], `economics.rent.${key}`);
  flag(rent.estimate, "economics.rent.estimate");
  text(rent.note, "economics.rent.note");
  paths(rent.sources, "economics.rent.sources");
}
number(e.criticalItMw?.value, "economics.criticalItMw.value");
flag(e.criticalItMw?.estimate, "economics.criticalItMw.estimate");
text(e.criticalItMw?.note, "economics.criticalItMw.note");
paths(e.criticalItMw?.sources, "economics.criticalItMw.sources");
text(e.fx?.currency, "economics.fx.currency");
number(e.fx?.usdPerUnit, "economics.fx.usdPerUnit");
if (!/^\d{4}-\d{2}-\d{2}$/.test(e.fx?.asOf ?? "")) problems.push("economics.fx.asOf: expected YYYY-MM-DD");
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
const economics = {
  ...Object.fromEntries(MONEY_KEYS.map((key) => [key, withSources(key)])),
  ...(lease ? { rent: withSources("rent") } : {}),
  criticalItMw: withSources("criticalItMw"),
  fx: e.fx,
  ...(lease || e.siteResidual === undefined ? {} : { siteResidual: e.siteResidual }),
};

if (unresolved.length) {
  for (const line of unresolved) console.error(`  not in the room: ${line}`);
  fail(`${unresolved.length} source(s) don't name a live file in "${room.name}".`);
}

const cited = new Set(
  [...Object.values(diligence), ...[...MONEY_KEYS, ...(lease ? ["rent"] : []), "criticalItMw"].map((key) => economics[key])].flatMap(
    (x) => x.sources.map((s) => s.fileId),
  ),
).size;
console.log(`[summary] "${room.name}" (${room.kind}): ${KEYS.length} answers, ${cited} cited files, all resolved.`);

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
