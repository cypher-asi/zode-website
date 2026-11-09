/**
 * Writes a project folder's summary from one deployment of a ZODE Colo
 * workbook in the room:
 *
 *   node --env-file=.env.production.local scripts/write-colo-summary.mjs \
 *     --room <room id> --folder "02 ZODE TORONTO" \
 *     --model "02 ZODE TORONTO/01 Model/ZODE_Colo_I_Model_26.10.25.xlsx" --deployment Mississauga \
 *     [--as n3o@zero.tech] [--out colo.json] [--dry-run]
 *
 * The workbook is a ZODE Colo model: Readme, Summary, Inputs, then one tab per
 * deployment of GPU compute companies in leased colocation space. Its cached
 * values are read by their row labels in column B, so rows can move between
 * versions; a label that's missing fails the run rather than writing a gap.
 * `--deployment` names the Summary and Inputs column the folder holds; the
 * summary shows that deployment's results and terms, and the program it's
 * pooled in for context. `--out` also saves what was read, to check it by eye.
 */
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { neon } from "@neondatabase/serverless";
import { get } from "@vercel/blob";
import { strFromU8, unzipSync } from "fflate";

const { values: args } = parseArgs({
  options: {
    room: { type: "string" },
    folder: { type: "string" },
    model: { type: "string" },
    deployment: { type: "string" },
    as: { type: "string", default: "n3o@zero.tech" },
    out: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`[colo] ${message}`);
  process.exit(1);
};

if (!args.room) fail("--room is required.");
if (!args.folder) fail("--folder is required (the project folder the summary heads).");
if (!args.model) fail("--model is required (the workbook's path in the room).");
if (!args.deployment) fail("--deployment is required (the workbook's column for the folder's deployment).");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set.");
if (!process.env.BLOB_READ_WRITE_TOKEN) fail("BLOB_READ_WRITE_TOKEN is not set.");

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

const folderPath = args.folder.trim().replace(/^\/+|\/+$/g, "");
const folderId = folderByPath.get(folderPath);
if (!folderId) fail(`No folder "${folderPath}" in "${room.name}".`);
const modelPath = args.model.replace(/^\/+/, "");
const modelFile = fileByPath.get(modelPath);
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
const inputs = readSheet("Inputs");
const readme = readSheet("Readme");
const name = args.deployment.trim();
if (!sheetPaths.has(name)) fail(`${modelFile.name}: no "${name}" tab for the deployment.`);
const tab = readSheet(name);

const num = (value, where) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  fail(`${modelFile.name}: ${where} isn't a number (${JSON.stringify(value)}).`);
};
/** A number, or null where the workbook reads "n.m." or "n/a" or leaves the cell blank. */
const maybe = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const text = (value) => (value == null ? "" : String(value).trim());
const firstSentence = (value) => text(value).split(/(?<=\.)\s/)[0] ?? text(value);
/** An Excel date serial as YYYY-MM-DD. */
const isoDate = (serial) => new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
/** The column in row `r` that reads `heading`. */
const columnOf = (sheet, r, heading) => {
  const col = sheet.columnsOf(r).find((c) => text(sheet.cell(r, c)) === heading);
  if (!col) fail(`${modelFile.name}: no "${heading}" column in row ${r}.`);
  return col;
};

// Summary: key metrics, one column per deployment, then Total.
const header = summary.next(summary.rowOf("Key metrics"));
const columns = summary
  .columnsOf(header)
  .filter((col) => col !== "B")
  .map((col) => ({ col, name: text(summary.cell(header, col)) }));
if (columns.at(-1)?.name !== "Total") fail(`${modelFile.name}: expected the key metrics' last column to read Total.`);
const deployments = columns.slice(0, -1);
const col = deployments.find((d) => d.name === name)?.col;
if (!col) fail(`--deployment ${name}: the workbook's deployments are ${deployments.map((d) => d.name).join(", ")}.`);
const totalCol = columns.at(-1).col;

const metricRow = (label) => summary.rowOf(label, header);
const metrics = (c) => {
  const at = (label) => num(summary.cell(metricRow(label), c), `${label} (${c})`);
  const peak = metricRow("Equity needed - peak");
  const peakMonth = metricRow("Month of peak equity need");
  return {
    criticalItMw: at("Critical IT"),
    clusters: at("GPU clusters"),
    signedClusters: at("of which with a signed customer contract"),
    gpus: at("GPUs"),
    firstInService: isoDate(at("First cluster in service")),
    lastInService: isoDate(at("Last cluster in service")),
    contractValue: at("Contract value"),
    prepayments: at("Customer prepayments"),
    lifetimeRevenue: at("Revenue over the life"),
    leaseUpfront: at("Lease NRCs and upfront payments"),
    gpuHardware: at("GPU hardware, spares, tax and setup"),
    gpuDebt: at("GPU debt drawn"),
    gpuDscrMin: maybe(summary.cell(metricRow("GPU DSCR - minimum"), c)),
    receivablePeak: at("Receivable loan - peak balance"),
    peakEquity: at("Equity needed - peak"),
    peakEquityDate: isoDate(at("Month of peak equity need")),
    equityBy: summary
      .between(peak, peakMonth)
      .filter((r) => summary.label(r).startsWith("Equity needed by "))
      .map((r) => ({ label: summary.label(r).replace(/^Equity needed by /, ""), amount: num(summary.cell(r, c), `row ${r} (${c})`) })),
    unleveredIrr: maybe(summary.cell(metricRow("Unlevered IRR"), c)),
    equityIrr: maybe(summary.cell(metricRow("Equity IRR"), c)),
    equityMultiple: maybe(summary.cell(metricRow("Equity multiple"), c)),
    netCash: at("Net cash after equity"),
  };
};

// Inputs: one column per deployment under the Timeline heading.
const inputCol = columnOf(inputs, inputs.rowOf("Timeline"), name);
const input = (label, from = 0) => num(inputs.cell(inputs.rowOf(label, from), inputCol), `Inputs "${label}" (${inputCol})`);
const modelStart = new Date(Date.UTC(1899, 11, 30) + input("Model start") * 86_400_000);
/** Model month `m` (1 = the first) as YYYY-MM-DD. */
const monthDate = (m) =>
  new Date(Date.UTC(modelStart.getUTCFullYear(), modelStart.getUTCMonth() + m - 1, 1)).toISOString().slice(0, 10);

// The deployment's tab: its cluster schedule and its annual summary.
const schedule = tab.next(tab.rowOf("Cluster schedule"));
const scheduleCol = (heading) => {
  const c = tab.columnsOf(schedule).find((x) => text(tab.cell(schedule, x)).startsWith(heading));
  if (!c) fail(`${modelFile.name}: no "${heading}" column in ${name}'s cluster schedule.`);
  return c;
};
const sc = {
  nodes: scheduleCol("Nodes"),
  contract: scheduleCol("Contract"),
  included: scheduleCol("Included"),
  mw: scheduleCol("MW critical"),
  gpus: scheduleCol("GPUs"),
  inService: scheduleCol("In service"),
};
const clusters = tab
  .between(schedule)
  .filter((r) => /^Cluster \d+$/.test(tab.label(r)))
  .filter((r) => tab.cell(r, sc.included) === 1 && maybe(tab.cell(r, sc.nodes)) > 0)
  .map((r) => ({
    name: tab.label(r),
    nodes: num(tab.cell(r, sc.nodes), `${name} ${tab.label(r)} nodes`),
    gpus: num(tab.cell(r, sc.gpus), `${name} ${tab.label(r)} GPUs`),
    criticalItMw: num(tab.cell(r, sc.mw), `${name} ${tab.label(r)} MW`),
    signed: tab.cell(r, sc.contract) === 1,
    inService: monthDate(num(tab.cell(r, sc.inService), `${name} ${tab.label(r)} in service`)),
  }));
const deploymentMetrics = metrics(col);
if (clusters.length !== deploymentMetrics.clusters) {
  fail(`${modelFile.name}: ${name}'s schedule has ${clusters.length} clusters, Summary ${deploymentMetrics.clusters}.`);
}
if (clusters[0]?.inService !== deploymentMetrics.firstInService) {
  fail(`${modelFile.name}: ${name}'s first cluster is in service ${clusters[0]?.inService}, Summary ${deploymentMetrics.firstInService}.`);
}

const annualHead = tab.next(tab.rowOf("Annual summary"));
const annualTotal = columnOf(tab, annualHead, "Total");
const annualCols = tab.columnsOf(annualHead).filter((c) => typeof tab.cell(annualHead, c) === "number");
const annualRows = tab
  .between(annualHead, tab.rowOf("Cluster schedule"))
  .filter((r) => !/\(MW\)|DSCR/.test(tab.label(r)))
  .map((r) => ({
    label: tab.label(r),
    total: maybe(tab.cell(r, annualTotal)),
    values: annualCols.map((c) => maybe(tab.cell(r, c)) ?? 0),
  }))
  .filter((r) => (r.total ?? 0) !== 0 || r.values.some((v) => v !== 0));

// Stored raise cases that take in the deployment.
const casesHead = summary.next(summary.rowOf("What the raise has to cover"));
const caseCols = summary.columnsOf(casesHead).filter((c) => c !== "B");
const head = caseCols.map((c) => {
  const heading = text(summary.cell(casesHead, c));
  const format = /\(MW\)/.test(heading)
    ? "mw"
    : /\(\$M\)/.test(heading)
      ? "usd"
      : /IRR|%/.test(heading)
        ? "pct"
        : /multiple/i.test(heading)
          ? "x"
          : null;
  if (!format) fail(`${modelFile.name}: can't tell the units of the raise cases' "${heading}" column.`);
  return { label: heading.replace(/\s*\((MW|\$M)\)\s*/, " ").trim(), format };
});
const cases = {
  head,
  rows: summary
    .between(casesHead, summary.rowOf("Investor terms and exit"))
    .filter((r) => summary.label(r).includes(name) && caseCols.some((c) => summary.cell(r, c) !== undefined))
    .map((r) => ({ label: summary.label(r), values: caseCols.map((c) => maybe(summary.cell(r, c))) })),
};
if (!cases.rows.length) fail(`${modelFile.name}: no stored raise case names ${name}.`);

// The program's pooled investors.
const investorRow = (label) => summary.rowOf(label, "Investor returns");
const investors = {
  termSet: text(summary.cell(investorRow("Term set applied"), totalCol)),
  capital: num(summary.cell(investorRow("Capital contributed"), totalCol), "investor capital"),
  received: num(summary.cell(investorRow("Total received"), totalCol), "investors received"),
  irr: maybe(summary.cell(investorRow("Investor IRR"), totalCol)),
  multiple: maybe(summary.cell(investorRow("Investor multiple"), totalCol)),
  firstCash: isoDate(num(summary.cell(investorRow("First month investors receive cash"), totalCol), "investors' first cash")),
};

const readmeText = (label) => text(readme.cell(readme.rowOf(label), "C"));
const title = summary.label(summary.rowOf("ZODE"));
const coloModel = {
  model: {
    name: modelFile.name,
    fileId: modelFile.id,
    path: modelPath,
    title: title.replace(/\s*-\s*financial summary$/i, ""),
    prepared: firstSentence(readmeText("About this model")),
    caseLine: summary.label(summary.rowOf("Base case")),
  },
  deployment: {
    name,
    description: tab.label(tab.next(tab.rowOf(name))),
    metrics: deploymentMetrics,
    clusters,
    lease: {
      baseRent: input("Base rent"),
      nnn: input("NNN pass-through"),
      operations: input("Facility operations"),
      electricity: input("Delivered electricity"),
      pue: input("PUE"),
      escalation: input("Annual escalation"),
      nrc: input("Lease NRC / upfront"),
      legal: input("Upfront legal and structuring"),
      salesTax: input("Sales / use tax"),
    },
    contract: {
      price: input("Contract price", "Signed customer contracts"),
      months: input("Contract term", "Signed customer contracts"),
      prepayment: input("Customer prepayment", "Signed customer contracts"),
    },
    target: {
      price: input("Contract price", "Clusters without a signed contract"),
      months: input("Contract term", "Clusters without a signed contract"),
      prepayment: input("Customer prepayment", "Clusters without a signed contract"),
    },
    gpu: {
      serverCost: input("Server cost"),
      gpusPerNode: input("GPUs per node"),
      networking: input("Networking / storage add-on"),
      deposit: input("GPU order deposit"),
      rate: input("Interest rate", "GPU debt"),
      tenorMonths: input("Tenor", "GPU debt"),
      dscr: input("Minimum DSCR", "GPU debt"),
      maxLtc: input("Maximum loan-to-cost", "GPU debt"),
      reserve: input("Debt service reserve", "GPU debt"),
    },
    after: {
      months: input("Year-5 operation"),
      price: input("Year-5 price"),
      utilization: input("Year-5 utilization"),
      resale: input("Hardware resale"),
    },
    annual: {
      note: tab.label(annualHead),
      years: annualCols.map((c) => tab.cell(annualHead, c)),
      rows: annualRows,
    },
  },
  program: {
    description: summary.label(summary.next(summary.rowOf("ZODE"))),
    deployments: deployments.map((d) => {
      const m = metrics(d.col);
      return { name: d.name, criticalItMw: m.criticalItMw, clusters: m.clusters, unleveredIrr: m.unleveredIrr, peakEquity: m.peakEquity };
    }),
    total: metrics(totalCol),
    investors,
  },
  cases,
  // Caveats that name only another deployment stay with that one.
  notes: readmeText("Key caveats")
    .split(/\s*\d\)\s*/)
    .map((s) => s.trim())
    .filter((s) => s && (s.includes(name) || !deployments.some((d) => d.name !== name && s.includes(d.name)))),
};

const m = deploymentMetrics;
console.log(
  `[colo] "${room.name}" ${folderPath} from ${modelFile.name}, ${name}: ${m.criticalItMw} MW, ${clusters.length} clusters, ` +
    `$${(m.contractValue / 1e6).toFixed(1)}M contracts, $${(m.peakEquity / 1e6).toFixed(2)}M peak equity; ` +
    `${cases.rows.length} raise cases, ${annualRows.length} annual rows.`,
);
if (args.out) {
  await writeFile(args.out.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"), `${JSON.stringify(coloModel, null, 2)}\n`);
  console.log(`[colo] saved what the workbook gave to ${args.out}.`);
}

if (args["dry-run"]) {
  console.log("[colo] dry run: nothing written.");
  process.exit(0);
}

const by = args.as.trim().toLowerCase();
await sql`
  insert into data_room_summaries (room_id, folder_id, layout, kind, diligence, economics, updated_by_email)
  values (${args.room}, ${folderId}, 'colo', null, '{}'::jsonb, ${JSON.stringify(coloModel)}::jsonb, ${by})
  on conflict (room_id, folder_id) do update
    set layout = excluded.layout, kind = excluded.kind, diligence = excluded.diligence, economics = excluded.economics,
        updated_at = now(), updated_by_email = excluded.updated_by_email
`;
console.log(`[colo] wrote the summary of "${room.name}/${folderPath}" to ${new URL(databaseUrl).hostname}.`);
