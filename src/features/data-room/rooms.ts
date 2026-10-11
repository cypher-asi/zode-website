import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getAccount, requireAccount } from "@/features/account/session";
import type { Account } from "@/features/account/zos";
import { db } from "@/lib/db";
import type { RoomFile, RoomFolder, RoomMember, RoomRole, RoomSummary, RoomTree } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres rejects malformed uuids with an error, so ids from URLs are checked first. */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const MAX_NAME_LENGTH = 200;

/** Live bytes a room may hold; uploads past this are refused. */
export const ROOM_QUOTA_BYTES = 50 * 1024 ** 3;

/**
 * Who may open new rooms: the ZOS user ids in DATA_ROOM_CREATORS (comma
 * separated). Ids rather than emails, because ZOS registration is open and
 * doesn't verify addresses. Unset allows everyone in local development only.
 */
export function canCreateRooms(account: Account): boolean {
  const creators = (process.env.DATA_ROOM_CREATORS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!creators.length) return process.env.NODE_ENV === "development";
  return creators.includes(account.userId);
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
  room: { id: string; name: string };
  role: RoomRole;
}

const loadAccess = cache(async (roomId: string, userId: string): Promise<Omit<RoomAccess, "account"> | null> => {
  const [row] = await db()`
    select r.id, r.name, m.role
    from data_room_members m
    join data_rooms r on r.id = m.room_id
    where m.room_id = ${roomId} and m.user_id = ${userId} and m.accepted_at is not null
  `;
  return row ? { room: { id: String(row.id), name: String(row.name) }, role: row.role as RoomRole } : null;
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
    select r.id, r.name, r.created_at, m.role,
      (select count(*) from data_room_files f where f.room_id = r.id and f.deleted_at is null) as file_count
    from data_room_members m
    join data_rooms r on r.id = m.room_id
    where m.user_id = ${userId} and m.accepted_at is not null
    order by r.created_at desc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    role: row.role as RoomRole,
    createdAt: iso(row.created_at),
    fileCount: Number(row.file_count),
  }));
}

/** Creates a room with its creator as the first, already-active admin. */
export async function createRoom(name: string, account: Account): Promise<string> {
  const email = normalizeEmail(account.email);
  const [row] = await db()`
    with room as (
      insert into data_rooms (name, created_by_user_id, created_by_email)
      values (${name}, ${account.userId}, ${email})
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

/** Live files among `fileIds`, plus every live file under `folderIds`, each with its folder path. */
export async function resolveSelection(
  roomId: string,
  fileIds: string[],
  folderIds: string[],
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
  const wantedFiles = new Set(fileIds);

  return files
    .map(toStoredFile)
    .filter((file) => wantedFiles.has(file.id) || underWanted(file.folderId))
    .map((file) => ({ ...file, path: pathOf(file.folderId) }));
}

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

export async function listMembers(roomId: string): Promise<RoomMember[]> {
  const rows = await db()`
    select id, email, role, invited_by_email, invited_at, accepted_at, invite_expires_at
    from data_room_members
    where room_id = ${roomId}
    order by accepted_at is null, role, email
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
  }));
}

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
