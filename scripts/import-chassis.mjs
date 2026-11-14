/**
 * Adds NIRA Chassis I, as its drawing set was issued (src/features/chassis/seed,
 * from the zode pod designer's data), to DATABASE_URL as a design in the
 * portal's Chassis app, at version 1. Re-runnable: the design is matched on
 * `seed_key` and left alone once imported, so edits made in the app stay.
 * `--dry-run` checks the seed and writes nothing.
 *
 *   npm run chassis:import                                                     (dev)
 *   node --env-file=.env.production.local scripts/import-chassis.mjs           (production)
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import "./chassis-hooks.mjs";

const SEED_KEY = "nira-chassis-i-rev-30";
const DRY_RUN = process.argv.includes("--dry-run");

const { seedDesign } = await import("../src/features/chassis/model/seed.ts");
const { derive } = await import("../src/features/chassis/model/calc.ts");

const derived = derive(seedDesign);
const failing = derived.checks.filter((check) => check.status === "fail");
const money = (v) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
console.log(
  `[chassis:import] ${seedDesign.project.name} REV ${seedDesign.project.revision}: ${seedDesign.sheets.sheets.length} sheets, ` +
    `${seedDesign.parts.parts.length} parts, ${derived.bom.lines.length} BOM lines, ${money(derived.bom.total)}, ` +
    `${failing.length} failing checks`,
);

if (DRY_RUN) process.exit(0);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[chassis:import] DATABASE_URL must be set.");
  process.exit(1);
}
const sql = neon(url);

const [existing] = await sql`select id, name, version from chassis_designs where seed_key = ${SEED_KEY}`;
if (existing) {
  console.log(`[chassis:import] already imported as "${existing.name}" (${existing.id}), at version ${existing.version}.`);
  process.exit(0);
}

const id = randomUUID();
const name = "NIRA Chassis I";
await sql.transaction([
  sql`insert into chassis_designs (id, name, version, seed_key) values (${id}, ${name}, 1, ${SEED_KEY})`,
  sql`
    insert into chassis_design_versions (design_id, version, data, note)
    values (${id}, 1, ${JSON.stringify(seedDesign)}::jsonb, ${`Imported as issued: REV ${seedDesign.project.revision}, ${seedDesign.project.date}.`})
  `,
]);
console.log(`[chassis:import] imported "${name}" as ${id}: /portal/chassis/${id}`);
