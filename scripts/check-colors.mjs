/**
 * Fails when a hex colour appears in src outside the files allowed to hold
 * one, so new UI reaches for the tokens in src/app/globals.css instead.
 *
 * Runs as part of `npm run lint`. A file belongs in ALLOWED only when its
 * colours can't be tokens: the token sheet itself, artwork, or output that
 * can't read CSS variables (email, the generated favicon).
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;

const ALLOWED = new Map([
  ["src/app/globals.css", "the colour tokens"],
  ["src/lib/monogramImage.tsx", "generated favicon and link-preview image"],
  ["src/emails/ui.tsx", "email palette; mail clients can't read CSS variables"],
  ["src/features/styleguide/brand.ts", "the published palette, checked against globals.css"],
  ["src/features/data-room/icons.tsx", "file-type icon palette"],
  ["src/components/layout/PinnedHeader/PinnedHeader.tsx", "black in an alpha mask"],
  ["src/components/layout/ShellBackdrop/ShellBackdrop.module.css", "backdrop artwork"],
  ["src/features/zode-drawings/lineArt.module.css", "drawing shades"],
  ["src/features/home/why-zode/Features.module.css", "diagram artwork"],
  ["src/features/home/stack/FullStack.module.css", "diagram artwork"],
  ["src/features/home/principles/Principles.module.css", "diagram artwork"],
  ["src/features/home/network/Network.module.css", "map artwork"],
  ["src/features/data-room/DataRoomApp.module.css", "folder glyph"],
  ["src/features/cluster/scene/palette.ts", "fabric rail colours, shared by WebGL and the legend"],
]);

const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;
const EXTENSIONS = /\.(css|tsx?|jsx?|mjs)$/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (EXTENSIONS.test(entry.name)) yield path;
  }
}

const problems = [];

for await (const path of walk(join(ROOT, "src"))) {
  const file = relative(ROOT, path);
  if (ALLOWED.has(file)) continue;
  const lines = (await readFile(path, "utf8")).split("\n");
  lines.forEach((line, i) => {
    for (const match of line.matchAll(HEX)) {
      problems.push(`${file}:${i + 1}  ${match[0]}`);
    }
  });
}

if (problems.length) {
  console.error("Hex colours outside the token files; use a var(--color-*) token from src/app/globals.css:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
