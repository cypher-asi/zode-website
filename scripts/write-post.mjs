/**
 * Writes a news or changelog draft from a Markdown file through the Cypher
 * content API:
 *
 *   node --env-file=.env.production.local scripts/write-post.mjs \
 *     --file scripts/posts/the-industrialization-of-intelligence.md [--post <id>] [--as n3o@zero.tech] [--published] [--dry-run]
 *
 * The file opens with a front matter block of `title`, `slug` and `summary`
 * (and `kind`, news by default), then the body. `--post` names the draft to
 * fill, such as one made with New post in the portal; without it, the draft
 * with the file's slug is rewritten, or a new one is made, credited to the
 * account behind `--as` (taken from a post it already wrote).
 *
 * A published post is left alone unless `--published` is passed, which
 * rewrites its title, summary and body in place and keeps it live under its
 * first publish date. The site caches published posts for up to an hour, so
 * the change shows after that, on the next deploy, or on Update in the portal.
 * Publish a new post from the portal, which dates it.
 *
 * Needs CYPHER_API_KEY, and CYPHER_API_URL and CYPHER_SITE unless the defaults
 * (the Cypher deployment and `zode`) are right.
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    file: { type: "string" },
    post: { type: "string" },
    as: { type: "string", default: "n3o@zero.tech" },
    published: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`[post] ${message}`);
  process.exit(1);
};

if (!args.file) fail("--file is required.");
const apiKey = process.env.CYPHER_API_KEY;
if (!apiKey) fail("CYPHER_API_KEY is not set.");
const apiUrl = (process.env.CYPHER_API_URL || "https://cypher-website-vercel.vercel.app").replace(/\/+$/, "");
const site = process.env.CYPHER_SITE || "zode";

/** The JSON of a call under this site's API, or `null` on a 404. */
async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${apiUrl}/api/v1/sites/${site}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) fail(`${method} ${path}: ${payload?.error?.message ?? response.status}`);
  return payload;
}

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

const email = args.as.trim().toLowerCase();
const all = (await api("/posts?status=all"))?.posts ?? fail(`The API at ${apiUrl} doesn't know the site "${site}".`);
const summaryOf = args.post ? all.find((post) => post.id === args.post) : all.find((post) => post.kind === kind && post.slug === slug);
if (args.post && !summaryOf) fail(`No post ${args.post}.`);
const target = summaryOf ? (await api(`/posts/${summaryOf.id}`)).post : undefined;
const live = target?.status === "published";
if (live && !args.published) fail(`${target.id} is published; pass --published to rewrite it, or edit it in the portal.`);
if (!live && args.published) fail(`--published only rewrites a published post, and ${target ? target.id : slug} isn't one.`);
const clash = all.find((post) => post.kind === kind && post.slug === slug && post.id !== target?.id);
if (clash) fail(`Another ${kind} post (${clash.id}) already has the slug "${slug}".`);

const words = body.split(/\s+/).length;
console.log(
  `[post] ${kind}/${slug}: "${title}", ${words} words, ${
    live ? `into published post ${target.id}` : target ? `into draft ${target.id}` : "as a new draft"
  }.`,
);

if (args["dry-run"]) {
  console.log("[post] dry run: nothing written.");
  process.exit(0);
}

let post = target;
if (!post) {
  const byline = all
    .filter((other) => other.author.email.toLowerCase() === email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!byline) fail(`${email} hasn't written a post to take the byline from; make one in the portal and pass --post.`);
  ({ post } = await api("/posts", { method: "POST", body: { kind, author: byline.author } }));
}

const saved = await api(`/posts/${post.id}`, {
  method: "PATCH",
  body: {
    draft: {
      kind,
      slug,
      title,
      summary,
      bodyMd: body,
      version: post.version ?? "",
      coverPathname: post.coverPathname,
    },
    editorEmail: email,
  },
});
if (!saved) fail(`${post.id} was deleted while writing it.`);
console.log(
  `[post] wrote ${live ? "published post" : "draft"} ${post.id} to ${site} on ${new URL(apiUrl).hostname}, with ${
    saved.post.sources.length
  } sources; preview at /portal/posts/${post.id}/preview.`,
);
