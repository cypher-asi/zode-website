/**
 * Fails when the published brand tokens (src/features/styleguide/brand.ts,
 * served at /styleguide and /brand/tokens.*) disagree with the tokens the
 * site actually uses (src/app/globals.css). Runs as part of `npm run lint`.
 */
import { readFile } from "node:fs/promises";
import { TOKEN_SECTIONS } from "../src/features/styleguide/brand.ts";

const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf("\n}\n", css.indexOf(":root {")));

const defined = new Map();
for (const [, name, value] of root.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
  defined.set(name, value.replace(/\s+/g, " ").trim());
}

/** Follows `var(--x)` references down to a literal. */
function resolve(value, seen = new Set()) {
  return value.replace(/var\((--[a-z0-9-]+)\)/g, (match, name) => {
    if (seen.has(name) || !defined.has(name)) return match;
    return resolve(defined.get(name), new Set([...seen, name]));
  });
}

const normalize = (value) => value.toLowerCase().replace(/\s+/g, " ").trim();
const problems = [];

for (const section of TOKEN_SECTIONS) {
  for (const { token, value } of section.tokens) {
    if (!defined.has(token)) {
      problems.push(`${token} is published but not defined in globals.css`);
      continue;
    }
    const actual = resolve(defined.get(token));
    if (normalize(actual) !== normalize(value)) {
      problems.push(`${token}: globals.css has "${actual}", brand.ts publishes "${value}"`);
    }
  }
}

if (problems.length) {
  console.error("Published brand tokens are out of step with src/app/globals.css:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
