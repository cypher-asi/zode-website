"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendDataRoomInvite, sendMndaEmails } from "@/emails/send";
import { getAccount } from "@/features/account/session";
import type { Account } from "@/features/account/zos";
import { createMnda, hasSignedMnda, signFailure, type ExecutedMnda } from "@/features/mnda/mndas";
import { parseMnda } from "@/features/mnda/parse";
import { db } from "@/lib/db";
import { RATE_LIMITED, withinLimits } from "@/lib/rateLimit";
import { isPlaceId } from "@/features/deployments/types";
import { isEmail, singleLine } from "@/lib/validation";
import { recordEvent, recordEvents } from "./audit";
import { blobInfo, deleteBlobs, deleteRoomBlobs, roomBlobPrefix } from "./blob";
import {
  acceptInvite,
  claimPendingInvites,
  findInvite,
  inviteUrl,
  issueInvite,
  reissueInvite,
  roomUrl,
  shareWithAccount,
  type AcceptResult,
  type IssuedInvite,
} from "./invites";
import {
  MAX_NAME_LENGTH,
  ROOM_QUOTA_BYTES,
  accountRoomsTag,
  canCreateRooms,
  countOtherAdmins,
  createRoom,
  deleteRoom,
  folderExists,
  folderSubtree,
  getMember,
  getRoomSite,
  isUuid,
  normalizeEmail,
  renameRoom,
  roomAccess,
  roomUsage,
  setRoomKind,
  setRoomSite,
  type RoomAccess,
} from "./rooms";
import {
  ROLES,
  isRoomKind,
  roomKindLabel,
  type ActionState,
  type InviteRef,
  type RoomKind,
  type RoomRole,
} from "./types";

const MAX_ADDRESS_LENGTH = 500;

const NO_ACCESS: ActionState = { error: "You don't have permission to do that. Try reloading the page." };

/** Names are shown as-is and used in zip paths, so path separators and control characters are rejected. */
function cleanName(raw: unknown): string | { error: string } {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return { error: "Enter a name." };
  if (name.length > MAX_NAME_LENGTH) return { error: "That name is too long." };
  if (/[/\\\u0000-\u001f]/.test(name) || name === "." || name === "..") {
    return { error: "Names can't contain slashes or control characters." };
  }
  return name;
}

const isRole = (value: unknown): value is RoomRole => value === "admin" || value === "viewer";

const roleLabel = (role: RoomRole): string => ROLES.find((r) => r.id === role)?.label ?? role;

const expiresOn = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

/** `shared` when the invitee's account already joined, so the email opens the room rather than the invite. */
function emailInvite(access: RoomAccess, invite: IssuedInvite, shared: boolean): void {
  after(() =>
    sendDataRoomInvite(
      invite.email,
      {
        roomName: access.room.name,
        inviterName: access.account.displayName,
        inviterEmail: access.account.email,
        roleLabel: roleLabel(invite.role),
        inviteUrl: shared ? roomUrl(access.room.id) : inviteUrl(invite.token),
        expiresOn: expiresOn.format(invite.expiresAt),
        requiresMnda: invite.requiresMnda,
        shared,
      },
      invite.token.slice(0, 16),
    ),
  );
}

// Rooms

export async function createRoomAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await getAccount();
  if (!account) return { error: "Your session has expired. Log in again." };
  if (!(await canCreateRooms(account))) return { error: "Your account can't create data rooms. Ask the ZODE team." };
  const name = cleanName(formData.get("name"));
  if (typeof name !== "string") return name;
  const kind = formData.get("kind");
  if (!isRoomKind(kind)) return { error: "Choose whether the room is for a purchase, a lease or colo." };

  const roomId = await createRoom(name, kind, account);
  await recordEvent({ roomId, account, action: "room_create", detail: { name, kind } });
  redirect(`/portal/data-rooms/${roomId}`);
}

export async function renameRoomAction(roomId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await roomAccess(roomId, "admin");
  if (!access) return NO_ACCESS;
  const name = cleanName(formData.get("name"));
  if (typeof name !== "string") return name;

  await renameRoom(roomId, name);
  await recordEvent({ roomId, account: access.account, action: "room_rename", detail: { from: access.room.name, to: name } });
  refresh();
  return { ok: "Room renamed." };
}

export async function changeRoomKindAction(roomId: string, kind: RoomKind): Promise<ActionState> {
  const access = await roomAccess(roomId, "admin");
  if (!access) return NO_ACCESS;
  if (!isRoomKind(kind)) return { error: "Choose a room type." };
  if (access.room.kind === kind) return {};

  await setRoomKind(roomId, access.room.kind, kind);
  await recordEvent({ roomId, account: access.account, action: "room_kind_change", detail: { from: access.room.kind, to: kind } });
  refresh();
  return { ok: `Room type changed to ${roomKindLabel(kind)}.` };
}

/** Saves the site address from the address field, or clears it when the field is empty. */
export async function setRoomAddressAction(roomId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await roomAccess(roomId, "admin");
  if (!access) return NO_ACCESS;
  const field = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? singleLine(value) : "";
  };
  const address = field("address");
  if (address.length > MAX_ADDRESS_LENGTH) return { error: "That address is too long." };
  const placeId = address ? field("place_id") : "";
  if (placeId && !isPlaceId(placeId)) return { error: "Pick the address from the list again." };
  const city = placeId ? field("city") : "";
  if (city.length > MAX_NAME_LENGTH) return { error: "That city is too long." };

  const before = await getRoomSite(roomId);
  if ((before?.address ?? "") === address && (before?.placeId ?? "") === placeId) return {};
  await setRoomSite(roomId, address ? { address, city: city || null, placeId: placeId || null } : null);
  await recordEvent({
    roomId,
    account: access.account,
    action: "room_address_change",
    detail: { from: before?.address ?? null, to: address || null },
  });
  refresh();
  return { ok: address ? "Address saved." : "Address removed." };
}

export async function deleteRoomAction(roomId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await roomAccess(roomId, "admin");
  if (!access) return NO_ACCESS;
  if (String(formData.get("confirm") ?? "").trim() !== access.room.name) {
    return { error: "Type the room's name exactly to confirm." };
  }

  await deleteRoomBlobs(roomId);
  await deleteRoom(roomId);
  redirect("/portal/data-rooms");
}

// Folders and files

export async function createFolderAction(
  roomId: string,
  parentId: string | null,
  rawName: string,
): Promise<ActionState & { id?: string }> {
  const access = await roomAccess(roomId, "admin");
  if (!access) return NO_ACCESS;
  const name = cleanName(rawName);
  if (typeof name !== "string") return name;
  if (!(await folderExists(roomId, parentId))) return { error: "That folder no longer exists." };

  const [row] = await db()`
    insert into data_room_folders (room_id, parent_id, name) values (${roomId}, ${parentId}, ${name}) returning id
  `;
  const id = String(row.id);
  await recordEvent({ roomId, account: access.account, action: "folder_create", detail: { name, folderId: id } });
  refresh();
  return { id };
}

export type ItemRef = { kind: "file" | "folder"; id: string };

const validRefs = (items: unknown): ItemRef[] =>
  Array.isArray(items)
    ? items.filter(
        (item): item is ItemRef =>
          typeof item === "object" && item !== null && (item.kind === "file" || item.kind === "folder") && isUuid(item.id),
      )
    : [];

export async function renameItemAction(roomId: string, item: ItemRef, rawName: string): Promise<ActionState> {
  const access = await roomAccess(roomId, "admin");
  if (!access) return NO_ACCESS;
  const [ref] = validRefs([item]);
  if (!ref) return { error: "That item no longer exists." };
  const name = cleanName(rawName);
  if (typeof name !== "string") return name;

  const sql = db();
  const [row] =
    ref.kind === "file"
      ? await sql`
          update data_room_files f set name = ${name}
          from (select id, name from data_room_files where id = ${ref.id}) old
          where f.id = old.id and f.room_id = ${roomId} and f.deleted_at is null
          returning old.name as old_name
        `
      : await sql`
          update data_room_folders f set name = ${name}
          from (select id, name from data_room_folders where id = ${ref.id}) old
          where f.id = old.id and f.room_id = ${roomId}
          returning old.name as old_name
        `;
  if (!row) return { error: "That item no longer exists." };

  await recordEvent({
    roomId,
    account: access.account,
    action: "rename",
    fileId: ref.kind === "file" ? ref.id : null,
    detail: { kind: ref.kind, from: String(row.old_name), to: name },
  });
  refresh();
  return {};
}

export async function moveItemsAction(roomId: string, items: ItemRef[], targetFolderId: string | null): Promise<ActionState> {
  const access = await roomAccess(roomId, "admin");
  if (!access) return NO_ACCESS;
  const refs = validRefs(items);
  if (!refs.length) return {};
  if (!(await folderExists(roomId, targetFolderId))) return { error: "That folder no longer exists." };

  const fileIds = refs.filter((r) => r.kind === "file").map((r) => r.id);
  const folderIds = refs.filter((r) => r.kind === "folder").map((r) => r.id);

  if (targetFolderId) {
    for (const folderId of folderIds) {
      if ((await folderSubtree(roomId, folderId)).includes(targetFolderId)) {
        return { error: "A folder can't be moved into itself." };
      }
    }
  }

  const sql = db();
  const [files, folders] = await Promise.all([
    fileIds.length
      ? sql`
          update data_room_files set folder_id = ${targetFolderId}
          where room_id = ${roomId} and id = any(${fileIds}::uuid[]) and deleted_at is null
          returning id, name
        `
      : Promise.resolve([]),
    folderIds.length
      ? sql`
          update data_room_folders set parent_id = ${targetFolderId}
          where room_id = ${roomId} and id = any(${folderIds}::uuid[])
          returning id, name
        `
      : Promise.resolve([]),
  ]);

  await recordEvents([
    ...files.map((row) => ({
      roomId,
      account: access.account,
      action: "move" as const,
      fileId: String(row.id),
      detail: { kind: "file", name: String(row.name), to: targetFolderId },
    })),
    ...folders.map((row) => ({
      roomId,
      account: access.account,
      action: "move" as const,
      detail: { kind: "folder", name: String(row.name), to: targetFolderId },
    })),
  ]);
  refresh();
  return {};
}

/** Folders go with everything inside them. File rows are kept, marked deleted, for the audit trail. */
export async function deleteItemsAction(roomId: string, items: ItemRef[]): Promise<ActionState> {
  const access = await roomAccess(roomId, "admin");
  if (!access) return NO_ACCESS;
  const refs = validRefs(items);
  if (!refs.length) return {};

  const folderIds = new Set<string>();
  for (const ref of refs.filter((r) => r.kind === "folder")) {
    for (const id of await folderSubtree(roomId, ref.id)) folderIds.add(id);
  }
  const fileIds = refs.filter((r) => r.kind === "file").map((r) => r.id);

  const sql = db();
  const files = await sql`
    update data_room_files set deleted_at = now()
    where room_id = ${roomId} and deleted_at is null
      and (id = any(${fileIds}::uuid[]) or folder_id = any(${[...folderIds]}::uuid[]))
    returning id, name, blob_pathname
  `;
  const folders = folderIds.size
    ? await sql`
        delete from data_room_folders where room_id = ${roomId} and id = any(${[...folderIds]}::uuid[])
        returning name, id
      `
    : [];

  await deleteBlobs(files.map((row) => String(row.blob_pathname)));
  const roots = new Set(refs.filter((r) => r.kind === "folder").map((r) => r.id));
  await recordEvents([
    ...files.map((row) => ({
      roomId,
      account: access.account,
      action: "delete" as const,
      fileId: String(row.id),
      detail: { kind: "file", name: String(row.name) },
    })),
    ...folders
      .filter((row) => roots.has(String(row.id)))
      .map((row) => ({
        roomId,
        account: access.account,
        action: "delete" as const,
        detail: { kind: "folder", name: String(row.name) },
      })),
  ]);
  refresh();
  return {};
}

/**
 * Records a file the browser just uploaded to Blob. The pathname must be under
 * this room's prefix (the upload token only allows that) and must exist, and
 * its size and type come from Blob rather than the browser.
 */
export async function registerUploadAction(
  roomId: string,
  folderId: string | null,
  pathname: string,
  rawName: string,
): Promise<ActionState> {
  const access = await roomAccess(roomId, "admin");
  if (!access) return NO_ACCESS;
  if (typeof pathname !== "string" || !pathname.startsWith(roomBlobPrefix(roomId)) || pathname.includes("..")) {
    return { error: "That upload doesn't belong to this room." };
  }
  const name = cleanName(rawName);
  if (typeof name !== "string") return name;
  if (!(await folderExists(roomId, folderId))) return { error: "That folder no longer exists." };

  const info = await blobInfo(pathname);
  if (!info) return { error: "The upload didn't finish. Try again." };
  // The upload token was sized to the space left, but parallel uploads can still overshoot together.
  if ((await roomUsage(roomId)) + info.size > ROOM_QUOTA_BYTES) {
    await deleteBlobs([pathname]);
    return { error: "This room is full. Delete some files to make space." };
  }

  const [row] = await db()`
    insert into data_room_files (room_id, folder_id, name, content_type, size_bytes, blob_pathname, uploaded_by_email)
    values (${roomId}, ${folderId}, ${name}, ${info.contentType || "application/octet-stream"}, ${info.size},
      ${pathname}, ${access.account.email.toLowerCase()})
    on conflict (blob_pathname) do nothing
    returning id
  `;
  if (row) {
    await recordEvent({
      roomId,
      account: access.account,
      action: "upload",
      fileId: String(row.id),
      detail: { name, size: info.size },
    });
  }
  refresh();
  return {};
}

// Members

const MAX_INVITES = 50;

const DAY = 24 * 60 * 60;

/** Every invite emails an address the admin typed, so sends are capped per admin and per room. */
const withinInviteLimits = (roomId: string, access: RoomAccess, count: number): Promise<boolean> =>
  withinLimits([
    { key: `invite:user:${access.account.userId}`, max: 100, windowSeconds: DAY, cost: count },
    { key: `invite:room:${roomId}`, max: 50, windowSeconds: DAY, cost: count },
  ]);

export async function inviteMembersAction(roomId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await roomAccess(roomId, "admin");
  if (!access) return NO_ACCESS;
  const role = formData.get("role");
  if (!isRole(role)) return { error: "Choose a role." };
  const requiresMnda = formData.get("requireMnda") === "on";

  const emails = [
    ...new Set(
      String(formData.get("emails") ?? "")
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (!emails.length) return { error: "Enter at least one email." };
  if (emails.length > MAX_INVITES) return { error: `Invite up to ${MAX_INVITES} people at a time.` };
  const invalid = emails.find((e) => !isEmail(e));
  if (invalid) return { error: `${invalid} is not a valid email.` };
  if (!(await withinInviteLimits(roomId, access, emails.length))) return { error: RATE_LIMITED };

  const shared: string[] = [];
  const invited: string[] = [];
  const existing: string[] = [];
  for (const email of emails) {
    const invite = await issueInvite(roomId, email, role, access.account.email.toLowerCase(), requiresMnda);
    const joined = invite && (await shareWithAccount(roomId, invite));
    if (!invite || joined?.alreadyMember) {
      existing.push(email);
      continue;
    }
    (joined ? shared : invited).push(email);
    emailInvite(access, invite, Boolean(joined));
    await recordEvent({
      roomId,
      account: access.account,
      action: "invite",
      detail: { email, role, requiresMnda, ...(joined ? { shared: true } : {}) },
    });
  }

  refresh();
  const parts = [];
  if (shared.length) parts.push(`Shared with ${shared.join(", ")}.`);
  if (invited.length) parts.push(`Invited ${invited.join(", ")}.`);
  if (existing.length) parts.push(`${existing.join(", ")} already ${existing.length === 1 ? "has" : "have"} access.`);
  return shared.length || invited.length ? { ok: parts.join(" ") } : { error: parts.join(" ") };
}

export async function resendInviteAction(roomId: string, memberId: string): Promise<ActionState> {
  const access = await roomAccess(roomId, "admin");
  if (!access) return NO_ACCESS;
  if (!(await withinInviteLimits(roomId, access, 1))) return { error: RATE_LIMITED };
  const invite = isUuid(memberId) ? await reissueInvite(roomId, memberId, access.account.email.toLowerCase()) : null;
  if (!invite) return { error: "That invite was already accepted or removed." };

  const joined = await shareWithAccount(roomId, invite);
  if (joined?.alreadyMember) {
    refresh();
    return { ok: `${invite.email} already has access.` };
  }
  emailInvite(access, invite, Boolean(joined));
  await recordEvent({
    roomId,
    account: access.account,
    action: "invite_resend",
    detail: { email: invite.email, ...(joined ? { shared: true } : {}) },
  });
  refresh();
  return { ok: joined ? `Shared with ${invite.email}.` : `Sent a new link to ${invite.email}.` };
}

export async function changeRoleAction(roomId: string, memberId: string, role: RoomRole): Promise<ActionState> {
  const access = await roomAccess(roomId, "admin");
  if (!access) return NO_ACCESS;
  if (!isRole(role)) return { error: "Choose a role." };
  const member = await getMember(roomId, memberId);
  if (!member) return { error: "That person is no longer in this room." };
  if (member.role === role) return {};
  if (member.role === "admin" && member.active && (await countOtherAdmins(roomId, member.id)) === 0) {
    return { error: "A data room needs at least one admin." };
  }

  await db()`update data_room_members set role = ${role} where id = ${member.id}`;
  await recordEvent({
    roomId,
    account: access.account,
    action: "role_change",
    detail: { email: member.email, from: member.role, to: role },
  });
  refresh();
  return {};
}

/** Removes an active member or revokes a pending invite; either way access ends on their next request. */
export async function removeMemberAction(roomId: string, memberId: string): Promise<ActionState> {
  const access = await roomAccess(roomId, "admin");
  if (!access) return NO_ACCESS;
  const member = await getMember(roomId, memberId);
  if (!member) return {};
  if (member.role === "admin" && member.active && (await countOtherAdmins(roomId, member.id)) === 0) {
    return { error: "A data room needs at least one admin." };
  }

  await db()`delete from data_room_members where id = ${member.id}`;
  await recordEvent({
    roomId,
    account: access.account,
    action: member.active ? "remove" : "invite_revoke",
    detail: { email: member.email, role: member.role },
  });
  if (member.userId === access.account.userId) redirect("/portal/data-rooms");
  refresh();
  return {};
}

/**
 * Re-renders the page with the account's rooms fresh, for an open portal told
 * over the event stream that they changed; the expired tag makes this render
 * wait for new data rather than show the cached rooms.
 */
export async function refreshMyRoomsAction(): Promise<void> {
  const account = await getAccount();
  if (!account) return;
  updateTag(accountRoomsTag(account.userId));
  refresh();
}

// Invites

const ACCEPT_ERRORS: Record<Extract<AcceptResult, { ok: false }>["reason"], string> = {
  invalid: "This invite is no longer valid.",
  expired: "This invite has expired. Ask the room's admin to resend it.",
  "email-mismatch": "This invite was sent to a different email address.",
  "mnda-required": "Sign the mutual NDA to open this data room.",
};

/** Joins the invite's room, and any others an MNDA just signed has opened, then goes into the room. */
async function joinRoom(ref: InviteRef, account: Account): Promise<ActionState> {
  const result = await acceptInvite(ref, account);
  if (!result.ok) return { error: ACCEPT_ERRORS[result.reason] };
  await recordEvent({
    roomId: result.roomId,
    account,
    action: "accept",
    detail: { email: result.email, role: result.role },
  });
  await claimPendingInvites(account);
  redirect(`/portal/data-rooms/${result.roomId}`);
}

export async function acceptInviteAction(ref: InviteRef): Promise<ActionState> {
  const account = await getAccount();
  if (!account) return { error: "Log in to accept this invite." };
  return joinRoom(ref, account);
}

/** For invites that require the MNDA: signs it as the invited, signed-in account, then joins the room. */
export async function signMndaAndAcceptInviteAction(
  ref: InviteRef,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const account = await getAccount();
  if (!account) return { error: "Log in to accept this invite." };
  const invite = await findInvite(ref);
  if (!invite) return { error: ACCEPT_ERRORS.invalid };
  if (invite.expired) return { error: ACCEPT_ERRORS.expired };
  if (normalizeEmail(account.email) !== invite.email) return { error: ACCEPT_ERRORS["email-mismatch"] };

  if (!(await hasSignedMnda(account.userId))) {
    const parsed = parseMnda(formData, invite.email);
    if (!parsed.ok) return { error: parsed.error };
    if (!(await withinLimits([{ key: `mnda:user:${account.userId}`, max: 5, windowSeconds: 60 * 60 }]))) {
      return { error: RATE_LIMITED };
    }
    let mnda: ExecutedMnda;
    try {
      mnda = await createMnda(parsed.party, parsed.templateVersion, {
        userId: account.userId,
        room: { id: invite.roomId, name: invite.roomName },
      });
    } catch (err) {
      return { error: signFailure(err) };
    }
    after(() => sendMndaEmails(mnda, invite.roomName));
    await recordEvent({
      roomId: invite.roomId,
      account,
      action: "mnda_sign",
      detail: { mndaId: mnda.id, entity: mnda.party.entityName, email: invite.email },
    });
  }
  return joinRoom(ref, account);
}
