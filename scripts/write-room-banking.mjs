/**
 * Writes a data room's Banking Info, where to send its funds, from a JSON file:
 *
 *   node --env-file=.env.production.local scripts/write-room-banking.mjs \
 *     --room <room id> --file ~/Downloads/banking.json [--as n3o@zero.tech] [--dry-run]
 *
 * Pass `--room-name "ZODE ASCENT"` in place of `--room` to find the room by
 * its name, which must be unique. The file holds:
 *
 *   {
 *     "account": { "label": "Commercial Checking", "accountNumber": "37211496110495" },
 *     "domestic": { "beneficiaryName": "Zode, Inc.", "accountType": "Checking", "routingNumber": "044016018",
 *                   "bankName": "Erebor Bank, NA", "bankAddress": ["500 Neil Ave, Suite 140", "Columbus, OH 43215"] },
 *     "international": { "bankName": "Erebor Bank, NA", "swift": "ERNAUS33",
 *                        "bankAddress": ["500 Neil Ave, Suite 140", "Columbus, OH 43215"],
 *                        "beneficiaryName": "Zode, Inc.", "beneficiaryAddress": ["1013 Centre Road", "Wilmington, DE 19805"] },
 *     "stablecoin": { "coin": "USDC", "network": "Ethereum", "address": "0x..." }
 *   }
 *
 * The room shows it to everyone who can open it, public links included.
 * A rewrite replaces what was there.
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { neon } from "@neondatabase/serverless";

const SHAPE = {
  account: ["label", "accountNumber"],
  domestic: ["beneficiaryName", "accountType", "routingNumber", "bankName", "bankAddress"],
  international: ["bankName", "swift", "bankAddress", "beneficiaryName", "beneficiaryAddress"],
  stablecoin: ["coin", "network", "address"],
};
const ADDRESSES = new Set(["bankAddress", "beneficiaryAddress"]);

const { values: args } = parseArgs({
  options: {
    room: { type: "string" },
    "room-name": { type: "string" },
    file: { type: "string" },
    as: { type: "string", default: "n3o@zero.tech" },
    "dry-run": { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`[banking] ${message}`);
  process.exit(1);
};

if (!args.room === !args["room-name"]) fail("Pass --room <id> or --room-name <name>.");
if (!args.file) fail("--file is required.");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set.");

const sql = neon(databaseUrl);
const rooms = args.room
  ? await sql`select id, name from data_rooms where id = ${args.room}`
  : await sql`select id, name from data_rooms where name = ${args["room-name"]}`;
if (rooms.length !== 1) fail(`${rooms.length} rooms match ${args.room ?? `"${args["room-name"]}"`}, not 1.`);
const [room] = rooms;

const input = JSON.parse(await readFile(args.file.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"), "utf8"));
const problems = [];
const details = {};

const extra = Object.keys(input).filter((key) => !(key in SHAPE));
if (extra.length) problems.push(`unknown ${extra.join(", ")}`);
for (const [group, keys] of Object.entries(SHAPE)) {
  const given = input[group] ?? {};
  const unknown = Object.keys(given).filter((key) => !keys.includes(key));
  if (unknown.length) problems.push(`${group}: unknown ${unknown.join(", ")}`);
  details[group] = {};
  for (const key of keys) {
    const value = given[key];
    const where = `${group}.${key}`;
    if (ADDRESSES.has(key)) {
      const lines = Array.isArray(value) ? value.map((line) => (typeof line === "string" ? line.trim() : "")) : [];
      if (!lines.length || lines.some((line) => !line)) problems.push(`${where}: expected a list of address lines`);
      details[group][key] = lines;
    } else if (typeof value !== "string" || !value.trim()) {
      problems.push(`${where}: expected text`);
    } else {
      details[group][key] = value.trim();
    }
  }
}

const { account, domestic, international, stablecoin } = details;
if (account.accountNumber && !/^\d{4,17}$/.test(account.accountNumber)) problems.push("account.accountNumber: 4 to 17 digits");
if (domestic.routingNumber && !/^\d{9}$/.test(domestic.routingNumber)) problems.push("domestic.routingNumber: 9 digits");
if (international.swift && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(international.swift)) {
  problems.push("international.swift: 8 or 11 capital letters and digits");
}
if (stablecoin.address && !/^0x[0-9a-fA-F]{40}$/.test(stablecoin.address)) {
  problems.push("stablecoin.address: 0x and 40 hex digits");
}

if (problems.length) {
  for (const problem of problems) console.error(`  ${problem}`);
  fail(`${problems.length} problem(s) in ${args.file}.`);
}

console.log(
  `[banking] "${room.name}" (${room.id}): ${account.label} •••• ${account.accountNumber.slice(-4)}, ` +
    `routing ${domestic.routingNumber}, SWIFT ${international.swift}, ${stablecoin.coin} on ${stablecoin.network}.`,
);

if (args["dry-run"]) {
  console.log("[banking] dry run: nothing written.");
  process.exit(0);
}

await sql`
  insert into data_room_banking (room_id, details, updated_by_email)
  values (${room.id}, ${JSON.stringify(details)}::jsonb, ${args.as.trim().toLowerCase()})
  on conflict (room_id) do update
    set details = excluded.details, updated_at = now(), updated_by_email = excluded.updated_by_email
`;
console.log(`[banking] wrote Banking Info for "${room.name}" to ${new URL(databaseUrl).hostname}.`);
