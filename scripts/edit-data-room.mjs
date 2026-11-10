/**
 * Renames and deletes folders and files in a data room by their paths, the
 * way the app's own rename and delete write them, audit events included:
 *
 *   node --env-file=.env.production.local scripts/edit-data-room.mjs --room <room id> \
 *     --delete "01 PRE-SEED/01 Model" \
 *     --rename "02 ZODE TORONTO=03 ZODE TORONTO" \
 *     --rename "02 ZODE TORONTO/02 Contracts=01 Contracts" \
 *     [--as n3o@zero.tech] [--dry-run]
 *
 * Every path is the item's path before the run, so a folder and the items in
 * it can be renamed together. A rename gives the item's new name, not a new
 * path; deletes run first, so a renamed item can take a deleted one's name.
 * A deleted folder goes with everything in it, and with any summary in its
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
if (!args.rename.length && !args.delete.length) fail("Nothing to do: pass --rename and/or --delete.");
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

/** Every folder under `id`, itself included. */
const subtree = (id) => [id, ...folders.filter((f) => parentOf(f) === id).flatMap((f) => subtree(String(f.id)))];

const deletes = args.delete.map((p) => ({ path: clean(p), item: itemAt(clean(p), "delete") }));
const deletedFolders = new Set(deletes.flatMap((d) => (d.item.kind === "folder" ? subtree(d.item.id) : [])));
const deletedFiles = files.filter(
  (f) => deletes.some((d) => d.item.kind === "file" && d.item.id === String(f.id)) || (f.folder_id != null && deletedFolders.has(String(f.folder_id))),
);
const gone = (item) => (item.kind === "folder" ? deletedFolders.has(item.id) : deletedFiles.some((f) => String(f.id) === item.id));

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
  const key = `${item.kind}:${item.parentId ?? ""}:${finalName(item).toLowerCase()}`;
  if (siblings.has(key)) fail(`"${finalName(item)}" would be the name of two ${item.kind}s in "${item.parentId ? pathOf(item.parentId) : room.name}".`);
  siblings.set(key, item);
}

for (const d of deletes) {
  const under = new Set(d.item.kind === "folder" ? subtree(d.item.id) : []);
  const inside = deletedFiles.filter((f) => f.folder_id != null && under.has(String(f.folder_id)));
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
  ...(fileIds.length ? [sql`update data_room_files set deleted_at = now() where room_id = ${args.room} and id = any(${fileIds}::uuid[])`] : []),
  ...(deletedFolders.size
    ? [sql`delete from data_room_folders where room_id = ${args.room} and id = any(${[...deletedFolders]}::uuid[])`]
    : []),
  ...renames.map((r) =>
    r.item.kind === "folder"
      ? sql`update data_room_folders set name = ${r.name} where room_id = ${args.room} and id = ${r.item.id}`
      : sql`update data_room_files set name = ${r.name} where room_id = ${args.room} and id = ${r.item.id} and deleted_at is null`,
  ),
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
  `[edit] "${room.name}": ${deletes.length} deleted (${deletedFiles.length} file(s)), ${renames.length} renamed, on ${new URL(databaseUrl).hostname}.`,
);
