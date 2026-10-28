import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Account } from "@/features/account/zos";
import { hasSignedMnda } from "@/features/mnda/mndas";
import { db } from "@/lib/db";
import { siteOrigin } from "@/lib/site";
import { recordEvents } from "./audit";
import { isUuid, normalizeEmail } from "./rooms";
import type { InviteRef, PendingInvite, RoomRole } from "./types";

const INVITE_TTL_DAYS = 14;

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

function newToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000) };
}

/** Where an invite link points; only the emailed copy of the token exists, the database keeps its hash. */
export const inviteUrl = (token: string, origin = siteOrigin()): string => `${origin}/data-rooms/invite/${token}`;

/** Where the email points once the room is already shared with the invitee's account. */
export const roomUrl = (roomId: string, origin = siteOrigin()): string => `${origin}/portal/data-rooms/${roomId}`;

export interface IssuedInvite {
  memberId: string;
  email: string;
  role: RoomRole;
  requiresMnda: boolean;
  token: string;
  expiresAt: Date;
}

/**
 * Invites `email` (or refreshes a pending invite with a new token, role and
 * MNDA requirement). Returns `null` when that email is already an active member.
 */
export async function issueInvite(
  roomId: string,
  rawEmail: string,
  role: RoomRole,
  invitedBy: string,
  requiresMnda: boolean,
): Promise<IssuedInvite | null> {
  const email = normalizeEmail(rawEmail);
  const { token, hash, expiresAt } = newToken();
  const [row] = await db()`
    insert into data_room_members (room_id, email, role, invited_by_email, invite_token_hash, invite_expires_at, requires_mnda)
    values (${roomId}, ${email}, ${role}, ${invitedBy}, ${hash}, ${expiresAt}, ${requiresMnda})
    on conflict (room_id, email) do update set
      role = excluded.role,
      invited_by_email = excluded.invited_by_email,
      invited_at = now(),
      invite_token_hash = excluded.invite_token_hash,
      invite_expires_at = excluded.invite_expires_at,
      requires_mnda = excluded.requires_mnda
    where data_room_members.accepted_at is null
    returning id
  `;
  return row ? { memberId: String(row.id), email, role, requiresMnda, token, expiresAt } : null;
}

/** A fresh token for a pending invite; the old link stops working. */
export async function reissueInvite(roomId: string, memberId: string, invitedBy: string): Promise<IssuedInvite | null> {
  const { token, hash, expiresAt } = newToken();
  const [row] = await db()`
    update data_room_members
    set invite_token_hash = ${hash}, invite_expires_at = ${expiresAt}, invited_at = now(), invited_by_email = ${invitedBy}
    where room_id = ${roomId} and id = ${memberId} and accepted_at is null
    returning id, email, role, requires_mnda
  `;
  return row
    ? {
        memberId: String(row.id),
        email: String(row.email),
        role: row.role as RoomRole,
        requiresMnda: Boolean(row.requires_mnda),
        token,
        expiresAt,
      }
    : null;
}

export interface InviteDetails {
  memberId: string;
  roomId: string;
  roomName: string;
  email: string;
  role: RoomRole;
  invitedBy: string | null;
  invitedAt: string;
  expiresAt: string | null;
  expired: boolean;
  requiresMnda: boolean;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;

const toInvite = (row: Record<string, unknown>): InviteDetails => ({
  memberId: String(row.id),
  roomId: String(row.room_id),
  roomName: String(row.name),
  email: String(row.email),
  role: row.role as RoomRole,
  invitedBy: row.invited_by_email == null ? null : String(row.invited_by_email),
  invitedAt: new Date(row.invited_at as string).toISOString(),
  expiresAt: row.invite_expires_at == null ? null : new Date(row.invite_expires_at as string).toISOString(),
  expired: !row.invite_expires_at || new Date(row.invite_expires_at as string).getTime() <= Date.now(),
  requiresMnda: Boolean(row.requires_mnda),
});

/** A pending invite by its link's token or its member row; `ref` may come straight from the browser. */
export async function findInvite(ref: InviteRef): Promise<InviteDetails | null> {
  if (typeof ref !== "object" || ref === null) return null;
  const sql = db();
  if ("token" in ref) {
    if (typeof ref.token !== "string" || !TOKEN_RE.test(ref.token)) return null;
    const [row] = await sql`
      select m.id, m.room_id, r.name, m.email, m.role, m.invited_by_email, m.invited_at, m.invite_expires_at, m.requires_mnda
      from data_room_members m
      join data_rooms r on r.id = m.room_id
      where m.invite_token_hash = ${hashToken(ref.token)} and m.accepted_at is null
    `;
    return row ? toInvite(row) : null;
  }
  if (!("memberId" in ref) || !isUuid(ref.memberId)) return null;
  const [row] = await sql`
    select m.id, m.room_id, r.name, m.email, m.role, m.invited_by_email, m.invited_at, m.invite_expires_at, m.requires_mnda
    from data_room_members m
    join data_rooms r on r.id = m.room_id
    where m.id = ${ref.memberId} and m.accepted_at is null
  `;
  return row ? toInvite(row) : null;
}

export type AcceptResult =
  | { ok: true; roomId: string; role: RoomRole; email: string; alreadyMember: boolean }
  | { ok: false; reason: "invalid" | "expired" | "email-mismatch" | "mnda-required" };

type Bindable = Pick<InviteDetails, "memberId" | "roomId" | "role" | "email" | "requiresMnda">;

/** Puts `userId` in the invite's room, unless the MNDA it requires is still unsigned. */
async function bindInvite(invite: Bindable, userId: string): Promise<AcceptResult> {
  const joined = (alreadyMember: boolean): AcceptResult => ({
    ok: true,
    roomId: invite.roomId,
    role: invite.role,
    email: invite.email,
    alreadyMember,
  });
  const sql = db();
  const [existing] = await sql`
    select id from data_room_members
    where room_id = ${invite.roomId} and user_id = ${userId} and accepted_at is not null
  `;
  if (existing) {
    // Already in the room under another address; the spare invite has nothing left to grant.
    await sql`delete from data_room_members where id = ${invite.memberId}`;
    return joined(true);
  }
  if (invite.requiresMnda && !(await hasSignedMnda(userId))) return { ok: false, reason: "mnda-required" };

  const [row] = await sql`
    update data_room_members
    set user_id = ${userId}, accepted_at = now(), invite_token_hash = null, invite_expires_at = null
    where id = ${invite.memberId} and accepted_at is null
    returning id
  `;
  return row ? joined(false) : { ok: false, reason: "invalid" };
}

/**
 * Binds a pending invite to the signed-in account it was sent to. ZOS doesn't
 * verify addresses, so the account's email matching the invite's is what
 * grants it, with or without the emailed link.
 */
export async function acceptInvite(ref: InviteRef, account: Account): Promise<AcceptResult> {
  const invite = await findInvite(ref);
  if (!invite) return { ok: false, reason: "invalid" };
  if (invite.expired) return { ok: false, reason: "expired" };
  if (normalizeEmail(account.email) !== invite.email) return { ok: false, reason: "email-mismatch" };
  return bindInvite(invite, account.userId);
}

/**
 * Shares a just-issued invite with the account already signed up with its
 * email, if any, so it needn't follow the link. `null` leaves the invite
 * pending: there's no such account, or it has yet to sign a required MNDA.
 */
export async function shareWithAccount(
  roomId: string,
  invite: IssuedInvite,
): Promise<Extract<AcceptResult, { ok: true }> | null> {
  const [account] = await db()`
    select user_id from account_directory where lower(email) = ${invite.email} order by last_seen_at desc limit 1
  `;
  if (!account) return null;
  const result = await bindInvite({ ...invite, roomId }, String(account.user_id));
  return result.ok ? result : null;
}

/** Unexpired invites to the account's email, for rooms it isn't in yet, oldest first. */
async function pendingInvitesFor(account: Account): Promise<InviteDetails[]> {
  const rows = await db()`
    select m.id, m.room_id, r.name, m.email, m.role, m.invited_by_email, m.invited_at, m.invite_expires_at, m.requires_mnda
    from data_room_members m
    join data_rooms r on r.id = m.room_id
    where m.email = ${normalizeEmail(account.email)} and m.accepted_at is null and m.invite_expires_at > now()
      and not exists (
        select 1 from data_room_members a
        where a.room_id = m.room_id and a.user_id = ${account.userId} and a.accepted_at is not null
      )
    order by m.invited_at asc
  `;
  return rows.map(toInvite);
}

/** Invites the account can join from its portal, without the emailed link. */
export async function listPendingInvites(account: Account): Promise<PendingInvite[]> {
  const invites = await pendingInvitesFor(account);
  const signed = invites.some((invite) => invite.requiresMnda) && (await hasSignedMnda(account.userId));
  return invites.map((invite) => ({
    memberId: invite.memberId,
    roomName: invite.roomName,
    role: invite.role,
    invitedBy: invite.invitedBy,
    invitedAt: invite.invitedAt,
    expiresAt: invite.expiresAt,
    needsMnda: invite.requiresMnda && !signed,
  }));
}

/**
 * Joins every pending invite to the account's email that doesn't wait on an
 * unsigned MNDA: those sent before it signed up, or opened by an MNDA it just signed.
 */
export async function claimPendingInvites(account: Account): Promise<void> {
  const invites = await pendingInvitesFor(account);
  if (!invites.length) return;
  const signed = await hasSignedMnda(account.userId);
  const joined: Extract<AcceptResult, { ok: true }>[] = [];
  for (const invite of invites) {
    if (invite.requiresMnda && !signed) continue;
    const result = await bindInvite(invite, account.userId);
    if (result.ok && !result.alreadyMember) joined.push(result);
  }
  await recordEvents(
    joined.map((result) => ({
      roomId: result.roomId,
      account,
      action: "accept" as const,
      detail: { email: result.email, role: result.role, auto: true },
    })),
  );
}

/** Changes whenever the account's rooms or pending invites do, so an open portal knows to refresh. */
export async function roomsVersion(account: Account): Promise<string> {
  const rows = await db()`
    select m.id, m.role, m.accepted_at is not null as active, m.requires_mnda, r.name
    from data_room_members m
    join data_rooms r on r.id = m.room_id
    where (m.user_id = ${account.userId} and m.accepted_at is not null)
      or (m.email = ${normalizeEmail(account.email)} and m.accepted_at is null and m.invite_expires_at > now())
    order by m.id
  `;
  return createHash("sha256").update(JSON.stringify(rows)).digest("base64url").slice(0, 16);
}
