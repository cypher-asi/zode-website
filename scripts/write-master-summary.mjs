/**
 * Writes a room's summaries from ZODE's master model in it: the company's at
 * the top of the room, a deployment summary in each project's folder, and each
 * owned site's own figures into the diligence summary already in its folder:
 *
 *   node --env-file=.env.production.local scripts/write-master-summary.mjs \
 *     --room <room id> --model "02 MODEL/ZODE_MasterModel_26.11.09.xlsx" \
 *     --deployment "Toronto=03 ZODE TORONTO" \
 *     --deployment "Calgary=04 ZODE CALGARY" \
 *     --deployment "BigWatt=05 ZODE BIG WATT" \
 *     --site "Olds=04 ZODE CALGARY/01 Olds - 6102-6402 48 Avenue" \
 *     --site "Calgary=04 ZODE CALGARY/02 Calgary - 5430 30 Street SE" \
 *     [--as n3o@zero.tech] [--out master.json] [--dry-run] [--file <local .xlsx>]
 *
 * The workbook is a ZODE master model: Summary, Structure, Zode Inc., one tab
 * per project SPV and Notes. Its cached values are read by their row labels in
 * column B, so rows can move between versions; a label that's missing fails
 * the run rather than writing a gap. Each value keeps the number format of its
 * cell, so the summaries show it as the workbook does.
 *
 * `--deployment <tab>=<folder path>` puts an SPV tab's summary in its project
 * folder. `--site <site>=<folder path>` names an owned site, as the Capacity
 * table on its SPV's tab gives it, and the folder whose diligence summary
 * (scripts/write-room-summary.mjs) takes its figures. The room's summaries
 * from the older per-project workbooks (TopCo, portfolio, colo) are replaced.
 * `--file` reads the workbook from disk instead of the room, for a dry run
 * before it's uploaded.
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
    deployment: { type: "string", multiple: true, default: [] },
    site: { type: "string", multiple: true, default: [] },
    file: { type: "string" },
    as: { type: "string", default: "n3o@zero.tech" },
    out: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`[master] ${message}`);
  process.exit(1);
};

if (!args.room) fail("--room is required.");
if (!args.model) fail("--model is required (the workbook's path in the room).");
if (args.file && !args["dry-run"]) fail("--file is for a dry run; upload the workbook to the room to write from it.");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set.");
if (!args.file && !process.env.BLOB_READ_WRITE_TOKEN) fail("BLOB_READ_WRITE_TOKEN is not set.");

const pairs = (flag, list) =>
  list.map((arg) => {
    const match = /^([^=]+)=(.+)$/.exec(arg);
    if (!match) fail(`--${flag} "${arg}": expected <name>=<folder path>.`);
    return { name: match[1].trim(), folderPath: match[2].trim().replace(/^\/+|\/+$/g, "") };
  });
const deploymentArgs = pairs("deployment", args.deployment);
const siteArgs = pairs("site", args.site);
if (!deploymentArgs.length) fail("--deployment is required, once per project folder.");

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
const folderOf = (flag, p) => folderByPath.get(p.folderPath) ?? fail(`--${flag} ${p.name}: no folder "${p.folderPath}" in "${room.name}".`);

const modelPath = args.model.replace(/^\/+/, "");
const modelFile = fileByPath.get(modelPath) ?? (args.file ? null : fail(`No file "${modelPath}" in "${room.name}".`));
const modelName = modelFile?.name ?? modelPath.split("/").pop();

let bytes;
if (args.file) {
  bytes = new Uint8Array(await readFile(args.file.replace(/^~(?=$|\/)/, process.env.HOME ?? "~")));
} else {
  const blob = await get(modelFile.blob, { access: "private" });
  if (!blob?.stream) fail(`Couldn't read ${modelFile.blob} from Blob.`);
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
  text
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, e) =>
      e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e] ?? match),
    )
    .replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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
const sheetPaths = new Map(
  [...part("xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/>/g)].map((m) => {
    const target = rels.get(attr(m[1], "r:id"));
    return [attr(m[1], "name"), target.startsWith("/") ? target.slice(1) : `xl/${target}`];
  }),
);

// Each cell style's number format code, by style index.
const styles = zip["xl/styles.xml"] ? part("xl/styles.xml") : "";
const formatCodes = new Map(
  [...styles.matchAll(/<numFmt\b([^>]*)\/?>/g)].map((m) => [Number(attr(m[1], "numFmtId")), attr(m[1], "formatCode") ?? ""]),
);
const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";
const styleFormats = [...cellXfs.matchAll(/<xf\b([^>]*?)\/?>/g)].map((m) => Number(attr(m[1], "numFmtId") ?? 0));

/** A number format as the summaries show it, with the literal of one that prints text in place of a number. */
function formatOf(style) {
  const id = styleFormats[style ?? 0] ?? 0;
  if (id === 9 || id === 10) return { format: "pct" };
  if (id >= 14 && id <= 22) return { format: "month" };
  const code = (formatCodes.get(id) ?? "General").split(";")[0];
  if (/\\x$|"x"$/.test(code)) return { format: "x" };
  const bare = code.replace(/"[^"]*"/g, "").replace(/\\./g, "");
  if (bare.includes("%")) return { format: "pct" };
  if (/[dmy]/i.test(bare) && !/general/i.test(bare)) return { format: "month" };
  if (!/[0#]/.test(bare) && !/general/i.test(bare)) {
    const literal = /"([^"]*)"/.exec(code)?.[1] ?? "";
    return { format: "text", literal: literal.charAt(0).toUpperCase() + literal.slice(1) };
  }
  if (code.includes("$")) return { format: /\.00/.test(code) ? "usdCents" : "usd" };
  if (/\.00/.test(code)) return { format: "decimal" };
  return { format: "number" };
}

/** An Excel date serial as YYYY-MM-DD. */
const isoDate = (serial) => new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000).toISOString().slice(0, 10);

/** A sheet's cells, as rows of values (and their styles) by column letter. */
function readSheet(name) {
  const path = sheetPaths.get(name);
  if (!path) fail(`${modelName}: no "${name}" sheet.`);
  const rows = new Map();
  for (const m of part(path).matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = /\br="([A-Z]+)(\d+)"/.exec(m[1]);
    if (!ref) continue;
    const type = attr(m[1], "t");
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
    rows.get(row).set(ref[1], { value, style: Number(attr(m[1], "s") ?? 0) });
  }
  const numbers = [...rows.keys()].sort((a, b) => a - b);
  const raw = (r) => String(rows.get(r)?.get("B")?.value ?? "");
  const label = (r) => raw(r).trim();

  /** The first row after `from` (a row number or the label of one) whose label starts with `text`, or null. */
  const findRow = (text, from = 0) => {
    const start = typeof from === "number" ? from : rowOf(from);
    return numbers.find((r) => r > start && label(r).toLowerCase().startsWith(text.toLowerCase())) ?? null;
  };
  const rowOf = (text, from = 0) =>
    findRow(text, from) ?? fail(`${modelName}: no "${text}" row on ${name}${typeof from === "number" && from ? ` after row ${from}` : ""}.`);
  const cell = (r, col) => rows.get(r)?.get(col)?.value;
  /** A value with its cell's number format; a date comes back YYYY-MM-DD. */
  const formatted = (r, col) => {
    const c = rows.get(r)?.get(col);
    if (!c) return null;
    const { format, literal } = formatOf(c.style);
    if (typeof c.value !== "number") return { value: String(c.value).trim(), format: "text" };
    if (format === "text") return { value: literal, format };
    if (format === "month") return { value: isoDate(c.value), format };
    return { value: c.value, format };
  };
  /** Labelled rows strictly between two. */
  const between = (from, to = Infinity) => numbers.filter((r) => r > from && r < to && label(r));
  /** Every row with a cell strictly between two, labelled or not. */
  const rowsBetween = (from, to = Infinity) => numbers.filter((r) => r > from && r < to);
  /** Column letters with a value in row `r`, in order. */
  const columnsOf = (r) => [...(rows.get(r)?.keys() ?? [])].sort((a, b) => a.length - b.length || a.localeCompare(b));
  return { name, findRow, rowOf, cell, formatted, raw, label, between, rowsBetween, columnsOf };
}

const num = (value, where) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  fail(`${modelName}: ${where} isn't a number (${JSON.stringify(value)}).`);
};
const maybe = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const text = (value) => (value == null ? "" : String(value).trim());
const at = (sheet, label, col = "D", from = 0) => num(sheet.cell(sheet.rowOf(label, from), col), `${sheet.name} "${label}" (${col})`);
const dateAt = (sheet, label, from = 0) => isoDate(at(sheet, label, "D", from));
const numbered = (line) => line.replace(/^\d+\.\s*/, "");

const summarySheet = readSheet("Summary");
const structure = readSheet("Structure");
const topcoSheet = readSheet("Zode Inc.");
const notesSheet = readSheet("Notes");

const model = {
  name: modelName,
  fileId: modelFile?.id ?? "",
  path: modelPath,
  prepared: `${notesSheet.label(notesSheet.rowOf("Prepared")).split(/(?<=\.)\s/)[0]}`,
};

// Notes: its sections in order, each line its own entry.
const section = (title, next) =>
  notesSheet.between(notesSheet.rowOf(title), next ? notesSheet.rowOf(next) : Infinity).map((r) => numbered(notesSheet.label(r)));
const overview = section("Structure of the workbook", "Conventions");
const conventions = section("Conventions", "Main simplifications");
const simplifications = section("Main simplifications", "Open items");
const openItems = section("Open items");

/**
 * Yearly rows under a "Year" header row, from `header` to `end`: one group per
 * run of rows without a blank between them. Labels indented in the workbook
 * belong to the row above.
 */
const SUBTOTALS = new Set(["Total revenue", "Gross profit", "EBITDA", "Net income (pre-tax)", "Operating cash flow", "Free cash flow", "Net cash flow"]);
function yearTable(sheet, header, end, titles) {
  const columns = sheet.columnsOf(header).filter((col) => !["A", "B", "C", "D"].includes(col));
  if (text(sheet.cell(header, "D")) !== "Total") fail(`${sheet.name}: expected "Total" in D${header}.`);
  const years = columns.map((col) => text(sheet.cell(header, col)));
  const runs = [];
  let previous = header;
  for (const r of sheet.rowsBetween(header, end)) {
    if (!sheet.label(r)) continue;
    if (r - previous > 1 || !runs.length) runs.push([]);
    runs.at(-1).push(r);
    previous = r;
  }
  if (runs.length !== titles.length) fail(`${sheet.name}: expected ${titles.length} blocks of yearly rows from row ${header}, found ${runs.length}.`);
  return {
    years,
    groups: runs.map((rows, g) => {
      let unit = "usd";
      return {
        title: titles[g],
        rows: rows.map((r) => {
          const label = sheet.label(r);
          const indent = /^\s/.test(sheet.raw(r));
          if (!indent) unit = /^MW\b/.test(label) ? "mw" : /headcount/i.test(label) ? "count" : "usd";
          return {
            label: label.replace(/\s*\(Dec\)$/, ", December"),
            values: columns.map((col) => maybe(sheet.cell(r, col)) ?? 0),
            total: maybe(sheet.cell(r, "D")),
            unit,
            ...(SUBTOTALS.has(label) ? { kind: "subtotal" } : {}),
            ...(indent ? { indent: true } : {}),
          };
        }),
      };
    }),
  };
}

// The raise and where it goes.
const raise = {
  amount: at(summarySheet, "Raise"),
  postMoneyCap: at(summarySheet, "Post-money valuation cap"),
  ownership: at(summarySheet, "Pre-seed ownership"),
  received: dateAt(topcoSheet, "Raise received"),
  terms: structure.label(structure.rowOf("Pre-seed investors")).replace(/^Pre-seed investors:\s*/i, ""),
};
const consolidated = summarySheet.rowOf("CONSOLIDATED");
const uses = summarySheet.between(summarySheet.rowOf("Pre-seed ownership"), consolidated).map((r) => ({
  label: summarySheet.label(r),
  amount: num(summarySheet.cell(r, "D"), `Summary use of proceeds row ${r}`),
}));
const check = summarySheet.rowOf("Check:");
if (Math.abs(num(summarySheet.cell(check, "D"), "the consolidated cash check")) > 1) {
  fail(`${modelName}: the Summary tab's "${summarySheet.label(check)}" isn't zero.`);
}
const statement = yearTable(summarySheet, summarySheet.rowOf("Year", consolidated), check, [
  "GPU clusters in service",
  "Profit and loss",
  "Cash flow and balances",
]);

// The SPVs, each matched to its tab by name.
const spvTabs = [...sheetPaths.keys()].filter((name) => !["Summary", "Structure", "Zode Inc.", "Notes"].includes(name));
const deploymentFolders = new Map(deploymentArgs.map((d) => [d.name, folderOf("deployment", d)]));
for (const d of deploymentArgs) {
  if (!spvTabs.includes(d.name)) fail(`--deployment ${d.name}: no such SPV tab; the workbook's are ${spvTabs.join(", ")}.`);
}
const spvHeader = structure.rowOf("SPV");
const spvs = structure.between(spvHeader, structure.rowOf("Notes")).map((r) => {
  const entity = structure.label(r);
  const name = spvTabs.find((tab) => entity.toLowerCase().startsWith(tab.toLowerCase()));
  if (!name) fail(`${modelName}: Structure row "${entity}" matches no SPV tab (${spvTabs.join(", ")}).`);
  return {
    name,
    entity,
    business: text(structure.cell(r, "C")),
    zodeEquity: num(structure.cell(r, "D"), `${entity} ZODE Inc. equity`),
    thirdPartyPref: num(structure.cell(r, "E"), `${entity} third-party pref`),
    peakDebt: num(structure.cell(r, "F"), `${entity} peak debt`),
    firstInService: isoDate(num(structure.cell(r, "G"), `${entity} first month in service`)),
    capitalStack: text(structure.cell(r, "H")),
    folderId: deploymentFolders.get(name) ?? null,
  };
});
const structureNotes = structure.between(structure.rowOf("Notes")).map((r) => numbered(structure.label(r)));

const masterModel = {
  model,
  raise,
  uses,
  topco: structure.label(structure.rowOf("ZODE Inc. (TopCo)")).replace(/^ZODE Inc\. \(TopCo\):\s*/, ""),
  spvs,
  structureNotes,
  statement,
  overview,
  conventions,
  simplifications,
  openItems,
};

/** An SPV tab: its yearly summary, key figures, capacity and inputs. */
function readSpv(name) {
  const sheet = readSheet(name);
  const spv = spvs.find((s) => s.name === name) ?? fail(`${modelName}: no Structure row for ${name}.`);
  const titleLine = sheet.label(1);
  const tenure = /\((own|lease) template\)/i.exec(titleLine)?.[1]?.toLowerCase();
  if (!tenure) fail(`${name}: expected "(own template)" or "(lease template)" in its title, "${titleLine}".`);

  const keyRow = sheet.rowOf("Key figures");
  const inputsRow = sheet.rowOf("INPUTS");
  const buildRow = sheet.rowOf("MONTHLY BUILD");
  const summary = yearTable(sheet, sheet.rowOf("Year", sheet.rowOf("SUMMARY")), keyRow, [""]);
  const keyFigures = sheet.between(keyRow, inputsRow).map((r) => ({
    label: sheet.label(r),
    value: sheet.formatted(r, "D") ?? fail(`${name}: key figure "${sheet.label(r)}" has no value.`),
    ...(/^\s/.test(sheet.raw(r)) ? { indent: true } : {}),
  }));

  const blockHeader = sheet.rowOf("Block", inputsRow);
  const totalRow = sheet.rowOf("Total", blockHeader);
  const blocks = sheet.between(blockHeader, totalRow).map((r) => ({
    name: sheet.label(r),
    site: text(sheet.cell(r, "C")),
    mw: num(sheet.cell(r, "D"), `${name} block "${sheet.label(r)}" MW`),
    inService: isoDate(num(sheet.cell(r, "E"), `${name} block "${sheet.label(r)}" in service`)),
  }));
  const totalMw = num(sheet.cell(totalRow, "D"), `${name} capacity total`);
  if (Math.abs(blocks.reduce((total, b) => total + b.mw, 0) - totalMw) > 1e-6) fail(`${name}: the capacity blocks don't add up to ${totalMw} MW.`);
  const capacityTitle = sheet.label(sheet.between(inputsRow, blockHeader).at(-1) ?? blockHeader);

  // Inputs below the capacity table: a row with no value heads a group; "PART A - ..." heads a part.
  const inputs = [];
  let partName = null;
  for (const r of sheet.between(totalRow, buildRow)) {
    const label = sheet.label(r);
    const partMatch = /^PART [A-Z] - (.+?)(?: INPUTS)?$/.exec(label);
    if (partMatch) {
      partName = partMatch[1].charAt(0) + partMatch[1].slice(1).toLowerCase();
      continue;
    }
    const value = sheet.formatted(r, "D");
    if (!value) {
      inputs.push({ part: partName, title: label, terms: [] });
      continue;
    }
    if (!inputs.length) inputs.push({ part: partName, title: "Inputs", terms: [] });
    const unit = text(sheet.cell(r, "C"));
    inputs.at(-1).terms.push({
      label,
      value: unit === "C$" ? { ...value, currency: "C$" } : value,
      note: text(sheet.cell(r, "E")),
    });
  }

  const sites = [...new Set(blocks.map((b) => b.site))].flatMap((site) => {
    const arg = siteArgs.find((s) => s.name === site);
    return tenure === "own" && arg ? [{ name: site, folderId: folderOf("site", arg) }] : [];
  });
  const deployment = {
    model,
    spv,
    title: titleLine.replace(/\s*\((own|lease) template\)\s*$/i, ""),
    tenure,
    // Less the tab's account of its own layout, such as "Summary at the top, inputs, then the monthly build."
    description: sheet
      .label(2)
      .replace(/\s*\$000\.?$/, "")
      .replace(/\s*Summary at the top[^.]*\./i, "")
      .trim(),
    summary,
    keyFigures,
    capacity: { title: capacityTitle, blocks, totalMw },
    inputs: inputs.filter((g) => g.terms.length),
    openItems: openItems.filter((line) => line.startsWith(`${name}:`)).map((line) => line.slice(name.length + 1).trim()),
    sites,
  };
  return { sheet, deployment };
}

const spvData = new Map(deploymentArgs.map((d) => [d.name, readSpv(d.name)]));
const deployments = deploymentArgs.map((d) => ({ folderId: deploymentFolders.get(d.name), deployment: spvData.get(d.name).deployment }));

/** An owned site's own figures, from the deployment tab whose capacity table lists it. */
function readSite(arg) {
  const found = [...spvData.values()].find(({ deployment: d }) => d.tenure === "own" && d.capacity.blocks.some((b) => b.site === arg.name));
  if (!found) fail(`--site ${arg.name}: no owned deployment's capacity table lists a site "${arg.name}".`);
  const { sheet, deployment: d } = found;
  const blocks = d.capacity.blocks.filter((b) => b.site === arg.name);
  const mw = blocks.reduce((total, b) => total + b.mw, 0);

  const priceRows = sheet.between(sheet.rowOf("INPUTS"), sheet.rowOf("MONTHLY BUILD")).filter((r) =>
    sheet.label(r).toLowerCase().startsWith(`${arg.name} purchase price`.toLowerCase()),
  );
  if (!priceRows.length) fail(`${d.spv.name}: no "${arg.name} purchase price" row.`);
  const usdRow = priceRows.find((r) => /\(US\$\)/.test(sheet.label(r))) ?? priceRows.find((r) => !/\([A-Z]*\$\)/.test(sheet.label(r)));
  const localRow = priceRows.find((r) => r !== usdRow);
  if (!usdRow) fail(`${d.spv.name}: no USD "${arg.name} purchase price" row.`);
  const purchasePrice = {
    usd: num(sheet.cell(usdRow, "D"), `${arg.name} purchase price`),
    local: localRow ? num(sheet.cell(localRow, "D"), `${arg.name} local purchase price`) : null,
    currency: localRow ? text(sheet.cell(localRow, "C")) || null : null,
  };
  const reRow = sheet.findRow(`${arg.name} re-energization`);
  const deposit = at(sheet, `${arg.name} deposit`);
  const balanceAndClosing = -at(sheet, `${arg.name}: price balance`, "D", sheet.rowOf("MONTHLY BUILD"));
  const reEnergization = reRow === null ? null : num(sheet.cell(reRow, "D"), `${arg.name} re-energization`);
  const conversionPerMw = at(sheet, "Conversion cost ($ per MW");
  const key = (label, from = 0) => sheet.rowOf(label, Math.max(from, sheet.rowOf("Key figures")));
  const equityRow = key("Equity required");
  const irrRow = key("Unlevered project IRR");
  return {
    model,
    name: arg.name,
    purchasePrice,
    deposit,
    closes: dateAt(sheet, `${arg.name} closes`),
    balanceAndClosing,
    reEnergization,
    blocks,
    mw,
    conversionPerMw,
    rentPerKwMonth: at(sheet, "Rent charged to the compute companies"),
    siteCost: deposit + balanceAndClosing + (reEnergization ?? 0) + conversionPerMw * mw,
    spv: {
      name: d.spv.name,
      folderId: d.spv.folderId,
      sites: [...new Set(d.capacity.blocks.map((b) => b.site))],
      mw: d.capacity.totalMw,
      preDevelopment: at(sheet, "Pre-development"),
      siteCost: at(sheet, "Site company: total site cost", "D", sheet.rowOf("Key figures")),
      revenue: num(sheet.cell(sheet.rowOf("Revenue", sheet.rowOf("SUMMARY")), "D"), `${d.spv.name} revenue`),
      ebitda: num(sheet.cell(sheet.rowOf("EBITDA", sheet.rowOf("SUMMARY")), "D"), `${d.spv.name} EBITDA`),
      peakEquity: num(sheet.cell(equityRow, "D"), `${d.spv.name} peak equity`),
      zodeEquity: num(sheet.cell(sheet.rowOf("ZODE Inc.", equityRow), "D"), `${d.spv.name} ZODE equity`),
      thirdPartyPref: num(sheet.cell(sheet.rowOf("Third-party pref", equityRow), "D"), `${d.spv.name} third-party pref`),
      peakDebt: num(sheet.cell(key("Peak debt"), "D"), `${d.spv.name} peak debt`),
      unleveredIrr: maybe(sheet.cell(irrRow, "D")),
      firstInService: dateAt(sheet, "First month in service", sheet.rowOf("Key figures")),
    },
  };
}

const sites = siteArgs.map((arg) => ({ folderId: folderOf("site", arg), site: readSite(arg) }));

// The sites of an SPV, given together, add up to its total site cost with the pre-development they share.
for (const name of new Set(sites.map((s) => s.site.spv.name))) {
  const given = sites.filter((s) => s.site.spv.name === name).map((s) => s.site);
  if (given.length !== given[0].spv.sites.length) continue;
  const sum = given.reduce((total, s) => total + s.siteCost, 0) + given[0].spv.preDevelopment;
  if (Math.abs(sum - given[0].spv.siteCost) > 1) fail(`${name}: its sites' costs add up to ${sum}, not its total site cost of ${given[0].spv.siteCost}.`);
}

// The sites' diligence summaries have to be there to take the figures.
const existing = await sql`select folder_id, layout from data_room_summaries where room_id = ${args.room} and folder_id is not null`;
const layoutAt = new Map(existing.map((row) => [String(row.folder_id), String(row.layout)]));
for (const { folderId, site } of sites) {
  if (layoutAt.get(folderId) !== "site") fail(`--site ${site.name}: "${pathOf(folderId)}" has no site summary; write its diligence first (scripts/write-room-summary.mjs).`);
}
for (const { folderId, deployment } of deployments) {
  if (layoutAt.get(folderId) === "site") fail(`--deployment ${deployment.spv.name}: "${pathOf(folderId)}" holds a site summary.`);
}

const usdM = (n) => `$${(n / 1e6).toFixed(1)}M`;
console.log(
  `[master] "${room.name}" from ${modelName}: ${usdM(raise.amount)} raise at a ${usdM(raise.postMoneyCap)} cap; ` +
    spvs.map((s) => `${s.name} ${usdM(s.zodeEquity)} from ZODE${s.folderId ? ` (${pathOf(s.folderId)})` : ""}`).join(", ") +
    `; ${statement.years[0]} to ${statement.years.at(-1)}.`,
);
for (const { site } of sites) {
  console.log(`[master]   ${site.name}: ${site.mw} MW, ${usdM(site.siteCost)} site cost, in ${site.spv.name}.`);
}
if (args.out) {
  const out = { master: masterModel, deployments: deployments.map((d) => d.deployment), sites: sites.map((s) => s.site) };
  await writeFile(args.out.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`[master] saved what the workbook gave to ${args.out}.`);
}

if (args["dry-run"]) {
  console.log("[master] dry run: nothing written.");
  process.exit(0);
}

const by = args.as.trim().toLowerCase();
const upsert = (folderId, layout, economics) => sql`
  insert into data_room_summaries (room_id, folder_id, layout, kind, diligence, economics, updated_by_email)
  values (${args.room}, ${folderId}, ${layout}, null, '{}'::jsonb, ${JSON.stringify(economics)}::jsonb, ${by})
  on conflict (room_id, folder_id) do update
    set layout = excluded.layout, kind = excluded.kind, diligence = excluded.diligence, economics = excluded.economics,
        updated_at = now(), updated_by_email = excluded.updated_by_email
`;
await sql.transaction([
  sql`delete from data_room_summaries where room_id = ${args.room} and layout not in ('site', 'master', 'deployment')`,
  upsert(null, "master", masterModel),
  ...deployments.map((d) => upsert(d.folderId, "deployment", d.deployment)),
  ...sites.map(
    (s) => sql`
      update data_room_summaries
      set economics = jsonb_set(economics, '{master}', ${JSON.stringify(s.site)}::jsonb),
          updated_at = now(), updated_by_email = ${by}
      where room_id = ${args.room} and folder_id = ${s.folderId} and layout = 'site'
    `,
  ),
]);
console.log(
  `[master] wrote the summaries of "${room.name}" (${1 + deployments.length} from the model, ${sites.length} sites) to ${new URL(databaseUrl).hostname}.`,
);
