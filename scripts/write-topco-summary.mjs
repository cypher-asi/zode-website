/**
 * Writes a company room's summary, at the top of the room, from the TopCo
 * workbook in it:
 *
 *   node --env-file=.env.production.local scripts/write-topco-summary.mjs \
 *     --room <room id> --model "01 PRE-SEED/ZODE_TopCo_Model_26.11.09.xlsx" \
 *     --project "Retro 1 site=02 PROJECT DEAL" --project "Retro 1 compute=02 PROJECT DEAL" \
 *     --project "Toronto=02 ZODE TORONTO" --project "BigWatt=04 ZODE BIG WATT" \
 *     [--as n3o@zero.tech] [--out topco.json] [--dry-run]
 *
 * The workbook is a ZODE TopCo model: Summary, TopCo, then one tab per project
 * SPV. Its cached values are read by their row labels in column B, so rows can
 * move between versions; a label that's missing fails the run rather than
 * writing a gap. `--project <column>=<folder path>` names the Summary tab's
 * SPV column a project folder holds, so the summary links to it and to the
 * project's own summary there (scripts/write-portfolio-summary.mjs --folder).
 * `--out` also saves what was read from the workbook, to check it by eye.
 */
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { neon } from "@neondatabase/serverless";
import { get } from "@vercel/blob";
import { strFromU8, unzipSync } from "fflate";

const { values: args } = parseArgs({
  options: {
    room: { type: "string" },
    model: { type: "string" },
    project: { type: "string", multiple: true, default: [] },
    as: { type: "string", default: "n3o@zero.tech" },
    out: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`[topco] ${message}`);
  process.exit(1);
};

if (!args.room) fail("--room is required.");
if (!args.model) fail("--model is required (the workbook's path in the room).");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set.");
if (!process.env.BLOB_READ_WRITE_TOKEN) fail("BLOB_READ_WRITE_TOKEN is not set.");

const projectArgs = args.project.map((arg) => {
  const match = /^([^=]+)=(.+)$/.exec(arg);
  if (!match) fail(`--project "${arg}": expected <column>=<folder path>.`);
  return { column: match[1].trim(), folderPath: match[2].trim().replace(/^\/+|\/+$/g, "") };
});

const sql = neon(databaseUrl);
const [room] = await sql`select id, name from data_rooms where id = ${args.room}`;
if (!room) fail(`No room ${args.room}.`);

// Every live folder and file in the room by its path.
const [folders, files] = await Promise.all([
  sql`select id, parent_id, name from data_room_folders where room_id = ${args.room}`,
  sql`select id, folder_id, name, blob_pathname from data_room_files where room_id = ${args.room} and deleted_at is null`,
]);
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
const folderByPath = new Map(folders.map((f) => [pathOf(String(f.id)), String(f.id)]));
const fileByPath = new Map(
  files.map((f) => {
    const dir = f.folder_id == null ? "" : pathOf(String(f.folder_id));
    return [dir ? `${dir}/${f.name}` : String(f.name), { id: String(f.id), name: String(f.name), blob: String(f.blob_pathname) }];
  }),
);

const modelPath = args.model.replace(/^\/+/, "");
const modelFile = fileByPath.get(modelPath);
if (!modelFile) fail(`No file "${modelPath}" in "${room.name}".`);
for (const p of projectArgs) if (!folderByPath.has(p.folderPath)) fail(`--project ${p.column}: no folder "${p.folderPath}" in "${room.name}".`);

// The workbook's cached values, by sheet and cell.
const blob = await get(modelFile.blob, { access: "private" });
if (!blob?.stream) fail(`Couldn't read ${modelFile.blob} from Blob.`);
const zip = unzipSync(new Uint8Array(await new Response(blob.stream).arrayBuffer()));
const part = (name) => {
  const bytes = zip[name];
  if (!bytes) fail(`${modelFile.name}: no ${name}; is it an .xlsx workbook?`);
  return strFromU8(bytes);
};

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (text) =>
  text
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, e) =>
      e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e] ?? match),
    )
    .replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
const texts = (xml) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");

const shared = zip["xl/sharedStrings.xml"]
  ? [...part("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]))
  : [];
const rels = new Map(
  [...part("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [
    /\bId="([^"]+)"/.exec(m[1])?.[1],
    /\bTarget="([^"]+)"/.exec(m[1])?.[1],
  ]),
);
const sheetPaths = new Map(
  [...part("xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/>/g)].map((m) => {
    const name = decode(/\bname="([^"]*)"/.exec(m[1])[1]);
    const target = rels.get(/\br:id="([^"]+)"/.exec(m[1])[1]);
    return [name, target.startsWith("/") ? target.slice(1) : `xl/${target}`];
  }),
);

/** A sheet's cells, as rows of values by column letter. */
function readSheet(name) {
  const path = sheetPaths.get(name);
  if (!path) fail(`${modelFile.name}: no "${name}" sheet.`);
  const rows = new Map();
  for (const m of part(path).matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = /\br="([A-Z]+)(\d+)"/.exec(m[1]);
    if (!ref) continue;
    const type = /\bt="([^"]+)"/.exec(m[1])?.[1];
    const inner = m[2] ?? "";
    const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
    let value;
    if (type === "s") value = raw === undefined ? undefined : shared[Number(raw)];
    else if (type === "inlineStr") value = texts(inner);
    else if (type === "str" || type === "e") value = raw === undefined ? undefined : decode(raw);
    else if (type === "b") value = raw === "1";
    else value = raw === undefined ? undefined : Number(raw);
    if (value === undefined || value === "") continue;
    const row = Number(ref[2]);
    if (!rows.has(row)) rows.set(row, new Map());
    rows.get(row).set(ref[1], value);
  }
  const numbers = [...rows.keys()].sort((a, b) => a - b);
  const label = (r) => String(rows.get(r)?.get("B") ?? "").trim();

  /** The first row after `from` (a row number or the label of one) whose label starts with `text`. */
  const rowOf = (text, from = 0) => {
    const start = typeof from === "number" ? from : rowOf(from);
    const found = numbers.find((r) => r > start && label(r).toLowerCase().startsWith(text.toLowerCase()));
    if (found === undefined) fail(`${modelFile.name}: no "${text}" row on ${name}${start ? ` after row ${start}` : ""}.`);
    return found;
  };
  const cell = (r, col) => rows.get(r)?.get(col);
  /** Rows strictly between two, with their labels. */
  const between = (from, to = Infinity) => numbers.filter((r) => r > from && r < to && label(r));
  /** The next row after `r` with any cell, labelled or not. */
  const next = (r) => numbers.find((n) => n > r);
  /** Column letters with a value in row `r`, in order. */
  const columnsOf = (r) => [...(rows.get(r)?.keys() ?? [])].sort((a, b) => a.length - b.length || a.localeCompare(b));
  return { rowOf, cell, label, between, next, columnsOf };
}

const summary = readSheet("Summary");
const topco = readSheet("TopCo");
const readme = readSheet("Readme");

const num = (value, where) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  fail(`${modelFile.name}: ${where} isn't a number (${JSON.stringify(value)}).`);
};
/** A number, or null where the workbook reads "n/a" or leaves the cell blank. */
const maybe = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const text = (value) => (value == null ? "" : String(value).trim());
const firstSentence = (value) => text(value).split(/(?<=\.)\s/)[0] ?? text(value);

// The raise and where it goes.
const at = (sheet, label, col = "D") => num(sheet.cell(sheet.rowOf(label), col), `${label} (${col})`);
const raise = {
  amount: at(summary, "Pre-seed raise"),
  preMoney: at(summary, "Pre-money valuation"),
  postMoney: at(summary, "Post-money valuation"),
  ownership: at(summary, "Pre-seed ownership"),
  closeYear: at(topco, "Raise closes"),
  minCash: at(topco, "Minimum TopCo cash"),
};
const uses = topco.between(topco.rowOf("USE OF PROCEEDS"), topco.rowOf("Total SPV commitments")).map((r) => ({
  label: topco.label(r).replace(/^Pref equity into /, "Preferred equity, "),
  amount: num(topco.cell(r, "D"), `use of proceeds row ${r}`),
  note: text(topco.cell(r, "E")),
}));
const usesTotal = uses.reduce((total, u) => total + u.amount, 0);
if (Math.abs(usesTotal - raise.amount) > 1) fail(`${modelFile.name}: uses (${usesTotal}) don't add up to the raise (${raise.amount}).`);

// The SPV columns, from the header under SPVS; the last reads Total.
const header = summary.next(summary.rowOf("SPVS"));
const headerColumns = summary.columnsOf(header).filter((col) => col !== "B");
const columns = headerColumns.map((col) => ({ col, name: text(summary.cell(header, col)) }));
if (columns.at(-1)?.name !== "Total") fail(`${modelFile.name}: expected the SPV table's last column to read Total.`);
const spvColumns = columns.slice(0, -1);
const totalCol = columns.at(-1).col;
for (const p of projectArgs) {
  if (!spvColumns.some((c) => c.name === p.column)) fail(`--project ${p.column}: the workbook's SPVs are ${spvColumns.map((c) => c.name).join(", ")}.`);
}

const spvRow = (label) => summary.rowOf(label, header);
const rowsOf = {
  structure: spvRow("Structure"),
  criticalItMw: spvRow("Critical IT at full build"),
  projectCost: spvRow("Total project cost"),
  debt: spvRow("Debt drawn"),
  prefNeeded: spvRow("Pref equity needed"),
  topcoPref: spvRow("of which ZODE TopCo"),
  thirdPartyPref: spvRow("of which third-party"),
  projectIrr: spvRow("Project IRR"),
  prefIrr: spvRow("Pref investor IRR"),
  prefMultiple: spvRow("Pref investor multiple"),
  cashToTopco: spvRow("Cash to ZODE TopCo"),
  topcoIrr: spvRow("ZODE TopCo all-in IRR"),
  topcoMultiple: spvRow("ZODE TopCo all-in multiple"),
};
const amount = (key, col) => num(summary.cell(rowsOf[key], col), `${summary.label(rowsOf[key])} (${col})`);
const projects = spvColumns.map(({ col, name }) => {
  const folderPath = projectArgs.find((p) => p.column === name)?.folderPath ?? null;
  return {
    name,
    structure: text(summary.cell(rowsOf.structure, col)),
    folderId: folderPath ? folderByPath.get(folderPath) : null,
    folderPath,
    criticalItMw: amount("criticalItMw", col),
    projectCost: amount("projectCost", col),
    debt: amount("debt", col),
    prefNeeded: amount("prefNeeded", col),
    topcoPref: amount("topcoPref", col),
    thirdPartyPref: amount("thirdPartyPref", col),
    projectIrr: maybe(summary.cell(rowsOf.projectIrr, col)),
    prefIrr: maybe(summary.cell(rowsOf.prefIrr, col)),
    prefMultiple: maybe(summary.cell(rowsOf.prefMultiple, col)),
    cashToTopco: amount("cashToTopco", col),
    topcoIrr: maybe(summary.cell(rowsOf.topcoIrr, col)),
    topcoMultiple: maybe(summary.cell(rowsOf.topcoMultiple, col)),
  };
});
const total = Object.fromEntries(
  ["criticalItMw", "projectCost", "debt", "prefNeeded", "topcoPref", "thirdPartyPref", "cashToTopco"].map((key) => [key, amount(key, totalCol)]),
);
const committed = uses.filter((u) => /^Preferred equity/.test(u.label)).reduce((sum, u) => sum + u.amount, 0);
if (Math.abs(total.topcoPref - committed) > 1) fail(`${modelFile.name}: TopCo pref across the SPVs (${total.topcoPref}) isn't the ${committed} committed.`);

// TopCo's cash, year by year: the $M rows under the Year header.
const yearRow = summary.between(summary.rowOf("TOPCO")).find((r) => summary.label(r) === "Year");
if (!yearRow) fail(`${modelFile.name}: no "Year" header under TOPCO on Summary.`);
const yearCols = summary.columnsOf(yearRow).filter((col) => typeof summary.cell(yearRow, col) === "number");
const totalCashCol = summary.columnsOf(yearRow).find((col) => text(summary.cell(yearRow, col)) === "Total");
const years = yearCols.map((col) => summary.cell(yearRow, col));
const cashRows = summary
  .between(yearRow)
  .filter((r) => text(summary.cell(r, "C")) === "$M")
  .map((r) => ({
    label: summary.label(r),
    total: totalCashCol ? maybe(summary.cell(r, totalCashCol)) : null,
    values: yearCols.map((col) => maybe(summary.cell(r, col)) ?? 0),
  }))
  .filter((r) => (r.total ?? 0) !== 0 || r.values.some((v) => v !== 0));
if (!cashRows.length) fail(`${modelFile.name}: no $M rows under the Summary tab's Year header.`);

const team = topco.between(topco.rowOf("Role"), topco.rowOf("Market-rate")).map((r) => ({
  role: topco.label(r),
  headcount: num(topco.cell(r, "D"), `team row ${r} headcount`),
  salary: num(topco.cell(r, "E"), `team row ${r} salary`),
  startYear: num(topco.cell(r, "F"), `team row ${r} start`),
}));

// Paragraphs apart, each "- " line kept under the one before it.
const overview = readme
  .between(readme.rowOf("What it shows"), readme.rowOf("Tabs"))
  .map((r) => readme.label(r))
  .reduce((joined, line) => (joined ? `${joined}${line.startsWith("- ") ? "\n" : "\n\n"}${line}` : line), "");
const simplifications = readme.between(readme.rowOf("Key simplifications")).map((r) => readme.label(r).replace(/^\d+\.\s*/, ""));

const topcoModel = {
  model: {
    name: modelFile.name,
    fileId: modelFile.id,
    path: modelPath,
    title: summary.label(summary.rowOf("ZODE")).replace(/\s*-\s*summary$/i, ""),
    prepared: firstSentence(readme.label(readme.rowOf("Prepared"))),
  },
  raise,
  uses,
  projects,
  total,
  returns: {
    preSeedIrr: maybe(summary.cell(summary.rowOf("Pre-seed IRR"), "D")),
    preSeedMultiple: maybe(summary.cell(summary.rowOf("Pre-seed multiple"), "D")),
    lowestCash: at(summary, "Lowest TopCo cash"),
    budgetYears: at(summary, "Years of TopCo costs covered"),
    through: years.at(-1),
  },
  cash: { years, rows: cashRows },
  team,
  overview,
  notes: [summary.label(summary.rowOf("Revenue cases")), ...simplifications],
};

console.log(
  `[topco] "${room.name}" from ${modelFile.name}: $${raise.amount / 1e6}M raise at $${raise.preMoney / 1e6}M pre-money; ` +
    projects.map((p) => `${p.name} $${p.topcoPref / 1e6}M${p.folderPath ? ` (${p.folderPath})` : ""}`).join(", ") +
    `; ${cashRows.length} cash rows, ${years[0]}-${years.at(-1)}.`,
);
if (args.out) {
  await writeFile(args.out.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"), `${JSON.stringify(topcoModel, null, 2)}\n`);
  console.log(`[topco] saved what the workbook gave to ${args.out}.`);
}

if (args["dry-run"]) {
  console.log("[topco] dry run: nothing written.");
  process.exit(0);
}

const by = args.as.trim().toLowerCase();
await sql`
  insert into data_room_summaries (room_id, folder_id, layout, kind, diligence, economics, updated_by_email)
  values (${args.room}, null, 'topco', null, '{}'::jsonb, ${JSON.stringify(topcoModel)}::jsonb, ${by})
  on conflict (room_id, folder_id) do update
    set layout = excluded.layout, kind = excluded.kind, diligence = excluded.diligence, economics = excluded.economics,
        updated_at = now(), updated_by_email = excluded.updated_by_email
`;
console.log(`[topco] wrote the summary of "${room.name}" to ${new URL(databaseUrl).hostname}.`);
