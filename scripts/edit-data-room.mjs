/**
 * Moves, renames and deletes folders and files in a data room by their paths,
 * the way the app's own move, rename and delete write them, audit events included:
 *
 *   node --env-file=.env.production.local scripts/edit-data-room.mjs --room <room id> \
 *     --move "03 ZODE CALGARY/01 Model/Loan Memo.pdf=03 ZODE CALGARY" \
 *     --delete "01 PRE-SEED/01 Model" \
 *     --rename "02 ZODE TORONTO=03 ZODE TORONTO" \
 *     --rename "02 ZODE TORONTO/02 Contracts=01 Contracts" \
 *     [--as n3o@zero.tech] [--dry-run]
 *
 * Every path is the item's path before the run, so a folder and the items in
 * it can be renamed together. A move gives the folder to move into, empty for
 * the top of the room; a rename gives the item's new name, not a new path.
 * Moves run first, so an item can be saved from a folder being deleted, and
 * deletes next, so a renamed item can take a deleted one's name. A deleted
 * folder goes with everything left in it, and with any summary in its
 * folders; file rows are kept, marked deleted, and their blobs removed.
 */
import { parseArgs } from "node:util";
import { neon } from "@neondatabase/serverless";
import { del } from "@vercel/blob";

const USER_AGENT = "scripts/edit-data-room.mjs";
const MAX_NAME_LENGTH = 200;

const { values: args } = parseArgs({
  options: {
    room: { type: "string" },
    move: { type: "string", multiple: true, default: [] },
    rename: { type: "string", multiple: true, default: [] },
    delete: { type: "string", multiple: true, default: [] },
    as: { type: "string", default: "n3o@zero.tech" },
    "dry-run": { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`[edit] ${message}`);
  process.exit(1);
};

if (!args.room) fail("--room is required.");
if (!args.move.length && !args.rename.length && !args.delete.length) fail("Nothing to do: pass --move, --rename and/or --delete.");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set.");
if (!process.env.BLOB_READ_WRITE_TOKEN && args.delete.length) fail("BLOB_READ_WRITE_TOKEN is not set.");
const actorEmail = args.as.trim().toLowerCase();
const clean = (p) => p.trim().replace(/^\/+|\/+$/g, "");

const sql = neon(databaseUrl);
const [room] = await sql`select id, name from data_rooms where id = ${args.room}`;
if (!room) fail(`No room ${args.room}.`);
const [actor] = await sql`
  select user_id from data_room_members
  where room_id = ${args.room} and email = ${actorEmail} and role = 'admin' and accepted_at is not null and user_id is not null
`;
if (!actor) fail(`${actorEmail} isn't an active admin of "${room.name}".`);
const actorUserId = String(actor.user_id);

const [folders, files, summaries] = await Promise.all([
  sql`select id, parent_id, name from data_room_folders where room_id = ${args.room}`,
  sql`select id, folder_id, name, blob_pathname from data_room_files where room_id = ${args.room} and deleted_at is null`,
  sql`select folder_id, layout from data_room_summaries where room_id = ${args.room} and folder_id is not null`,
]);
const byId = new Map(folders.map((f) => [String(f.id), f]));
const parentOf = (f) => (f.parent_id == null ? null : String(f.parent_id));
const pathOf = (id) => {
  const parts = [];
  for (let at = id, depth = 0; at && depth < 64; depth += 1) {
    const folder = byId.get(at);
    if (!folder) break;
    parts.unshift(String(folder.name));
    at = parentOf(folder);
  }
  return parts.join("/");
};
const items = new Map([
  ...folders.map((f) => [pathOf(String(f.id)), { kind: "folder", id: String(f.id), parentId: parentOf(f), name: String(f.name) }]),
  ...files.map((f) => {
    const dir = f.folder_id == null ? "" : pathOf(String(f.folder_id));
    const parentId = f.folder_id == null ? null : String(f.folder_id);
    return [dir ? `${dir}/${f.name}` : String(f.name), { kind: "file", id: String(f.id), parentId, name: String(f.name) }];
  }),
]);
const itemAt = (path, flag) => items.get(path) ?? fail(`--${flag} "${path}": nothing at that path in "${room.name}".`);

/** Every folder under `id` before the run, itself included. */
const subtreeBefore = (id) => [id, ...folders.filter((f) => parentOf(f) === id).flatMap((f) => subtreeBefore(String(f.id)))];

const moves = args.move.map((arg) => {
  const match = /^(.+)=([^=]*)$/.exec(arg);
  if (!match) fail(`--move "${arg}": expected <path>=<folder path>, the folder empty for the top of the room.`);
  const path = clean(match[1]);
  const item = itemAt(path, "move");
  const to = clean(match[2]);
  const target = to ? itemAt(to, "move") : null;
  if (target && target.kind !== "folder") fail(`--move "${arg}": "${to}" isn't a folder.`);
  if (target && item.kind === "folder" && subtreeBefore(item.id).includes(target.id)) fail(`--move "${arg}": a folder can't be moved into itself.`);
  return { path, to, item, targetId: target ? target.id : null };
});
const moved = new Map(moves.map((m) => [m.item.id, m.targetId]));
/** An item's folder once the moves have run. */
const parentAfter = (item) => (moved.has(item.id) ? moved.get(item.id) : item.parentId);
const folderAfter = (f) => (moved.has(String(f.id)) ? moved.get(String(f.id)) : f.folder_id == null ? null : String(f.folder_id));

/** Every folder under `id` once the moves have run, itself included. */
const subtree = (id) => [id, ...folders.filter((f) => parentAfter({ id: String(f.id), parentId: parentOf(f) }) === id).flatMap((f) => subtree(String(f.id)))];

const deletes = args.delete.map((p) => ({ path: clean(p), item: itemAt(clean(p), "delete") }));
const deletedFolders = new Set(deletes.flatMap((d) => (d.item.kind === "folder" ? subtree(d.item.id) : [])));
const deletedFiles = files.filter((f) => {
  const folderId = folderAfter(f);
  return deletes.some((d) => d.item.kind === "file" && d.item.id === String(f.id)) || (folderId != null && deletedFolders.has(folderId));
});
for (const m of moves) if (m.targetId && deletedFolders.has(m.targetId)) fail(`--move "${m.path}": "${m.to}" is being deleted.`);
const gone = (item) => (item.kind === "folder" ? deletedFolders.has(item.id) : deletedFiles.some((f) => String(f.id) === item.id));
for (const m of moves) if (gone(m.item)) fail(`--move "${m.path}": it's being deleted.`);

const renames = args.rename.map((arg) => {
  const match = /^(.+)=([^=/]+)$/.exec(arg);
  if (!match) fail(`--rename "${arg}": expected <path>=<new name>.`);
  const path = clean(match[1]);
  const name = match[2].trim();
  if (!name || name.length > MAX_NAME_LENGTH) fail(`--rename "${arg}": a name is 1 to ${MAX_NAME_LENGTH} characters.`);
  const item = itemAt(path, "rename");
  if (gone(item)) fail(`--rename "${path}": it's being deleted.`);
  return { path, name, item };
});

// No two live items in a folder may end up with the same name.
const finalName = (item) => renames.find((r) => r.item.id === item.id)?.name ?? item.name;
const siblings = new Map();
for (const item of items.values()) {
  if (gone(item)) continue;
  const parentId = parentAfter(item);
  const key = `${item.kind}:${parentId ?? ""}:${finalName(item).toLowerCase()}`;
  if (siblings.has(key)) fail(`"${finalName(item)}" would be the name of two ${item.kind}s in "${parentId ? pathOf(parentId) : room.name}".`);
  siblings.set(key, item);
}

for (const m of moves) console.log(`[edit] move ${m.item.kind} "${m.path}" to "${m.to || room.name}"`);
for (const d of deletes) {
  const under = new Set(d.item.kind === "folder" ? subtree(d.item.id) : []);
  const inside = deletedFiles.filter((f) => under.has(folderAfter(f)));
  const withSummaries = summaries.filter((s) => under.has(String(s.folder_id)));
  console.log(
    `[edit] delete ${d.item.kind} "${d.path}"` +
      (d.item.kind === "folder" ? ` with ${inside.length} file(s)${withSummaries.length ? ` and ${withSummaries.length} summary(ies)` : ""}` : ""),
  );
}
for (const r of renames) console.log(`[edit] rename ${r.item.kind} "${r.path}" to "${r.name}"`);

if (args["dry-run"]) {
  console.log("[edit] dry run: nothing written.");
  process.exit(0);
}

const event = (action, fileId, detail) => sql`
  insert into data_room_events (room_id, file_id, actor_user_id, actor_email, action, detail, user_agent)
  values (${args.room}, ${fileId}, ${actorUserId}, ${actorEmail}, ${action}, ${JSON.stringify(detail)}::jsonb, ${USER_AGENT})
`;
const fileIds = deletedFiles.map((f) => String(f.id));
await sql.transaction([
  ...moves.map((m) =>
    m.item.kind === "folder"
      ? sql`update data_room_folders set parent_id = ${m.targetId} where room_id = ${args.room} and id = ${m.item.id}`
      : sql`update data_room_files set folder_id = ${m.targetId} where room_id = ${args.room} and id = ${m.item.id} and deleted_at is null`,
  ),
  ...(fileIds.length ? [sql`update data_room_files set deleted_at = now() where room_id = ${args.room} and id = any(${fileIds}::uuid[])`] : []),
  ...(deletedFolders.size
    ? [sql`delete from data_room_folders where room_id = ${args.room} and id = any(${[...deletedFolders]}::uuid[])`]
    : []),
  ...renames.map((r) =>
    r.item.kind === "folder"
      ? sql`update data_room_folders set name = ${r.name} where room_id = ${args.room} and id = ${r.item.id}`
      : sql`update data_room_files set name = ${r.name} where room_id = ${args.room} and id = ${r.item.id} and deleted_at is null`,
  ),
  ...moves.map((m) => event("move", m.item.kind === "file" ? m.item.id : null, { kind: m.item.kind, name: m.item.name, to: m.targetId })),
  ...deletedFiles.map((f) => event("delete", String(f.id), { kind: "file", name: String(f.name) })),
  ...deletes.filter((d) => d.item.kind === "folder").map((d) => event("delete", null, { kind: "folder", name: d.item.name })),
  ...renames.map((r) => event("rename", r.item.kind === "file" ? r.item.id : null, { kind: r.item.kind, from: r.item.name, to: r.name })),
]);

const pathnames = deletedFiles.map((f) => String(f.blob_pathname));
if (pathnames.length) {
  try {
    await del(pathnames);
  } catch (error) {
    console.error("[edit] couldn't delete some blobs; the files are gone from the room either way", pathnames, error);
  }
}
console.log(
  `[edit] "${room.name}": ${moves.length} moved, ${deletes.length} deleted (${deletedFiles.length} file(s)), ${renames.length} renamed, on ${new URL(databaseUrl).hostname}.`,
);
