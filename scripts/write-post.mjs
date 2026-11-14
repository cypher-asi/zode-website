/**
 * Writes a news or changelog draft from a Markdown file:
 *
 *   node --env-file=.env.production.local scripts/write-post.mjs \
 *     --file scripts/posts/the-industrialization-of-intelligence.md [--post <id>] [--as n3o@zero.tech] [--dry-run]
 *
 * The file opens with a front matter block of `title`, `slug` and `summary`
 * (and `kind`, news by default), then the body. `--post` names the draft to
 * fill, such as one made with New post in the portal; without it, the draft
 * with the file's slug is rewritten, or a new one is made, credited to the
 * account behind `--as` (taken from a post it already wrote).
 *
 * A published post is never touched, so this can't change what the site
 * shows. Publish from the portal, which dates the post.
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { neon } from "@neondatabase/serverless";

const { values: args } = parseArgs({
  options: {
    file: { type: "string" },
    post: { type: "string" },
    as: { type: "string", default: "n3o@zero.tech" },
    "dry-run": { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`[post] ${message}`);
  process.exit(1);
};

if (!args.file) fail("--file is required.");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set.");

const source = await readFile(args.file.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"), "utf8");
const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
if (!match) fail(`${args.file} has no front matter.`);
const meta = Object.fromEntries(
  match[1].split("\n").map((line) => {
    const at = line.indexOf(":");
    return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
  }),
);
const kind = meta.kind || "news";
const { title, slug, summary = "" } = meta;
const body = source.slice(match[0].length).trim();

if (!["news", "changelog"].includes(kind)) fail(`kind must be news or changelog, not "${kind}".`);
if (!title || title.length > 160) fail("title is required, at most 160 characters.");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug ?? "")) fail("slug must be lowercase words joined by hyphens.");
if (!body) fail("the body is empty.");

const sql = neon(databaseUrl);
const email = args.as.trim().toLowerCase();
const [target] = args.post
  ? await sql`select id, status, slug from posts where id = ${args.post}`
  : await sql`select id, status, slug from posts where kind = ${kind} and slug = ${slug}`;
if (args.post && !target) fail(`No post ${args.post}.`);
if (target?.status === "published") fail(`${target.id} is published; edit it in the portal instead.`);
const [clash] = (await sql`select id from posts where kind = ${kind} and slug = ${slug}`).filter(
  (row) => row.id !== target?.id,
);
if (clash) fail(`Another ${kind} post (${clash.id}) already has the slug "${slug}".`);

const words = body.split(/\s+/).length;
console.log(`[post] ${kind}/${slug}: "${title}", ${words} words, ${target ? `into draft ${target.id}` : "as a new draft"}.`);

if (args["dry-run"]) {
  console.log("[post] dry run: nothing written.");
  process.exit(0);
}

let id = target?.id;
if (!id) {
  const [author] = await sql`
    select author_user_id, author_name, author_email from posts where author_email = ${email}
    order by created_at desc limit 1
  `;
  if (!author) fail(`${email} hasn't written a post to take the byline from; make one in the portal and pass --post.`);
  [{ id }] = await sql`
    insert into posts (kind, slug, author_user_id, author_name, author_email, updated_by_email)
    values (${kind}, ${slug}, ${author.author_user_id}, ${author.author_name}, ${author.author_email}, ${email})
    returning id
  `;
}

await sql`
  update posts
  set kind = ${kind}, slug = ${slug}, title = ${title}, summary = ${summary}, body_md = ${body},
      updated_at = now(), updated_by_email = ${email}
  where id = ${id} and status = 'draft'
`;
console.log(`[post] wrote draft ${id} to ${new URL(databaseUrl).hostname}; preview at /portal/posts/${id}/preview.`);
