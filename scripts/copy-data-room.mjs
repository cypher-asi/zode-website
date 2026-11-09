/**
 * Builds a data room out of other rooms: each source room's folders and files
 * (or just some of its root-level files) are copied under a folder path in the
 * target room, and the blobs are copied inside the private Blob store, so the
 * sources are left as they were. Rows and audit events are written the way the
 * app's own uploads write them.
 *
 *   node --env-file=.env.production.local scripts/copy-data-room.mjs \
 *     --create "ZODE ASCENT" --owner-user-id <ZOS user id> \
 *     --from "<room id>:<file name>,<file name>=01 ZODE Models" \
 *     --folder "02 ZODE TORONTO" \
 *     --from "<room id>=03 ZODE CALGARY/A Olds - 6102-6402 48 Avenue" [--as n3o@zero.tech] [--dry-run]
 *
 * `--from <room id>=<path>` copies the whole room under <path>; listing file
 * names after a colon copies only those root-level files into it. `--folder`
 * adds a folder that starts empty. Paths nest with "/". Pass `--room <id>`
 * instead of `--create` to fill a room that already exists. Reruns are safe:
 * folders are matched by parent and name, and registered files are skipped.
 * Exits non-zero unless every source file ends up in the room.
 */
import { parseArgs } from "node:util";
import { neon } from "@neondatabase/serverless";
import { BlobNotFoundError, copy, head } from "@vercel/blob";

const MAX_NAME_LENGTH = 200;
const ROOM_QUOTA_BYTES = 50 * 1024 ** 3;
const ATTEMPTS = 4;
const USER_AGENT = "scripts/copy-data-room.mjs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const { values: args } = parseArgs({
  options: {
    room: { type: "string" },
    create: { type: "string" },
    "owner-user-id": { type: "string" },
    kind: { type: "string", default: "purchase" },
    from: { type: "string", multiple: true, default: [] },
    folder: { type: "string", multiple: true, default: [] },
    as: { type: "string", default: "n3o@zero.tech" },
    concurrency: { type: "string", default: "6" },
    "dry-run": { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`[copy] ${message}`);
  process.exit(1);
};

const dryRun = args["dry-run"];
const actorEmail = args.as.trim().toLowerCase();
const concurrency = Math.max(1, Number.parseInt(args.concurrency, 10) || 6);
if (!args.room && !args.create) fail("Pass --room <id>, or --create <name> with --owner-user-id.");
if (args.create && !args["owner-user-id"]) fail("--create needs --owner-user-id (the owner's ZOS user id).");
if (!["purchase", "lease", "colo"].includes(args.kind)) fail("--kind is purchase, lease or colo.");
if (!args.from.length && !args.folder.length) fail("Pass at least one --from or --folder.");

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

/** "a/b/c" as its folder names, each checked. */
function folderPath(raw) {
  const segments = raw.split("/");
  for (const segment of segments) {
    const problem = nameProblem(segment);
    if (problem) fail(`Folder "${raw}": ${problem}.`);
  }
  return segments;
}

/** `<room id>[:<file>,<file>]=<path>`; the last "=" splits, since paths here never hold one. */
const sources = args.from.map((spec) => {
  const split = spec.lastIndexOf("=");
  if (split < 0) fail(`--from "${spec}" needs "=<folder path>".`);
  const [roomId, fileList = ""] = spec.slice(0, split).split(/:(.*)/s);
  if (!UUID.test(roomId)) fail(`--from "${spec}" doesn't start with a room id.`);
  const fileNames = fileList ? fileList.split(",").map((name) => name.trim()).filter(Boolean) : null;
  return { roomId, fileNames, target: folderPath(spec.slice(split + 1)) };
});
const emptyFolders = args.folder.map(folderPath);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set.");
if (!dryRun && !process.env.BLOB_READ_WRITE_TOKEN) fail("BLOB_READ_WRITE_TOKEN is not set.");
const sql = neon(databaseUrl);

// Sources

for (const source of sources) {
  const [room] = await sql`select id, name from data_rooms where id = ${source.roomId}`;
  if (!room) fail(`Source room ${source.roomId} doesn't exist in this database.`);
  source.name = String(room.name);
  source.folders = source.fileNames
    ? []
    : (await sql`select id, parent_id, name from data_room_folders where room_id = ${source.roomId}`).map((row) => ({
        id: String(row.id),
        parentId: row.parent_id && String(row.parent_id),
        name: String(row.name),
      }));
  const rows = await sql`
    select id, folder_id, name, content_type, size_bytes, blob_pathname, metadata from data_room_files
    where room_id = ${source.roomId} and deleted_at is null
      and (${source.fileNames}::text[] is null or (folder_id is null and name = any(${source.fileNames}::text[])))
    order by name
  `;
  if (source.fileNames) {
    for (const name of source.fileNames) {
      const matches = rows.filter((row) => row.name === name).length;
      if (matches !== 1) fail(`"${source.name}" has ${matches} root-level files named "${name}", not 1.`);
    }
  }
  source.files = rows.map((row) => ({
    folderId: row.folder_id && String(row.folder_id),
    name: String(row.name),
    contentType: String(row.content_type),
    size: Number(row.size_bytes),
    from: String(row.blob_pathname),
    metadata: row.metadata,
  }));
  source.bytes = source.files.reduce((sum, file) => sum + file.size, 0);
  console.log(
    `[copy] "${source.name}" -> ${source.target.join("/")}: ` +
      `${source.folders.length} folders, ${source.files.length} files, ${formatBytes(source.bytes)}`,
  );
}
for (const path of emptyFolders) console.log(`[copy] empty folder: ${path.join("/")}`);
const totalBytes = sources.reduce((sum, source) => sum + source.bytes, 0);
console.log(`[copy] ${sources.reduce((sum, s) => sum + s.files.length, 0)} files, ${formatBytes(totalBytes)} in all`);

// Target room

let roomId = args.room;
if (args.create) {
  const name = args.create.trim();
  if (nameProblem(name)) fail(`Room name: ${nameProblem(name)}.`);
  const [existing] = await sql`
    select id, kind from data_rooms where name = ${name} and created_by_user_id = ${args["owner-user-id"]}
  `;
  if (existing) {
    roomId = String(existing.id);
    if (existing.kind !== args.kind) fail(`Room "${name}" (${roomId}) is a ${existing.kind} room, not ${args.kind}.`);
    console.log(`[copy] reusing room "${name}" (${roomId})`);
  } else if (dryRun) {
    console.log(`[copy] dry run: would create ${args.kind} room "${name}" owned by ${actorEmail}`);
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
    console.log(`[copy] created ${args.kind} room "${name}" (${roomId})`);
  }
}

if (!roomId) {
  if (totalBytes > ROOM_QUOTA_BYTES) fail(`That's over a room's ${formatBytes(ROOM_QUOTA_BYTES)} quota.`);
  console.log("[copy] dry run: nothing written.");
  process.exit(0);
}
if (!UUID.test(roomId)) fail(`"${roomId}" isn't a room id.`);
if (sources.some((source) => source.roomId === roomId)) fail("A room can't be copied into itself.");

const [room] = await sql`select id, name from data_rooms where id = ${roomId}`;
if (!room) fail(`Room ${roomId} doesn't exist in this database.`);
const [actor] = await sql`
  select user_id from data_room_members
  where room_id = ${roomId} and email = ${actorEmail} and role = 'admin' and accepted_at is not null and user_id is not null
`;
if (!actor) fail(`${actorEmail} isn't an active admin of "${room.name}".`);
const actorUserId = String(actor.user_id);

/** Source pathnames are unique, so keeping each one's tail under its target path keeps these unique too. */
const prefix = `data-rooms/${roomId}/`;
for (const source of sources) {
  const sourcePrefix = `data-rooms/${source.roomId}/`;
  const base = prefix + source.target.map(safeSegment).join("/") + "/";
  for (const file of source.files) {
    file.to = base + (file.from.startsWith(sourcePrefix) ? file.from.slice(sourcePrefix.length) : safeSegment(file.name));
  }
}

const registered = new Set(
  (await sql`select blob_pathname from data_room_files where room_id = ${roomId}`).map((row) => String(row.blob_pathname)),
);
const pending = sources.flatMap((source) => source.files.filter((file) => !registered.has(file.to)));
const pendingBytes = pending.reduce((sum, file) => sum + file.size, 0);
const [{ used }] = await sql`
  select coalesce(sum(size_bytes), 0) as used from data_room_files where room_id = ${roomId} and deleted_at is null
`;
console.log(
  `[copy] room "${room.name}": ${formatBytes(Number(used))} used; ` +
    `${registered.size} files already registered, ${pending.length} to go (${formatBytes(pendingBytes)})`,
);
if (Number(used) + pendingBytes > ROOM_QUOTA_BYTES) fail(`That would put the room over its ${formatBytes(ROOM_QUOTA_BYTES)} quota.`);
if (dryRun) {
  console.log("[copy] dry run: nothing written.");
  process.exit(0);
}

// Folders, parent first, reusing any already there.

const folderKey = (parentId, name) => `${parentId ?? ""}/${name}`;
const folderIds = new Map(
  (await sql`select id, parent_id, name from data_room_folders where room_id = ${roomId}`).map((row) => [
    folderKey(row.parent_id && String(row.parent_id), row.name),
    String(row.id),
  ]),
);
let foldersCreated = 0;

async function ensureFolder(parentId, name) {
  const key = folderKey(parentId, name);
  if (!folderIds.has(key)) {
    const [row] = await sql`
      insert into data_room_folders (room_id, parent_id, name) values (${roomId}, ${parentId}, ${name}) returning id
    `;
    const id = String(row.id);
    folderIds.set(key, id);
    foldersCreated += 1;
    await sql`
      insert into data_room_events (room_id, actor_user_id, actor_email, action, detail, user_agent)
      values (${roomId}, ${actorUserId}, ${actorEmail}, 'folder_create', ${JSON.stringify({ name, folderId: id })}, ${USER_AGENT})
    `;
  }
  return folderIds.get(key);
}

async function ensurePath(segments) {
  let id = null;
  for (const name of segments) id = await ensureFolder(id, name);
  return id;
}

const paths = [...emptyFolders, ...sources.map((source) => source.target)];
for (const segments of paths.sort((a, b) => a.join("/").localeCompare(b.join("/")))) await ensurePath(segments);

for (const source of sources) {
  const targetId = await ensurePath(source.target);
  const mapped = new Map([[null, targetId]]);
  const children = Map.groupBy(source.folders, (folder) => folder.parentId);
  const queue = [null];
  for (let parent = queue.shift(); parent !== undefined; parent = queue.shift()) {
    for (const folder of (children.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
      mapped.set(folder.id, await ensureFolder(mapped.get(parent), folder.name));
      queue.push(folder.id);
    }
  }
  for (const file of source.files) {
    file.folder = mapped.get(file.folderId) ?? targetId;
    file.sourceRoomId = source.roomId;
  }
}
console.log(`[copy] folders: ${foldersCreated} created, ${folderIds.size - foldersCreated} already there`);

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

async function copyFile(file) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const already = await existingBlob(file.to);
      const copied = !(already && already.size === file.size);
      if (copied) {
        await copy(file.from, file.to, {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: file.contentType,
        });
      }
      const [row] = await sql`
        insert into data_room_files
          (room_id, folder_id, name, content_type, size_bytes, blob_pathname, uploaded_by_email, metadata)
        values (${roomId}, ${file.folder}, ${file.name}, ${file.contentType}, ${file.size}, ${file.to}, ${actorEmail},
          ${file.metadata ? JSON.stringify(file.metadata) : null})
        on conflict (blob_pathname) do nothing
        returning id
      `;
      if (row) {
        await sql`
          insert into data_room_events (room_id, file_id, actor_user_id, actor_email, action, detail, user_agent)
          values (${roomId}, ${row.id}, ${actorUserId}, ${actorEmail}, 'upload',
            ${JSON.stringify({ name: file.name, size: file.size, source: "copy", fromRoomId: file.sourceRoomId })}, ${USER_AGENT})
        `;
      }
      return { copied };
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
let copiedCount = 0;
const queue = [...pending];

async function worker() {
  for (let file = queue.shift(); file; file = queue.shift()) {
    try {
      const { copied } = await copyFile(file);
      if (copied) copiedCount += 1;
    } catch (error) {
      failures.push({ name: file.to, error: error instanceof Error ? error.message : String(error) });
      console.error(`  failed: ${file.to}: ${failures.at(-1).error}`);
    }
    done += 1;
    doneBytes += file.size;
    if (done % 50 === 0 || done === pending.length) {
      console.log(`[${done}/${pending.length}] ${formatBytes(doneBytes)} / ${formatBytes(pendingBytes)}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));

// Completeness check against the database, not the counters above.

const finalRows = new Map(
  (await sql`select blob_pathname, size_bytes from data_room_files where room_id = ${roomId} and deleted_at is null`).map(
    (row) => [String(row.blob_pathname), Number(row.size_bytes)],
  ),
);
console.log("");
console.log(`[copy] room "${room.name}" (${roomId}); ${copiedCount} blobs copied now`);
let missing = 0;
for (const source of sources) {
  const present = source.files.filter((file) => finalRows.get(file.to) === file.size);
  const bytes = present.reduce((sum, file) => sum + file.size, 0);
  missing += source.files.length - present.length;
  console.log(
    `[copy] ${source.target.join("/")}: ${present.length}/${source.files.length} files, ` +
      `${formatBytes(bytes)} / ${formatBytes(source.bytes)}`,
  );
}
for (const failure of failures) console.error(`  ${failure.name}: ${failure.error}`);
if (missing) fail(`${missing} file(s) didn't make it; rerun the same command to retry them.`);
console.log("[copy] done.");
