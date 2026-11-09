/**
 * Writes a company room's summary, at the top of the room, from the TopCo
 * workbook in it:
 *
 *   node --env-file=.env.production.local scripts/write-topco-summary.mjs \
 *     --room <room id> --model "01 PRE-SEED/ZODE_TopCo_Model_26.11.09.xlsx" \
 *     --project "Toronto=Toronto:02 ZODE TORONTO" \
 *     --project "Calgary=Retro 1 site+Retro 1 compute:03 ZODE CALGARY" \
 *     --project "BigWatt=BigWatt:04 ZODE BIG WATT" \
 *     [--as n3o@zero.tech] [--out topco.json] [--dry-run]
 *
 * The workbook is a ZODE TopCo model: Summary, TopCo, then one tab per project
 * SPV. Its cached values are read by their row labels in column B, so rows can
 * move between versions; a label that's missing fails the run rather than
 * writing a gap. `--project <name>=<SPV column>[+<SPV column>...][:<folder path>]`
 * names a project, in display order, by the Summary tab's SPV columns it
 * holds and the folder it sits in, so the summary links to it and to the
 * project's own summary there (scripts/write-portfolio-summary.mjs --folder).
 * Every SPV column belongs to one project. A project of several SPVs adds up
 * their amounts and takes TopCo's IRR from their yearly cash to TopCo
 * together; its other rates stay by SPV. `--out` also saves what was read
 * from the workbook, to check it by eye.
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
  const match = /^([^=]+)=([^:]+)(?::(.+))?$/.exec(arg);
  if (!match) fail(`--project "${arg}": expected <name>=<SPV column>[+<SPV column>...][:<folder path>].`);
  return {
    name: match[1].trim(),
    columns: match[2].split("+").map((c) => c.trim()),
    folderPath: match[3]?.trim().replace(/^\/+|\/+$/g, "") || null,
  };
});
if (!projectArgs.length) fail("--project is required, once per project.");

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
for (const p of projectArgs) {
  if (p.folderPath && !folderByPath.has(p.folderPath)) fail(`--project ${p.name}: no folder "${p.folderPath}" in "${room.name}".`);
}

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
const spvNames = spvColumns.map((c) => c.name);
for (const p of projectArgs) {
  for (const column of p.columns) {
    if (!spvNames.includes(column)) fail(`--project ${p.name}: no SPV "${column}"; the workbook's are ${spvNames.join(", ")}.`);
  }
}
for (const name of spvNames) {
  const holders = projectArgs.filter((p) => p.columns.includes(name));
  if (holders.length !== 1) fail(`SPV "${name}" belongs to ${holders.length} projects; give it to exactly one --project.`);
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
const AMOUNTS = ["criticalItMw", "projectCost", "debt", "prefNeeded", "topcoPref", "thirdPartyPref", "cashToTopco"];
const spvs = new Map(
  spvColumns.map(({ col, name }) => [
    name,
    {
      name,
      structure: text(summary.cell(rowsOf.structure, col)),
      ...Object.fromEntries(AMOUNTS.map((key) => [key, amount(key, col)])),
      projectIrr: maybe(summary.cell(rowsOf.projectIrr, col)),
      prefIrr: maybe(summary.cell(rowsOf.prefIrr, col)),
      prefMultiple: maybe(summary.cell(rowsOf.prefMultiple, col)),
      topcoIrr: maybe(summary.cell(rowsOf.topcoIrr, col)),
      topcoMultiple: maybe(summary.cell(rowsOf.topcoMultiple, col)),
    },
  ]),
);
const total = Object.fromEntries(AMOUNTS.map((key) => [key, amount(key, totalCol)]));

/** The rate at which yearly cash flows are worth nothing today, as Excel's IRR; null when they never change sign. */
const irrOf = (flows) => {
  if (!flows.some((v) => v < 0) || !flows.some((v) => v > 0)) return null;
  const npv = (rate) => flows.reduce((sum, v, t) => sum + v / (1 + rate) ** t, 0);
  let [low, high] = [-0.99, 1000];
  if (npv(low) * npv(high) > 0) return null;
  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    if (npv(low) * npv(mid) <= 0) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
};

// Each SPV's yearly net cash to TopCo, from its tab: the "ZODE TopCo all-in"
// row whose total is the cash TopCo takes out less the pref it puts in.
const tabs = [...sheetPaths.keys()].filter((name) => !["Readme", "Summary", "TopCo"].includes(name)).map((name) => ({ name, sheet: readSheet(name) }));
const topcoFlows = (spv) => {
  const net = spv.cashToTopco - spv.topcoPref;
  for (const { name, sheet } of tabs) {
    for (const r of sheet.between(0)) {
      if (!sheet.label(r).startsWith("ZODE TopCo all-in: net cash flow")) continue;
      if (Math.abs(num(sheet.cell(r, "D"), `${name} row ${r} total`) - net) > 1) continue;
      const yearRow = sheet.between(0, r).findLast((y) => sheet.label(y) === "Year");
      if (!yearRow) fail(`${modelFile.name}: no "Year" header above ${name} row ${r}.`);
      const cols = sheet.columnsOf(yearRow).filter((col) => typeof sheet.cell(yearRow, col) === "number");
      const flows = cols.map((col) => maybe(sheet.cell(r, col)) ?? 0);
      const check = irrOf(flows);
      if (spv.topcoIrr !== null && (check === null || Math.abs(check - spv.topcoIrr) > 1e-4)) {
        fail(`${modelFile.name}: TopCo's IRR on ${spv.name} from ${name} row ${r} is ${check}, not the Summary's ${spv.topcoIrr}.`);
      }
      return flows;
    }
  }
  fail(`${modelFile.name}: no tab has ${spv.name}'s yearly cash to TopCo (a "ZODE TopCo all-in: net cash flow" row totalling ${net}).`);
};

const close = (a, b) => Math.abs(a - b) <= 1;
const sumOf = (values) => values.reduce((total, v) => total + v, 0);
const addUp = (series) => series.reduce((total, s) => total.map((v, t) => v + s[t]));
const zeros = () => years.map(() => 0);

// The years every yearly series runs, from TopCo's calculations.
const topcoYearRow = topco.between(topco.rowOf("CALCULATIONS")).find((r) => topco.label(r) === "Year");
if (!topcoYearRow) fail(`${modelFile.name}: no "Year" header under CALCULATIONS on TopCo.`);
const years = topco.columnsOf(topcoYearRow).flatMap((col) => (typeof topco.cell(topcoYearRow, col) === "number" ? [topco.cell(topcoYearRow, col)] : []));

/** A row's values in `years`, read by each column's year in the header `yearRow`. */
const yearly = (sheet, yearRow, r) => {
  const cols = new Map(sheet.columnsOf(yearRow).flatMap((col) => (typeof sheet.cell(yearRow, col) === "number" ? [[sheet.cell(yearRow, col), col]] : [])));
  return years.map((y) => {
    if (!cols.has(y)) fail(`${modelFile.name}: no ${y} column above row ${r}.`);
    return maybe(sheet.cell(r, cols.get(y))) ?? 0;
  });
};

/**
 * Where an SPV's yearly rows go, by label. Costs, revenue and draws keep the
 * workbook's sign; interest and repayments are kept as positive amounts, so
 * flip them. Fees to TopCo don't leave the group.
 */
const LINES = [
  ["compute", /^Revenue$/],
  ["rent", /^Rent revenue$/],
  ["power", /^Power$/],
  ["facility", /^Colocation lease$|^Facility operations/],
  ["siteRent", /^Rent to the .*site company$/],
  ["other", /^(Insurance|Sales costs|SLA credits|Inference team|Operating contingency|Site holding)|^Power-management technology profit share$/],
  ["devFee", /^Development fee to ZODE TopCo$/],
  ["fees", /fee to ZODE TopCo$/],
  ["prepayments", /^Customer prepayment received|^Prepayment applied/],
  ["site", /^Deposits and pre-development$|^Purchase price|re-energization/],
  ["conversion", /^Conversion \/ build-out$/],
  ["gpu", /^GPU hardware and setup$|^Lease upfront payment/],
  ["sales", /^Sale proceeds|^Hardware resale/],
  ["gpuValue", /^Value of the newest GPUs/],
  ["drawn", /draws$|^GPU debt drawn$/],
  ["interest", /(^|: )interest\b/i, -1],
  ["repaid", /scheduled principal$|repaid at/i, -1],
];
const PHASES = ["site", "conversion", "gpu"];

/**
 * An SPV's critical IT in MW at each year end: a site company's capacity
 * ready, or a colocated cluster's while it runs into the next year. Null for
 * compute companies, whose clusters sit in their site company's.
 */
const criticalItOf = (sheet, yearRow, end) => {
  const rows = sheet.between(yearRow, end);
  const ready = rows.find((r) => sheet.label(r) === "MW ready by year end");
  if (ready) return yearly(sheet, yearRow, ready);
  const operating = rows.find((r) => sheet.label(r).startsWith("Share of year operating (all cases)"));
  if (!operating) return null;
  const mw = num(sheet.cell(sheet.rowOf("Critical IT (kW)"), "D"), "Critical IT (kW)") / 1000;
  const share = yearly(sheet, yearRow, operating);
  return share.map((s, t) => (s > 0 && (t === share.length - 1 || share[t + 1] > 0) ? mw : 0));
};

/**
 * An SPV's block of its tab, from the "Year" header above the "Equity needed"
 * row that matches its pref to the next header: its yearly lines, which add up
 * to its cash flow to equity every year, and its pref in and out.
 */
const sectionOf = (spv) => {
  for (const { name, sheet } of tabs) {
    for (const r of sheet.between(0)) {
      if (!sheet.label(r).startsWith("Equity needed")) continue;
      if (!close(num(sheet.cell(r, "D"), `${name} row ${r} total`), spv.prefNeeded)) continue;
      const yearRow = sheet.between(0, r).findLast((y) => sheet.label(y) === "Year");
      if (!yearRow) fail(`${modelFile.name}: no "Year" header above ${name} row ${r}.`);
      const end = sheet.between(r).find((y) => sheet.label(y) === "Year") ?? Infinity;
      const toEquity = sheet.between(yearRow, end).find((y) => sheet.label(y) === "Cash flow to equity");
      if (!toEquity) fail(`${modelFile.name}: no "Cash flow to equity" row in ${spv.name}'s part of ${name}.`);
      const lines = Object.fromEntries(LINES.map(([key]) => [key, zeros()]));
      for (const row of sheet.between(yearRow, toEquity)) {
        const line = LINES.find(([, pattern]) => pattern.test(sheet.label(row)));
        if (!line) continue;
        const values = yearly(sheet, yearRow, row);
        lines[line[0]] = lines[line[0]].map((v, t) => v + values[t] * (line[2] ?? 1));
      }
      const equity = yearly(sheet, yearRow, toEquity);
      const added = addUp(Object.values(lines));
      added.forEach((v, t) => {
        if (!close(v, equity[t])) fail(`${modelFile.name}: ${spv.name}'s lines on ${name} add up to ${v} in ${years[t]}, not its cash flow to equity of ${equity[t]}.`);
      });
      const after = (label) => yearly(sheet, yearRow, sheet.rowOf(label, toEquity));
      return {
        criticalIt: criticalItOf(sheet, yearRow, end),
        lines,
        needed: yearly(sheet, yearRow, r),
        thirdPartyIn: after("Pref contributions: third-party investors"),
        thirdPartyOut: addUp([after("Pref distributions: third-party investors"), after("Common: partner share")]),
      };
    }
  }
  fail(`${modelFile.name}: no tab has ${spv.name}'s "Equity needed" row totalling ${spv.prefNeeded}.`);
};
const sections = new Map([...spvs.values()].map((spv) => [spv.name, sectionOf(spv)]));

/**
 * An SPV's debt and pref by what they pay for. The workbook sizes debt on each
 * year's cost, so each year's draws and equity split by that year's cost mix;
 * development fees ride along with the costs they're charged on.
 */
const capitalOf = (spv) => {
  const { lines, needed } = sections.get(spv.name);
  const costs = PHASES.map((phase) => lines[phase]);
  const cost = sumOf(costs.map(sumOf)) + sumOf(lines.devFee);
  if (!close(-cost, spv.projectCost)) fail(`${modelFile.name}: ${spv.name}'s cost lines add up to ${-cost}, not its project cost of ${spv.projectCost}.`);
  const capital = Object.fromEntries(PHASES.map((phase) => [phase, { pref: 0, debt: 0 }]));
  years.forEach((year, t) => {
    const yearCost = sumOf(costs.map((c) => c[t]));
    if (yearCost === 0) {
      if (lines.drawn[t] || needed[t]) fail(`${modelFile.name}: ${spv.name} draws debt or equity in ${year} with no cost to split it by.`);
      return;
    }
    PHASES.forEach((phase, i) => {
      const share = costs[i][t] / yearCost;
      capital[phase].pref += needed[t] * share;
      capital[phase].debt += lines.drawn[t] * share;
    });
  });
  const total = (key) => sumOf(PHASES.map((phase) => capital[phase][key]));
  if (!close(total("debt"), spv.debt)) fail(`${modelFile.name}: ${spv.name}'s debt by phase adds up to ${total("debt")}, not ${spv.debt}.`);
  if (!close(total("pref"), spv.prefNeeded)) fail(`${modelFile.name}: ${spv.name}'s pref by phase adds up to ${total("pref")}, not ${spv.prefNeeded}.`);
  return capital;
};
const addCapital = (capitals) =>
  Object.fromEntries(PHASES.map((phase) => [phase, { pref: sumOf(capitals.map((c) => c[phase].pref)), debt: sumOf(capitals.map((c) => c[phase].debt)) }]));

/** What sets a project's SPVs apart, by their names less what they share: "Retro 1 site" and "Retro 1 compute" are site and compute. */
const layerNames = (names) => {
  if (names.length < 2) return names.map(() => "");
  const words = names.map((n) => n.split(/\s+/));
  let shared = 0;
  while (words.every((w) => w.length > shared + 1 && w[shared] === words[0][shared])) shared += 1;
  return words.map((w) => w.slice(shared).join(" "));
};

const projects = projectArgs.map((p) => {
  const members = p.columns.map((name) => spvs.get(name));
  const sum = (key) => members.reduce((total, s) => total + s[key], 0);
  const layers = layerNames(p.columns);
  let topcoIrr = members[0].topcoIrr;
  if (members.length > 1) {
    const flows = members.map(topcoFlows);
    if (flows.some((f) => f.length !== flows[0].length)) fail(`--project ${p.name}: its SPVs' tabs run different years.`);
    topcoIrr = irrOf(flows[0].map((_, t) => flows.reduce((total, f) => total + f[t], 0)));
  }
  const topcoPref = sum("topcoPref");
  return {
    name: p.name,
    tenure: members.some((s) => /^site\b/i.test(s.structure)) ? "own" : "lease",
    spvs: members.map((s, i) => ({ name: s.name, layer: layers[i], structure: s.structure })),
    folderId: p.folderPath ? folderByPath.get(p.folderPath) : null,
    folderPath: p.folderPath,
    ...Object.fromEntries(AMOUNTS.map((key) => [key, sum(key)])),
    projectIrr: members.map((s, i) => ({ layer: layers[i], value: s.projectIrr })),
    pref: members.map((s, i) => ({ layer: layers[i], irr: s.prefIrr, multiple: s.prefMultiple })),
    topcoIrr,
    topcoMultiple: members.length > 1 ? (topcoPref > 0 ? sum("cashToTopco") / topcoPref : null) : members[0].topcoMultiple,
    capital: addCapital(members.map(capitalOf)),
  };
});
total.capital = addCapital(projects.map((p) => p.capital));

/** A label that names a project's SPV, or the tab they share, renamed for the project: "Pref into Retro 1" reads "Pref into Calgary". */
const renamed = (label) => {
  for (const p of projectArgs) {
    const [first] = p.columns;
    const shared = p.columns.length > 1 ? first.split(/\s+/).slice(0, -1).join(" ") : first;
    for (const name of [...p.columns, shared]) {
      if (name && label.endsWith(` ${name}`)) return `${label.slice(0, -name.length)}${p.name}`;
    }
  }
  return label;
};
const committed = uses.filter((u) => /^Preferred equity/.test(u.label)).reduce((sum, u) => sum + u.amount, 0);
if (Math.abs(total.topcoPref - committed) > 1) fail(`${modelFile.name}: TopCo pref across the SPVs (${total.topcoPref}) isn't the ${committed} committed.`);

// The SPVs and TopCo as one, year by year. Fees to TopCo and a compute
// company's rent to its own project's site company stay inside the group;
// once that site company has sold the site, the rent is paid out.
const topcoAt = (label) => yearly(topco, topcoYearRow, topco.rowOf(label, topcoYearRow));
const topcoCash = topco.rowOf("TopCo cash", topcoYearRow);
const topcoCosts = topcoAt("Total TopCo operating costs").map((v) => -v);
const feeIncome = addUp(
  topco.between(topco.rowOf("SPV cash flows", topcoYearRow), topco.rowOf("Net cash from SPVs", topcoYearRow))
    .filter((r) => topco.label(r).endsWith(": fees"))
    .map((r) => yearly(topco, topcoYearRow, r)),
);
const preSeed = yearly(topco, topcoYearRow, topco.rowOf("Pre-seed equity raised", topcoCash));
const toShareholders = yearly(topco, topcoYearRow, topco.rowOf("Distributions to TopCo shareholders", topcoCash)).map((v) => -v);
const cashChange = addUp([yearly(topco, topcoYearRow, topco.rowOf("Closing cash", topcoCash)), yearly(topco, topcoYearRow, topco.rowOf("Opening cash", topcoCash)).map((v) => -v)]);

const all = [...sections.values()];
const line = (key) => addUp(all.map((s) => s.lines[key]));
const siteRentKept = addUp(
  projectArgs.map((p) => {
    const members = p.columns.map((name) => sections.get(name));
    const paid = addUp(members.map((s) => s.lines.siteRent)).map((v) => -v);
    const earned = addUp(p.columns.filter((name) => /^site\b/i.test(spvs.get(name).structure)).map((name) => sections.get(name).lines.rent).concat([zeros()]));
    return paid.map((v, t) => Math.min(v, earned[t]));
  }),
);

const criticalIt = addUp(
  projectArgs.map((p) => {
    const held = p.columns.map((name) => sections.get(name).criticalIt).filter(Boolean);
    if (!held.length) fail(`${modelFile.name}: no tab gives --project ${p.name}'s critical IT year by year.`);
    return addUp(held);
  }),
);
// Facility power from critical IT at the workbook's one PUE.
const pues = [...new Set(tabs.flatMap(({ sheet }) => sheet.between(0).filter((r) => sheet.label(r) === "PUE").map((r) => sheet.cell(r, "D"))))];
if (pues.length !== 1 || typeof pues[0] !== "number") fail(`${modelFile.name}: expected one PUE across the tabs, found ${JSON.stringify(pues)}.`);
const facility = criticalIt.map((mw) => mw * pues[0]);

const revenue = [
  { label: "Compute revenue", values: line("compute") },
  { label: "Data center rent", values: addUp([line("rent"), siteRentKept.map((v) => -v)]) },
];
const costs = [
  { label: "Power", values: line("power") },
  { label: "Colocation and facility operations", values: addUp([line("facility"), line("siteRent"), siteRentKept]) },
  { label: "Other operating costs", values: line("other") },
  { label: "TopCo overhead", values: topcoCosts },
];
const investment = [
  { label: "Interest", values: line("interest") },
  { label: "Site acquisition", values: line("site") },
  { label: "Conversion", values: line("conversion") },
  { label: "GPUs and colocation setup", values: line("gpu") },
  { label: "Asset sales", values: line("sales") },
  { label: "GPU value at end of model, not cash", values: line("gpuValue") },
  { label: "Customer prepayments, net", values: line("prepayments") },
  { label: "Debt drawn", values: line("drawn") },
  { label: "Debt repaid", values: line("repaid") },
];
const equity = [
  { label: "Pre-seed equity raised", values: preSeed },
  { label: "Third-party pref contributed", values: addUp(all.map((s) => s.thirdPartyIn)) },
];
/** Not shown; they close the check against TopCo's cash. */
const distributions = [addUp(all.map((s) => s.thirdPartyOut)).map((v) => -v), toShareholders];
const totalRevenue = addUp(revenue.map((r) => r.values));
const totalCosts = addUp(costs.map((r) => r.values));
const ebitda = addUp([totalRevenue, totalCosts]);
const toEquityHolders = addUp([ebitda, ...investment.map((r) => r.values)]);
const equityRaised = addUp(equity.map((r) => r.values));
const netCash = addUp([toEquityHolders, equityRaised, ...distributions]);

const spvsToEquity = addUp(all.map((s) => addUp(Object.values(s.lines))));
years.forEach((year, t) => {
  const expected = spvsToEquity[t] + feeIncome[t] + topcoCosts[t];
  if (!close(toEquityHolders[t], expected)) fail(`${modelFile.name}: the group's cash flow to equity in ${year} is ${toEquityHolders[t]}, not the SPVs' and TopCo's ${expected}.`);
  if (!close(netCash[t], cashChange[t])) fail(`${modelFile.name}: the group's net cash in ${year} is ${netCash[t]}, not the change in TopCo's cash of ${cashChange[t]}.`);
});

/** The statement shows the first five years, its total theirs alone. */
const SHOWN_YEARS = 5;
const statementRow = ({ label, values }, kind) => {
  const shown = values.slice(0, SHOWN_YEARS);
  return { label, values: shown, total: sumOf(shown), ...(kind ? { kind } : {}) };
};
const subtotal = (label, values) => statementRow({ label, values }, "subtotal");
/** Capacity at each year end, which doesn't add up across years. */
const capacityRow = (label, values) => ({ label, values: values.slice(0, SHOWN_YEARS), total: null, unit: "mw" });
/** A group's lines, less any that never move. */
const moving = (rows) => rows.filter((r) => r.values.slice(0, SHOWN_YEARS).some((v) => Math.abs(v) >= 0.5)).map((r) => statementRow(r));
const statement = {
  years: years.slice(0, SHOWN_YEARS),
  groups: [
    { title: "Capacity", rows: [capacityRow("Facility power", facility), capacityRow("Critical IT", criticalIt)] },
    { title: "Revenue", rows: [...moving(revenue), subtotal("Total revenue", totalRevenue)] },
    { title: "Operating costs", rows: [...moving(costs), subtotal("Total operating costs", totalCosts), subtotal("EBITDA", ebitda)] },
    { title: "Investment and financing", rows: [...moving(investment), subtotal("Cash flow to equity holders", toEquityHolders)] },
    { title: "Equity", rows: [...moving(equity), subtotal("Total equity raised", equityRaised)] },
  ],
};

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
  uses: uses.map((u) => ({ ...u, label: renamed(u.label) })),
  projects,
  total,
  returns: {
    preSeedIrr: maybe(summary.cell(summary.rowOf("Pre-seed IRR"), "D")),
    preSeedMultiple: maybe(summary.cell(summary.rowOf("Pre-seed multiple"), "D")),
    lowestCash: at(summary, "Lowest TopCo cash"),
    budgetYears: at(summary, "Years of TopCo costs covered"),
    through: years.at(-1),
  },
  statement,
  team,
  overview,
  notes: [summary.label(summary.rowOf("Revenue cases")), ...simplifications],
};

console.log(
  `[topco] "${room.name}" from ${modelFile.name}: $${raise.amount / 1e6}M raise at $${raise.preMoney / 1e6}M pre-money; ` +
    projects.map((p) => `${p.name} $${p.topcoPref / 1e6}M${p.folderPath ? ` (${p.folderPath})` : ""}`).join(", ") +
    `; consolidated ${statement.years[0]}-${statement.years.at(-1)}.`,
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
