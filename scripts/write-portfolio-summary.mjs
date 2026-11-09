/**
 * Writes a portfolio room's summary from the model workbook in the room, and
 * gives each site's folder the summary of the room it was copied from:
 *
 *   node --env-file=.env.production.local scripts/write-portfolio-summary.mjs \
 *     --room <portfolio room id> --model "02 PROJECT DEAL/ZODE_Retro_I_Model_26.10.22.xlsx" \
 *     --site "Olds=<site room id>:03 ZODE CALGARY/01 Olds - 6102-6402 48 Avenue" \
 *     --site "Calgary=<site room id>:03 ZODE CALGARY/02 Calgary - 5430 30 Street SE" \
 *     [--as n3o@zero.tech] [--out portfolio.json] [--dry-run]
 *
 * The workbook is a ZODE Retro model: Summary, Inputs and one sheet per site,
 * the sites as columns C to F and the total in G. Its cached values are read
 * by their row labels in column B, so rows can move between versions; a label
 * that's missing fails the run rather than writing a gap. The summary shows
 * the base case the workbook was saved with (the sites it includes) and its
 * stored downside, base and upside cases.
 *
 * `--site <column>=<room id>:<folder path>` names the workbook column a site
 * is, the room its files were copied from (scripts/copy-data-room.mjs), and
 * where they sit here. That room's summary is copied onto the folder, every
 * cited file resolved to its copy here; the source room is left as it was.
 * Sites the workbook includes without a --site are shown with no folder.
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
    site: { type: "string", multiple: true, default: [] },
    as: { type: "string", default: "n3o@zero.tech" },
    out: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`[portfolio] ${message}`);
  process.exit(1);
};

if (!args.room) fail("--room is required.");
if (!args.model) fail("--model is required (the workbook's path in the room).");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set.");
if (!process.env.BLOB_READ_WRITE_TOKEN) fail("BLOB_READ_WRITE_TOKEN is not set.");

const siteArgs = args.site.map((arg) => {
  const match = /^([^=]+)=([0-9a-f-]{36}):(.+)$/i.exec(arg);
  if (!match) fail(`--site "${arg}": expected <column>=<room id>:<folder path>.`);
  return { column: match[1].trim(), sourceRoomId: match[2], folderPath: match[3].replace(/^\/+|\/+$/g, "") };
});

const sql = neon(databaseUrl);
const [room] = await sql`select id, name from data_rooms where id = ${args.room}`;
if (!room) fail(`No room ${args.room}.`);

// Every live folder and file in a room by its path.
async function roomPaths(roomId) {
  const [folders, files] = await Promise.all([
    sql`select id, parent_id, name from data_room_folders where room_id = ${roomId}`,
    sql`select id, folder_id, name, blob_pathname from data_room_files where room_id = ${roomId} and deleted_at is null`,
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
  return { folderByPath, fileByPath };
}

const here = await roomPaths(args.room);
const modelPath = args.model.replace(/^\/+/, "");
const modelFile = here.fileByPath.get(modelPath);
if (!modelFile) fail(`No file "${modelPath}" in "${room.name}".`);

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

/** Columns A to H of a sheet, as rows of cells. */
function readSheet(name) {
  const path = sheetPaths.get(name);
  if (!path) fail(`${modelFile.name}: no "${name}" sheet.`);
  const rows = new Map();
  for (const m of part(path).matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = /\br="([A-Z]+)(\d+)"/.exec(m[1]);
    if (!ref || ref[1].length > 1 || ref[1] > "H") continue;
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

  /** The first row from `from` (a row number or the label of one) whose label starts with `text`. */
  const rowOf = (text, from = 0) => {
    const start = typeof from === "number" ? from : rowOf(from);
    const found = numbers.find((r) => r > start && label(r).toLowerCase().startsWith(text.toLowerCase()));
    if (found === undefined) fail(`${modelFile.name}: no "${text}" row on ${name}${start ? ` after row ${start}` : ""}.`);
    return found;
  };
  const cell = (r, col) => rows.get(r)?.get(col);
  /** Rows strictly between two, with their labels. */
  const between = (from, to) => numbers.filter((r) => r > from && r < to && label(r));
  return { rowOf, cell, label, between };
}

const summary = readSheet("Summary");
const inputs = readSheet("Inputs");
const readme = readSheet("Readme");

const num = (value, where) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  fail(`${modelFile.name}: ${where} isn't a number (${JSON.stringify(value)}).`);
};
/** A number, or null where the workbook reads "n/a" or leaves the cell blank. */
const maybe = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const text = (value) => (value == null ? "" : String(value).trim());

/** An Excel date serial as YYYY-MM-DD. */
const isoDate = (serial) => new Date(Math.round((serial - 25569) * 86_400_000)).toISOString().slice(0, 10);

// The site columns, from the header over the key metrics.
const header = summary.rowOf("Key metrics") + 1;
const columns = ["C", "D", "E", "F", "G"].map((col) => ({ col, name: text(summary.cell(header, col)) }));
if (columns.at(-1).name !== "Total") fail(`${modelFile.name}: expected the key metrics' last column to read Total.`);
const siteColumns = columns.slice(0, -1);
const included = siteColumns.filter(({ col }) => num(inputs.cell(inputs.rowOf("Include site in"), col), `Include site (${col})`) === 1);
if (!included.length) fail(`${modelFile.name}: no site is included.`);

for (const s of siteArgs) {
  if (!included.some((c) => c.name === s.column)) {
    fail(`--site ${s.column}: the workbook's included sites are ${included.map((c) => c.name).join(", ")}.`);
  }
  if (!here.folderByPath.has(s.folderPath)) fail(`--site ${s.column}: no folder "${s.folderPath}" in "${room.name}".`);
}

const keyMetrics = summary.rowOf("Key metrics");
const dataCenter = summary.rowOf("Data center company", keyMetrics);
const compute = summary.rowOf("Compute companies", keyMetrics);
const metricsFor = (col) => {
  const at = (label, from) => summary.cell(summary.rowOf(label, from), col);
  const date = (label) => {
    const v = maybe(at(label, keyMetrics));
    return v === null ? null : isoDate(v);
  };
  // The workbook's "critical IT" rows hold the sponsor's facility power (Olds 22 MW is its site power, not IT load).
  return {
    facilityMw: num(at("Critical IT planned", keyMetrics), `facility power (${col})`),
    zodeMw: num(at("First lease: ZODE compute clusters", keyMetrics), `ZODE MW (${col})`),
    thirdPartyMw: num(at("First lease: third-party", keyMetrics), `third-party MW (${col})`),
    clusters: num(at("ZODE compute clusters (4 MW", keyMetrics), `clusters (${col})`),
    firstReady: date("First block ready"),
    lastReady: date("Last block ready"),
    acquisitionAndConversion: num(at("Acquisition and conversion cost", dataCenter), `acquisition and conversion (${col})`),
    runRateNoi: num(at("Run-rate NOI", dataCenter), `NOI (${col})`),
    yieldOnCost: maybe(at("Yield on cost", dataCenter)),
    reDebtPeak: num(at("Real estate debt - peak", dataCenter), `real estate debt (${col})`),
    reDscrMin: maybe(at("Real estate DSCR - minimum", dataCenter)),
    siteEquity: num(at("Equity contributed", dataCenter), `site equity (${col})`),
    unleveredIrr: maybe(at("Unlevered IRR", dataCenter)),
    siteEquityIrr: maybe(at("Equity IRR", dataCenter)),
    siteEquityMultiple: maybe(at("Equity multiple", dataCenter)),
    exitValue: num(at("Value at exit month", dataCenter), `exit value (${col})`),
    gpuHardware: num(at("GPU hardware and setup", compute), `GPU hardware (${col})`),
    prepayments: num(at("Customer prepayments", compute), `prepayments (${col})`),
    gpuDebt: num(at("GPU debt drawn", compute), `GPU debt (${col})`),
    gpuDscrMin: maybe(at("GPU DSCR - minimum", compute)),
    rentPaid: num(at("Rent paid to the data center company", compute), `rent (${col})`),
    computeEquity: num(at("Equity contributed", compute), `compute equity (${col})`),
    computeEquityIrr: maybe(at("Equity IRR", compute)),
    computeEquityMultiple: maybe(at("Equity multiple", compute)),
  };
};

const startDate = isoDate(num(inputs.cell(inputs.rowOf("Model start"), "C"), "model start"));
/** The date of model month `m`, month 1 being the start. */
const monthDate = (m) => {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + m - 1);
  return d.toISOString().slice(0, 10);
};
const input = (label, col, from) => num(inputs.cell(inputs.rowOf(label, from), col), `Inputs "${label}" (${col})`);

const conversionBlocks = inputs.rowOf("Conversion blocks");
const blocks = (basis, col) =>
  [1, 2, 3, 4, 5, 6].map((n) => input(`Block ${n} - critical IT, ${basis}`, col, conversionBlocks));
const termsFor = (col) => {
  const stated = blocks("ZODE-stated", col);
  const firstOptional = input("Expansion option: first block that depends", col, conversionBlocks);
  const expansionMw = firstOptional > 0 ? stated.slice(firstOptional - 1).reduce((a, b) => a + b, 0) : 0;
  return {
    purchasePrice: input("Purchase price", col),
    deposit: input("Non-refundable deposit", col),
    depositDate: monthDate(input("Deposit month", col)),
    closeDate: monthDate(input("Acquisition close month", col)),
    preDevelopment: input("Pre-development costs", col),
    closingCosts: input("Closing and transaction costs", col),
    conversionPerMw: input("Conversion cost ($ per MW", col),
    utilityUpgrade: input("Utility re-energization", col),
    diligenceItMw: blocks("diligence basis", col).reduce((a, b) => a + b, 0),
    expansion: expansionMw
      ? {
          mw: expansionMw,
          included: input("Expansion option: include", col, conversionBlocks) === 1,
          cost: input("Expansion option: upgrade cost ($", col, conversionBlocks),
          note: text(inputs.cell(inputs.rowOf("Expansion option: include", conversionBlocks), "G")),
        }
      : null,
  };
};

const siteSheetAddress = (name) => {
  const sheet = readSheet(name);
  return text(sheet.cell(sheet.rowOf(`${name} site`) + 1, "B"));
};

const sites = included.map(({ col, name }) => {
  const arg = siteArgs.find((s) => s.column === name);
  return {
    name,
    address: siteSheetAddress(name),
    folderId: arg ? here.folderByPath.get(arg.folderPath) : null,
    folderPath: arg?.folderPath ?? null,
    metrics: metricsFor(col),
    terms: termsFor(col),
  };
});

// Shared terms, from the first included site's column.
const first = included[0].col;
const gpuDebtAt = inputs.rowOf("GPU debt (per cluster)");
const reDebtAt = inputs.rowOf("Real estate debt (data center companies)");
const terms = {
  rentPerKwMonth: input("Rent charged to ZODE compute clusters", first),
  contractPricePerGpuHour: input("Contract price ($/GPU-hour)", first),
  contractMonths: input("Contract term (months)", first),
  prepaymentShare: input("Customer prepayment (% of contract value", first),
  gpusPerCluster: input("GPUs per cluster", first),
  pue: input("PUE", first),
  acquisitionLoan: input("Acquisition loan (% of purchase price", first),
  constructionLoan: input("Construction loan on contracted blocks", first),
  reRate: input("Interest rate", first, reDebtAt),
  gpuRate: input("Interest rate", first, gpuDebtAt),
  gpuDscr: input("Minimum DSCR (sizing)", first, gpuDebtAt),
  gpuMaxLtc: input("Maximum loan-to-cost", first, gpuDebtAt),
  exitCapRate: input("Exit cap rate", first),
  exitDate: monthDate(input("Exit month used", first)),
  scheduleDelayMonths: input("Schedule delay", first),
};

// Investor term sets: columns C to E of the table, picked by number.
const termSetsAt = inputs.rowOf("Investor term sets");
const termSet = (n) => {
  const col = ["C", "D", "E"][n - 1];
  if (!col) fail(`${modelFile.name}: no investor term set ${n}.`);
  const at = (label) => input(label, col, termSetsAt);
  return {
    name: text(inputs.cell(termSetsAt, col)).replace(/^\d+\s*/, ""),
    investorShare: at("Investors' share of equity contributions"),
    prefReturn: at("Preferred return"),
    compounds: at("Unpaid preferred return compounds") === 1,
    minMultiple: at("Minimum multiple before any split"),
    shareUntilPaid: at("Investors' share of cash until"),
    tier1Share: at("Investors' share of cash after that (tier 1)"),
    tier1Until: at("Tier 1 applies until"),
    tier2Share: at("Investors' share of cash after that (tier 2)"),
  };
};
const investorsAt = summary.rowOf("Investor returns");
const returnsAfter = (heading, set) => {
  const from = summary.rowOf(heading, investorsAt);
  const at = (label) => summary.cell(summary.rowOf(label, from), "G");
  return {
    terms: termSet(set),
    capital: num(at("Capital contributed"), `${heading} capital`),
    received: num(at("Total received"), `${heading} received`),
    irr: maybe(at("Investor IRR")),
    multiple: maybe(at("Investor multiple")),
    profitShare: num(at("Profit share received"), `${heading} profit share`),
  };
};
const investors = {
  site: returnsAfter("Site investors (data center", input("Term set used for site investors", "C")),
  compute: returnsAfter("Compute investors (ZODE", input("Term set used for compute investors", "C")),
  zodeCoInvest: num(summary.cell(summary.rowOf("ZODE co-investment (both layers)"), "G"), "ZODE co-investment"),
};

// Construction-period sources and uses, the period total in column D.
const suAt = summary.rowOf("Sources and uses");
const lastReadyAt = summary.rowOf("Month number of the last block ready", suAt);
const sourcesAt = summary.rowOf("Sources", suAt);
const usesAt = summary.rowOf("Uses", sourcesAt);
const period = (label, from) => num(summary.cell(summary.rowOf(label, from), "D"), `sources and uses "${label}"`);
const stripNote = (label) => label.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*:\s*$/, "");
const sourcesAndUses = {
  through: maybe(summary.cell(lastReadyAt, "D")) === null ? null : isoDate(summary.cell(lastReadyAt, "D")),
  sources: {
    siteEquity: period("Equity into the site companies", sourcesAt),
    computeEquity: period("Equity into the compute companies", sourcesAt),
    reDebt: period("Real estate debt drawn", sourcesAt),
    gpuDebt: period("GPU debt drawn", sourcesAt),
    prepayments: period("Customer prepayments received", sourcesAt),
    operating: period("Operating cash flow", sourcesAt),
    other: period("Other:", sourcesAt),
  },
  uses: summary
    .between(usesAt, summary.rowOf("Total uses", usesAt))
    .map((r) => ({ label: stripNote(summary.label(r)), amount: num(summary.cell(r, "D"), `uses row ${r}`) })),
};
const totalSources = Object.values(sourcesAndUses.sources).reduce((a, b) => a + b, 0);
const totalUses = sourcesAndUses.uses.reduce((a, b) => a + b.amount, 0);
if (Math.abs(totalSources - totalUses) > 1) fail(`${modelFile.name}: sources (${totalSources}) and uses (${totalUses}) don't balance.`);

// The stored downside, base and upside cases.
const FORMATS = [
  [/months|delay/i, "months"],
  [/\$ per MW/i, "usdPerMw"],
  [/\$\/kW-month/i, "kwMonth"],
  [/\$\/GPU-hour/i, "gpuHour"],
  [/\(MW\)/i, "mw"],
  [/capital \(\$M\)/i, "usd"],
  [/multiple|DSCR/i, "x"],
  [/./, "pct"],
];
const formatOf = (label) => FORMATS.find(([pattern]) => pattern.test(label))[1];
const casesAt = summary.rowOf("Downside, base and upside cases");
const sameAt = summary.rowOf("Same in every case", casesAt);
const resultsAt = summary.rowOf("Results", casesAt);
const caseRows = (rows) =>
  rows.map((r) => {
    const label = summary.label(r);
    return {
      label: stripNote(label),
      format: formatOf(label),
      values: ["C", "D", "E"].map((col) => num(summary.cell(r, col), `case "${label}" (${col})`)),
    };
  });
const resultRows = summary.between(resultsAt, summary.rowOf("Site investors:", resultsAt));
const cases = {
  title: text(summary.label(casesAt)).replace(/\s*\(stored values.*$/i, ""),
  facilityMw: num(summary.cell(resultRows[0], "D"), "case facility power"),
  assumptions: caseRows(summary.between(summary.rowOf("Assumption", casesAt), sameAt)),
  results: caseRows(resultRows.slice(1)),
  notes: [summary.label(sameAt), summary.label(summary.rowOf("Site investors:", resultsAt))],
};

const exitsAt = summary.rowOf("Exit comparison");
const exitsEnd = summary.rowOf("Compute investors are unaffected", exitsAt);
const exits = {
  rows: summary.between(summary.rowOf("Exit for site investors", exitsAt), exitsEnd).map((r) => ({
    label: summary.label(r),
    siteIrr: num(summary.cell(r, "C"), `exit row ${r}`),
    siteMultiple: num(summary.cell(r, "D"), `exit row ${r}`),
    computeIrr: num(summary.cell(r, "F"), `exit row ${r}`),
    minReDscr: num(summary.cell(r, "G"), `exit row ${r}`),
  })),
  note: summary.label(exitsEnd),
};

const debtAt = summary.rowOf("Construction debt - what is achievable");
const debtEnd = summary.rowOf("All cases keep", debtAt);
const debtSizing = {
  rows: summary.between(summary.rowOf("Construction loan sizing", debtAt), debtEnd).map((r) => ({
    label: summary.label(r),
    siteCapital: num(summary.cell(r, "C"), `debt row ${r}`),
    reDebtPeak: num(summary.cell(r, "D"), `debt row ${r}`),
    siteIrr: num(summary.cell(r, "E"), `debt row ${r}`),
    siteMultiple: num(summary.cell(r, "F"), `debt row ${r}`),
    minReDscr: num(summary.cell(r, "G"), `debt row ${r}`),
  })),
  note: summary.label(debtEnd),
};

const prepared = text(readme.cell(readme.rowOf("About this model"), "C"));
const portfolio = {
  model: {
    name: modelFile.name,
    fileId: modelFile.id,
    path: modelPath,
    title: summary.label(summary.rowOf("ZODE")).replace(/\s*-\s*financial summary$/i, ""),
    description: summary.label(summary.rowOf("Two layers")),
    prepared: prepared.split(/(?<=\.)\s/)[0] ?? prepared,
    caseLine: summary.label(summary.rowOf("Base case")),
    start: startDate,
  },
  sites,
  total: metricsFor("G"),
  terms,
  sourcesAndUses,
  investors,
  cases,
  exits,
  debtSizing,
};

// Each site's room summary, its sources re-pointed at their copies here.
const folderSummaries = [];
for (const s of siteArgs) {
  const [source] = await sql`
    select s.diligence, s.economics, coalesce(s.kind, r.kind) as kind, r.name
    from data_room_summaries s join data_rooms r on r.id = s.room_id
    where s.room_id = ${s.sourceRoomId} and s.folder_id is null and s.layout = 'site'
  `;
  if (!source) {
    console.warn(`[portfolio] ${s.column}: room ${s.sourceRoomId} has no summary; its folder gets none.`);
    continue;
  }
  const unresolved = [];
  const repoint = (value) => {
    if (Array.isArray(value)) return value.map(repoint);
    if (!value || typeof value !== "object") return value;
    if (typeof value.path === "string" && typeof value.fileId === "string") {
      const path = `${s.folderPath}/${value.path.replace(/^\/+/, "")}`;
      const file = here.fileByPath.get(path);
      if (!file) unresolved.push(path);
      return { path, fileId: file?.id ?? value.fileId };
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, repoint(v)]));
  };
  const diligence = repoint(source.diligence);
  const economics = repoint(source.economics);
  if (unresolved.length) {
    for (const path of unresolved) console.error(`  not in "${room.name}": ${path}`);
    fail(`${s.column}: ${unresolved.length} cited file(s) from "${source.name}" have no copy here.`);
  }
  folderSummaries.push({ ...s, folderId: here.folderByPath.get(s.folderPath), kind: source.kind, from: source.name, diligence, economics });
}

const t = portfolio.total;
console.log(
  `[portfolio] "${room.name}" from ${modelFile.name}: ${sites.map((s) => `${s.name} ${s.metrics.facilityMw} MW`).join(", ")}, ` +
    `${t.facilityMw} MW facility power in total; ${cases.facilityMw} MW stored cases; sources and uses balance at $${(totalSources / 1e6).toFixed(1)}M.`,
);
for (const f of folderSummaries) console.log(`[portfolio] ${f.folderPath}: the ${f.kind} summary from "${f.from}", every source resolved.`);
if (args.out) {
  await writeFile(args.out.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"), `${JSON.stringify(portfolio, null, 2)}\n`);
  console.log(`[portfolio] saved what the workbook gave to ${args.out}.`);
}

if (args["dry-run"]) {
  console.log("[portfolio] dry run: nothing written.");
  process.exit(0);
}

const by = args.as.trim().toLowerCase();
await sql.transaction([
  sql`
    insert into data_room_summaries (room_id, folder_id, layout, kind, diligence, economics, updated_by_email)
    values (${args.room}, null, 'portfolio', null, '{}'::jsonb, ${JSON.stringify(portfolio)}::jsonb, ${by})
    on conflict (room_id, folder_id) do update
      set layout = excluded.layout, kind = excluded.kind, diligence = excluded.diligence, economics = excluded.economics,
          updated_at = now(), updated_by_email = excluded.updated_by_email
  `,
  ...folderSummaries.map(
    (f) => sql`
      insert into data_room_summaries (room_id, folder_id, layout, kind, diligence, economics, updated_by_email)
      values (${args.room}, ${f.folderId}, 'site', ${f.kind}, ${JSON.stringify(f.diligence)}::jsonb, ${JSON.stringify(f.economics)}::jsonb, ${by})
      on conflict (room_id, folder_id) do update
        set layout = excluded.layout, kind = excluded.kind, diligence = excluded.diligence, economics = excluded.economics,
            updated_at = now(), updated_by_email = excluded.updated_by_email
    `,
  ),
]);
console.log(`[portfolio] wrote ${1 + folderSummaries.length} summaries for "${room.name}" to ${new URL(databaseUrl).hostname}.`);
