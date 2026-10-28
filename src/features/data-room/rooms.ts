import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { notFound } from "next/navigation";
import { isTeam } from "@/features/account/admin";
import { getAccount, requireAccount } from "@/features/account/session";
import type { Account } from "@/features/account/zos";
import { mapsConfigured } from "@/features/deployments/places";
import { db } from "@/lib/db";
import {
  leaseEconomics,
  type RoomFile,
  type RoomFolder,
  type RoomKind,
  type RoomMember,
  type RoomRole,
  type RoomSite,
  type RoomSummary,
  type RoomTree,
} from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres rejects malformed uuids with an error, so ids from URLs are checked first. */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const MAX_NAME_LENGTH = 200;

/** Tags the account's cached room lists, so a pushed change can expire them (see `refreshMyRoomsAction`). */
export const accountRoomsTag = (userId: string): string => `data-rooms:${userId}`;

/** Live bytes a room may hold; uploads past this are refused. */
export const ROOM_QUOTA_BYTES = 50 * 1024 ** 3;

/** Who may open new rooms: the ZODE team, super admins included. */
export function canCreateRooms(account: Account): Promise<boolean> {
  return isTeam(account);
}

/** Bytes held by a room's live files. */
export async function roomUsage(roomId: string): Promise<number> {
  const [row] = await db()`
    select coalesce(sum(size_bytes), 0) as used from data_room_files where room_id = ${roomId} and deleted_at is null
  `;
  return Number(row.used);
}

const iso = (value: unknown): string => new Date(value as string | Date).toISOString();

export interface RoomAccess {
  account: Account;
  room: { id: string; name: string; kind: RoomKind };
  role: RoomRole;
}

const loadAccess = cache(async (roomId: string, userId: string): Promise<Omit<RoomAccess, "account"> | null> => {
  const [row] = await db()`
    select r.id, r.name, r.kind, m.role
    from data_room_members m
    join data_rooms r on r.id = m.room_id
    where m.room_id = ${roomId} and m.user_id = ${userId} and m.accepted_at is not null
  `;
  return row
    ? { room: { id: String(row.id), name: String(row.name), kind: row.kind as RoomKind }, role: row.role as RoomRole }
    : null;
});

const satisfies = (role: RoomRole, minRole: RoomRole): boolean => minRole === "viewer" || role === "admin";

/**
 * The signed-in account's access to a room, or `null` when signed out, not an
 * active member, or below `minRole`. Membership is read per request, so removal
 * takes effect immediately.
 */
export async function roomAccess(roomId: string, minRole: RoomRole = "viewer"): Promise<RoomAccess | null> {
  const account = await getAccount();
  if (!account || !isUuid(roomId)) return null;
  const access = await loadAccess(roomId, account.userId);
  return access && satisfies(access.role, minRole) ? { account, ...access } : null;
}

/** For pages: signed-out visitors go to log in; non-members get a 404 so rooms don't leak. */
export async function requireRoomRole(roomId: string, minRole: RoomRole = "viewer"): Promise<RoomAccess> {
  const account = await requireAccount(`/portal/data-rooms/${roomId}`);
  if (!isUuid(roomId)) notFound();
  const access = await loadAccess(roomId, account.userId);
  if (!access || !satisfies(access.role, minRole)) notFound();
  return { account, ...access };
}

export async function listRoomsForUser(userId: string): Promise<RoomSummary[]> {
  const rows = await db()`
    select r.id, r.name, r.kind, r.address, r.city, r.place_id, r.created_at, m.role,
      (select count(*) from data_room_files f where f.room_id = r.id and f.deleted_at is null) as file_count
    from data_room_members m
    join data_rooms r on r.id = m.room_id
    where m.user_id = ${userId} and m.accepted_at is not null
    order by r.created_at desc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    kind: row.kind as RoomKind,
    role: row.role as RoomRole,
    site: toRoomSite(row),
    createdAt: iso(row.created_at),
    fileCount: Number(row.file_count),
  }));
}

/** The account's rooms by name alone, newest first, for the sidebar. */
export async function listRoomNamesForUser(userId: string): Promise<{ id: string; name: string }[]> {
  const rows = await db()`
    select r.id, r.name
    from data_room_members m
    join data_rooms r on r.id = m.room_id
    where m.user_id = ${userId} and m.accepted_at is not null
    order by r.created_at desc
  `;
  return rows.map((row) => ({ id: String(row.id), name: String(row.name) }));
}

/** Creates a room with its creator as the first, already-active admin. */
export async function createRoom(name: string, kind: RoomKind, account: Account): Promise<string> {
  const email = normalizeEmail(account.email);
  const [row] = await db()`
    with room as (
      insert into data_rooms (name, kind, created_by_user_id, created_by_email)
      values (${name}, ${kind}, ${account.userId}, ${email})
      returning id
    )
    insert into data_room_members (room_id, email, role, user_id, invited_by_email, accepted_at)
    select id, ${email}, 'admin', ${account.userId}, ${email}, now() from room
    returning room_id
  `;
  return String(row.room_id);
}

export async function renameRoom(roomId: string, name: string): Promise<void> {
  await db()`update data_rooms set name = ${name} where id = ${roomId}`;
}

/** A summary's economics follow the kind, so moving to or from a purchase drops the summary written for the old one. */
export async function setRoomKind(roomId: string, from: RoomKind, to: RoomKind): Promise<void> {
  const sql = db();
  await sql.transaction([
    sql`update data_rooms set kind = ${to} where id = ${roomId}`,
    ...(leaseEconomics(from) === leaseEconomics(to) ? [] : [sql`delete from data_room_summaries where room_id = ${roomId}`]),
  ]);
}

export const toRoomSite = (row: Record<string, unknown>): RoomSite | null =>
  row.address == null
    ? null
    : {
        address: String(row.address),
        city: row.city == null ? null : String(row.city),
        placeId: row.place_id == null ? null : String(row.place_id),
      };

export async function getRoomSite(roomId: string): Promise<RoomSite | null> {
  const [row] = await db()`select address, city, place_id from data_rooms where id = ${roomId}`;
  return row ? toRoomSite(row) : null;
}

/**
 * The site's satellite map, from the room's map route; null when Maps isn't
 * set up. Browsers keep the map for a day, so a new address needs a new URL.
 */
export function siteMapSrc(roomId: string, site: RoomSite): string | null {
  if (!mapsConfigured()) return null;
  const version = createHash("sha256").update(`${site.address}\n${site.placeId ?? ""}`).digest("hex").slice(0, 12);
  return `/api/data-rooms/${roomId}/map?v=${version}`;
}

/** `null` clears the address. */
export async function setRoomSite(roomId: string, site: RoomSite | null): Promise<void> {
  await db()`
    update data_rooms
    set address = ${site?.address ?? null}, city = ${site?.city ?? null}, place_id = ${site?.placeId ?? null}
    where id = ${roomId}
  `;
}

export async function deleteRoom(roomId: string): Promise<void> {
  await db()`delete from data_rooms where id = ${roomId}`;
}

const toFile = (row: Record<string, unknown>): RoomFile => ({
  id: String(row.id),
  folderId: row.folder_id == null ? null : String(row.folder_id),
  name: String(row.name),
  contentType: String(row.content_type),
  sizeBytes: Number(row.size_bytes),
  uploadedBy: String(row.uploaded_by_email),
  createdAt: iso(row.created_at),
});

/** A room's live files by name alone. */
export async function listFileNames(roomId: string): Promise<{ id: string; name: string }[]> {
  const rows = await db()`select id, name from data_room_files where room_id = ${roomId} and deleted_at is null`;
  return rows.map((row) => ({ id: String(row.id), name: String(row.name) }));
}

export async function getRoomTree(roomId: string): Promise<RoomTree> {
  const sql = db();
  const [folders, files] = await Promise.all([
    sql`select id, parent_id, name from data_room_folders where room_id = ${roomId} order by lower(name)`,
    sql`
      select id, folder_id, name, content_type, size_bytes, uploaded_by_email, created_at
      from data_room_files
      where room_id = ${roomId} and deleted_at is null
      order by lower(name)
    `,
  ]);
  return {
    folders: folders.map(
      (row): RoomFolder => ({
        id: String(row.id),
        parentId: row.parent_id == null ? null : String(row.parent_id),
        name: String(row.name),
      }),
    ),
    files: files.map(toFile),
  };
}

export interface StoredFile extends RoomFile {
  blobPathname: string;
}

const toStoredFile = (row: Record<string, unknown>): StoredFile => ({
  ...toFile(row),
  blobPathname: String(row.blob_pathname),
});

export async function getFile(roomId: string, fileId: string): Promise<StoredFile | null> {
  if (!isUuid(fileId)) return null;
  const [row] = await db()`
    select * from data_room_files where room_id = ${roomId} and id = ${fileId} and deleted_at is null
  `;
  return row ? toStoredFile(row) : null;
}

/**
 * Live files among `fileIds`, plus every live file under `folderIds`, each with
 * its folder path; `"all"` takes every live file in the room.
 */
export async function resolveSelection(
  roomId: string,
  fileIds: string[] | "all",
  folderIds: string[] = [],
): Promise<(StoredFile & { path: string })[]> {
  const sql = db();
  const [folders, files] = await Promise.all([
    sql`select id, parent_id, name from data_room_folders where room_id = ${roomId}`,
    sql`select * from data_room_files where room_id = ${roomId} and deleted_at is null`,
  ]);

  const byId = new Map(folders.map((f) => [String(f.id), f]));
  const pathOf = (folderId: string | null): string => {
    const parts: string[] = [];
    for (let id = folderId, depth = 0; id && depth < 64; depth += 1) {
      const folder = byId.get(id);
      if (!folder) break;
      parts.unshift(String(folder.name));
      id = folder.parent_id == null ? null : String(folder.parent_id);
    }
    return parts.join("/");
  };
  const wantedFolders = new Set(folderIds.filter((id) => byId.has(id)));
  const underWanted = (folderId: string | null): boolean => {
    for (let id = folderId, depth = 0; id && depth < 64; depth += 1) {
      if (wantedFolders.has(id)) return true;
      const folder = byId.get(id);
      id = folder?.parent_id == null ? null : String(folder.parent_id);
    }
    return false;
  };
  const wantedFiles = new Set(fileIds === "all" ? [] : fileIds);

  return files
    .map(toStoredFile)
    .filter((file) => fileIds === "all" || wantedFiles.has(file.id) || underWanted(file.folderId))
    .map((file) => ({ ...file, path: pathOf(file.folderId) }));
}

/** Each file's path in a zip, repeats given a " (2)" suffix before the extension, as a file manager would. */
export function zipPaths(files: { path: string; name: string }[]): string[] {
  const seen = new Map<string, number>();
  return files.map((file) => {
    const path = file.path ? `${file.path}/${file.name}` : file.name;
    const count = seen.get(path.toLowerCase()) ?? 0;
    seen.set(path.toLowerCase(), count + 1);
    if (!count) return path;
    const dot = path.lastIndexOf(".");
    const slash = path.lastIndexOf("/");
    return dot > slash + 1 ? `${path.slice(0, dot)} (${count + 1})${path.slice(dot)}` : `${path} (${count + 1})`;
  });
}

/** The name a room's zip downloads as. */
export const zipName = (roomName: string): string => `${roomName} ${new Date().toISOString().slice(0, 10)}.zip`;

export async function folderExists(roomId: string, folderId: string | null): Promise<boolean> {
  if (folderId === null) return true;
  if (!isUuid(folderId)) return false;
  const [row] = await db()`select 1 from data_room_folders where room_id = ${roomId} and id = ${folderId}`;
  return Boolean(row);
}

/** `folderId` and every folder nested under it. */
export async function folderSubtree(roomId: string, folderId: string): Promise<string[]> {
  const rows = await db()`
    with recursive tree as (
      select id from data_room_folders where room_id = ${roomId} and id = ${folderId}
      union all
      select f.id from data_room_folders f join tree t on f.parent_id = t.id
    )
    select id from tree
  `;
  return rows.map((row) => String(row.id));
}

/** Active members by role, then invites oldest first. Cached per request, since a room's layout and its Members tab both list them. */
export const listMembers = cache(async (roomId: string): Promise<RoomMember[]> => {
  const rows = await db()`
    select id, email, role, invited_by_email, invited_at, accepted_at, invite_expires_at, requires_mnda
    from data_room_members
    where room_id = ${roomId}
    order by accepted_at is null, case when accepted_at is null then invited_at end, role, email
  `;
  const now = Date.now();
  return rows.map((row) => ({
    id: String(row.id),
    email: String(row.email),
    role: row.role as RoomRole,
    status: row.accepted_at
      ? "active"
      : row.invite_expires_at && new Date(row.invite_expires_at as string).getTime() > now
        ? "pending"
        : "expired",
    invitedBy: row.invited_by_email == null ? null : String(row.invited_by_email),
    invitedAt: iso(row.invited_at),
    acceptedAt: row.accepted_at == null ? null : iso(row.accepted_at),
    requiresMnda: Boolean(row.requires_mnda),
  }));
});

export async function getMember(
  roomId: string,
  memberId: string,
): Promise<{ id: string; email: string; role: RoomRole; userId: string | null; active: boolean } | null> {
  if (!isUuid(memberId)) return null;
  const [row] = await db()`
    select id, email, role, user_id, accepted_at from data_room_members where room_id = ${roomId} and id = ${memberId}
  `;
  return row
    ? {
        id: String(row.id),
        email: String(row.email),
        role: row.role as RoomRole,
        userId: row.user_id == null ? null : String(row.user_id),
        active: row.accepted_at != null,
      }
    : null;
}

/** Active admins other than `exceptMemberId`; a room must always keep at least one. */
export async function countOtherAdmins(roomId: string, exceptMemberId: string): Promise<number> {
  const [row] = await db()`
    select count(*) as n from data_room_members
    where room_id = ${roomId} and role = 'admin' and accepted_at is not null and id <> ${exceptMemberId}
  `;
  return Number(row.n);
}
