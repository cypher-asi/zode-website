/**
 * Bulk-imports a local folder tree into a data room: every file goes to the
 * private Blob store under data-rooms/<room id>/, and the folders, file rows and
 * audit events are written the same way the app's own uploads write them.
 *
 *   node --env-file=.env.preview scripts/import-data-room.mjs \
 *     --dir ~/Downloads/Olds_VDR --room <room id> [--as n3o@zero.tech] [--dry-run]
 *
 * Create the room in the app first (so its owner is a real ZOS account) and
 * pass its id; or, where room creation isn't allowed yet, pass
 * `--create "<room name>" --owner-user-id <ZOS user id> [--kind purchase|lease]`
 * instead of `--room`. The kind defaults to purchase.
 *
 * A "00 Index/File Index.csv" in the tree, if present, supplies each file's
 * metadata (date, doctype, status, md5, ...). Reruns are safe: registered files
 * are skipped and finished uploads aren't sent again. Exits non-zero unless
 * every local file ends up in the room.
 */
import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { neon } from "@neondatabase/serverless";
import { BlobNotFoundError, head, put } from "@vercel/blob";

const MAX_NAME_LENGTH = 200;
const MAX_FILE_BYTES = 5 * 1024 ** 3;
const ROOM_QUOTA_BYTES = 50 * 1024 ** 3;
const MULTIPART_BYTES = 64 * 1024 ** 2;
const ATTEMPTS = 4;
const USER_AGENT = "scripts/import-data-room.mjs";
const INDEX_CSV = "00 Index/File Index.csv";

const { values: args } = parseArgs({
  options: {
    dir: { type: "string" },
    room: { type: "string" },
    create: { type: "string" },
    "owner-user-id": { type: "string" },
    kind: { type: "string", default: "purchase" },
    as: { type: "string", default: "n3o@zero.tech" },
    concurrency: { type: "string", default: "4" },
    "dry-run": { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`[import] ${message}`);
  process.exit(1);
};

const dryRun = args["dry-run"];
const actorEmail = args.as.trim().toLowerCase();
const concurrency = Math.max(1, Number.parseInt(args.concurrency, 10) || 4);
if (!args.dir) fail("--dir is required.");
if (!args.room && !args.create) fail("Pass --room <id>, or --create <name> with --owner-user-id.");
if (args.create && !args["owner-user-id"]) fail("--create needs --owner-user-id (the owner's ZOS user id).");
if (!["purchase", "lease"].includes(args.kind)) fail("--kind is purchase or lease.");
const root = path.resolve(args.dir.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"));

const formatBytes = (bytes) => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
};

/** Same rule as the app's uploads: Blob pathnames stay URL-safe; names are stored exactly. */
const safeSegment = (name) => name.replace(/[^\w.-]+/g, "_").slice(-120) || "file";

/** Mirrors `cleanName` in the data room actions; returns the problem, or null. */
const nameProblem = (name) => {
  if (!name.trim()) return "empty name";
  if (name !== name.trim()) return "leading or trailing whitespace";
  if (name.length > MAX_NAME_LENGTH) return `longer than ${MAX_NAME_LENGTH} characters`;
  if (/[/\\\u0000-\u001f]/.test(name) || name === "." || name === "..") return "slash or control character";
  return null;
};

// Local tree

/** @type {string[]} */
const folders = [];
/** @type {{ rel: string, folder: string, name: string, size: number }[]} */
const files = [];
const problems = [];

async function walk(relDir) {
  const entries = await readdir(path.join(root, relDir), { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    const problem = nameProblem(entry.name);
    if (problem) problems.push(`${rel}: ${problem}`);
    if (entry.isDirectory()) {
      folders.push(rel);
      await walk(rel);
    } else if (entry.isFile()) {
      const { size } = await stat(path.join(root, rel));
      if (size > MAX_FILE_BYTES) problems.push(`${rel}: ${formatBytes(size)} is over the ${formatBytes(MAX_FILE_BYTES)} file limit`);
      files.push({ rel, folder: relDir, name: entry.name, size });
    } else {
      problems.push(`${rel}: not a regular file or folder`);
    }
  }
}

await stat(root).catch(() => fail(`${root} doesn't exist.`));
await walk("");

const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
const emptyFiles = files.filter((file) => file.size === 0);

// File index metadata

/** RFC 4180 rows: quoted fields may hold commas, quotes and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some(Boolean));
}

/** @type {Map<string, Record<string, string | number>>} */
const metadataByRel = new Map();
const indexText = await readFile(path.join(root, INDEX_CSV), "utf8").catch(() => null);
if (indexText) {
  const [header, ...rows] = parseCsv(indexText.replace(/^\uFEFF/, ""));
  for (const row of rows) {
    const record = Object.fromEntries(header.map((key, i) => [key, row[i] ?? ""]));
    const rel = record.folder ? `${record.folder}/${record.file_name}` : record.file_name;
    const metadata = {};
    for (const [key, value] of Object.entries(record)) {
      if (key === "folder" || key === "file_name" || value === "") continue;
      metadata[key] = key === "duplicate_copies_dropped" ? Number(value) : value;
    }
    metadataByRel.set(rel, metadata);
  }
}
const localRels = new Set(files.map((file) => file.rel));
const indexOnly = [...metadataByRel.keys()].filter((rel) => !localRels.has(rel));
const unindexed = indexText ? files.filter((f) => !metadataByRel.has(f.rel) && !f.rel.startsWith("00 Index/")) : [];

// Blob pathnames: one per file, unique even when compared case-insensitively.

const blobRel = (rel) => rel.split("/").map(safeSegment).join("/");
const seenPaths = new Map();
for (const file of files) {
  const key = blobRel(file.rel).toLowerCase();
  if (seenPaths.has(key)) problems.push(`${file.rel}: storage path collides with ${seenPaths.get(key)}`);
  else seenPaths.set(key, file.rel);
}

console.log(`[import] ${root}`);
console.log(`[import] ${folders.length} folders, ${files.length} files, ${formatBytes(totalBytes)}`);
if (indexText) {
  console.log(`[import] File Index: ${metadataByRel.size} rows; ${unindexed.length} files without a row, ${indexOnly.length} rows without a file`);
  for (const rel of unindexed.slice(0, 10)) console.log(`  no index row: ${rel}`);
  for (const rel of indexOnly.slice(0, 10)) console.log(`  no local file: ${rel}`);
} else {
  console.log(`[import] no ${INDEX_CSV}; files get no metadata`);
}
for (const file of emptyFiles) console.log(`  empty file: ${file.rel}`);
if (problems.length) {
  for (const problem of problems) console.error(`  ${problem}`);
  fail(`${problems.length} problem(s) above; fix them before importing.`);
}

// Database and room

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  if (dryRun) {
    console.log("[import] dry run: DATABASE_URL isn't set, so the room wasn't checked.");
    process.exit(0);
  }
  fail("DATABASE_URL is not set.");
}
if (!dryRun && !process.env.BLOB_READ_WRITE_TOKEN) fail("BLOB_READ_WRITE_TOKEN is not set.");
const sql = neon(databaseUrl);

const [{ exists: hasMetadata }] = await sql`
  select exists (
    select 1 from information_schema.columns where table_name = 'data_room_files' and column_name = 'metadata'
  ) as exists
`;
if (!hasMetadata) fail("data_room_files.metadata is missing; run scripts/migrate.mjs against this database first.");

let roomId = args.room;
if (args.create) {
  const name = args.create.trim();
  if (nameProblem(name)) fail(`Room name: ${nameProblem(name)}.`);
  const [{ exists: hasKind }] = await sql`
    select exists (
      select 1 from information_schema.columns where table_name = 'data_rooms' and column_name = 'kind'
    ) as exists
  `;
  if (!hasKind) fail("data_rooms.kind is missing; run scripts/migrate.mjs against this database first.");
  const [existing] = await sql`
    select id, kind from data_rooms where name = ${name} and created_by_user_id = ${args["owner-user-id"]}
  `;
  if (existing) {
    roomId = String(existing.id);
    if (existing.kind !== args.kind) fail(`Room "${name}" (${roomId}) is a ${existing.kind} room, not ${args.kind}.`);
    console.log(`[import] reusing room "${name}" (${roomId})`);
  } else if (dryRun) {
    console.log(`[import] dry run: would create ${args.kind} room "${name}" owned by ${actorEmail}`);
  } else {
    const [row] = await sql`
      with room as (
        insert into data_rooms (name, kind, created_by_user_id, created_by_email)
        values (${name}, ${args.kind}, ${args["owner-user-id"]}, ${actorEmail})
        returning id
      )
      insert into data_room_members (room_id, email, role, user_id, invited_by_email, accepted_at)
      select id, ${actorEmail}, 'admin', ${args["owner-user-id"]}, ${actorEmail}, now() from room
      returning room_id
    `;
    roomId = String(row.room_id);
    await sql`
      insert into data_room_events (room_id, actor_user_id, actor_email, action, detail, user_agent)
      values (${roomId}, ${args["owner-user-id"]}, ${actorEmail}, 'room_create', ${JSON.stringify({ name, kind: args.kind })}, ${USER_AGENT})
    `;
    console.log(`[import] created ${args.kind} room "${name}" (${roomId})`);
  }
}

if (!roomId) {
  // Dry run of a room that doesn't exist yet: the local checks above are all there is.
  console.log(`[import] dry run: ${files.length} files would be uploaded.`);
  process.exit(0);
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId)) fail(`"${roomId}" isn't a room id.`);

const [room] = await sql`select id, name from data_rooms where id = ${roomId}`;
if (!room) fail(`Room ${roomId} doesn't exist in this database.`);
const [actor] = await sql`
  select user_id from data_room_members
  where room_id = ${roomId} and email = ${actorEmail} and role = 'admin' and accepted_at is not null and user_id is not null
`;
if (!actor) fail(`${actorEmail} isn't an active admin of "${room.name}".`);
const actorUserId = String(actor.user_id);

const prefix = `data-rooms/${roomId}/`;
const pathnameOf = (file) => prefix + blobRel(file.rel);

const registered = new Set(
  (await sql`select blob_pathname from data_room_files where room_id = ${roomId}`).map((row) => String(row.blob_pathname)),
);
const pending = files.filter((file) => !registered.has(pathnameOf(file)));
const pendingBytes = pending.reduce((sum, file) => sum + file.size, 0);
const [{ used }] = await sql`
  select coalesce(sum(size_bytes), 0) as used from data_room_files where room_id = ${roomId} and deleted_at is null
`;
console.log(
  `[import] room "${room.name}": ${formatBytes(Number(used))} used; ` +
    `${files.length - pending.length} files already registered, ${pending.length} to go (${formatBytes(pendingBytes)})`,
);
if (Number(used) + pendingBytes > ROOM_QUOTA_BYTES) {
  fail(`That would put the room over its ${formatBytes(ROOM_QUOTA_BYTES)} quota.`);
}
if (dryRun) {
  console.log("[import] dry run: nothing written.");
  process.exit(0);
}

// Folders, parent first, reusing any already there.

const folderIds = new Map([["", null]]);
const existingFolders = await sql`select id, parent_id, name from data_room_folders where room_id = ${roomId}`;
const folderKey = (parentId, name) => `${parentId ?? ""}/${name}`;
const existingByKey = new Map(existingFolders.map((row) => [folderKey(row.parent_id && String(row.parent_id), row.name), String(row.id)]));
let foldersCreated = 0;
for (const rel of folders) {
  const parentRel = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
  const parentId = folderIds.get(parentRel);
  const name = rel.slice(rel.lastIndexOf("/") + 1);
  let id = existingByKey.get(folderKey(parentId, name));
  if (!id) {
    const [row] = await sql`
      insert into data_room_folders (room_id, parent_id, name) values (${roomId}, ${parentId}, ${name}) returning id
    `;
    id = String(row.id);
    foldersCreated += 1;
    await sql`
      insert into data_room_events (room_id, actor_user_id, actor_email, action, detail, user_agent)
      values (${roomId}, ${actorUserId}, ${actorEmail}, 'folder_create', ${JSON.stringify({ name, folderId: id })}, ${USER_AGENT})
    `;
  }
  folderIds.set(rel, id);
}
console.log(`[import] folders: ${foldersCreated} created, ${folders.length - foldersCreated} already there`);

// Files

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function existingBlob(pathname) {
  try {
    return await head(pathname);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

/** Uploads unless an identical-size blob is already there; returns its content type. */
async function upload(file, pathname) {
  const already = await existingBlob(pathname);
  if (already && already.size === file.size) return { contentType: already.contentType, uploaded: false };
  const absolute = path.join(root, file.rel);
  const multipart = file.size > MULTIPART_BYTES;
  const body = multipart ? createReadStream(absolute) : await readFile(absolute);
  const result = await put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    multipart,
  });
  return { contentType: result.contentType, uploaded: true };
}

async function importFile(file) {
  const pathname = pathnameOf(file);
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const { contentType, uploaded } = await upload(file, pathname);
      const metadata = metadataByRel.get(file.rel) ?? null;
      const [row] = await sql`
        insert into data_room_files
          (room_id, folder_id, name, content_type, size_bytes, blob_pathname, uploaded_by_email, metadata)
        values (${roomId}, ${folderIds.get(file.folder)}, ${file.name}, ${contentType || "application/octet-stream"},
          ${file.size}, ${pathname}, ${actorEmail}, ${metadata ? JSON.stringify(metadata) : null})
        on conflict (blob_pathname) do nothing
        returning id
      `;
      if (row) {
        await sql`
          insert into data_room_events (room_id, file_id, actor_user_id, actor_email, action, detail, user_agent)
          values (${roomId}, ${row.id}, ${actorUserId}, ${actorEmail}, 'upload',
            ${JSON.stringify({ name: file.name, size: file.size, source: "bulk-import" })}, ${USER_AGENT})
        `;
      }
      return { uploaded };
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) await sleep(2000 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

const failures = [];
let done = 0;
let doneBytes = 0;
let uploadedCount = 0;
const started = Date.now();
const queue = [...pending];

async function worker() {
  for (let file = queue.shift(); file; file = queue.shift()) {
    try {
      const { uploaded } = await importFile(file);
      if (uploaded) uploadedCount += 1;
    } catch (error) {
      failures.push({ rel: file.rel, error: error instanceof Error ? error.message : String(error) });
      console.error(`  failed: ${file.rel}: ${failures.at(-1).error}`);
    }
    done += 1;
    doneBytes += file.size;
    const rate = doneBytes / Math.max(1, (Date.now() - started) / 1000);
    console.log(
      `[${done}/${pending.length}] ${formatBytes(doneBytes)} / ${formatBytes(pendingBytes)} ` +
        `(${formatBytes(rate)}/s) ${file.rel}`,
    );
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));

// Completion check against the database, not the counters above.

const finalRows = new Set(
  (await sql`select blob_pathname from data_room_files where room_id = ${roomId} and deleted_at is null`).map((row) =>
    String(row.blob_pathname),
  ),
);
const missing = files.filter((file) => !finalRows.has(pathnameOf(file)));
const failedEmpty = missing.filter((file) => file.size === 0);
const missingReal = missing.filter((file) => file.size > 0);

console.log("");
console.log(`[import] room "${room.name}" (${roomId})`);
console.log(`[import] local files:      ${files.length}`);
console.log(`[import] in the room:      ${files.length - missing.length}`);
console.log(`[import] uploaded now:     ${uploadedCount}`);
console.log(`[import] skipped (empty):  ${failedEmpty.length}`);
console.log(`[import] missing:          ${missingReal.length}`);
for (const file of failedEmpty) console.log(`  empty file not stored: ${file.rel}`);
for (const failure of failures.filter((f) => !failedEmpty.some((e) => e.rel === f.rel))) {
  console.error(`  ${failure.rel}: ${failure.error}`);
}
if (missingReal.length) fail(`${missingReal.length} file(s) didn't make it; rerun the same command to retry them.`);
console.log("[import] done.");
