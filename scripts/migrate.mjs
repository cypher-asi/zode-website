/**
 * Applies db/schema.sql to the database in DATABASE_URL.
 *
 * Runs before every build (see `prebuild` in package.json), so each Vercel
 * deployment brings its own Neon branch up to date. Locally it reads
 * .env.local; with no DATABASE_URL it skips, except on Vercel, where a
 * missing database must fail the build rather than ship a site that can't
 * take orders.
 */
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;

if (!url) {
  if (process.env.VERCEL) {
    console.error("[migrate] DATABASE_URL is not set; connect the Neon integration to this environment.");
    process.exit(1);
  }
  console.warn("[migrate] DATABASE_URL is not set; skipping.");
  process.exit(0);
}

const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");

/** The HTTP driver runs one statement per query; semicolons inside `$$` function bodies don't end one. */
function splitStatements(text) {
  const statements = [];
  let current = "";
  let inBody = false;
  for (const part of text.split(/(\$\$|;)/)) {
    if (part === "$$") inBody = !inBody;
    if (part === ";" && !inBody) {
      statements.push(current);
      current = "";
    } else {
      current += part;
    }
  }
  statements.push(current);
  return statements.map((s) => s.trim()).filter(Boolean);
}

const statements = splitStatements(schema.replace(/--.*$/gm, ""));

const sql = neon(url);
for (const statement of statements) {
  await sql.query(statement);
}

console.log(`[migrate] applied ${statements.length} statements to ${new URL(url).hostname}`);
