import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Account } from "@/features/account/zos";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { normalizeEmail } from "./rooms";
import type { RoomRole } from "./types";

const INVITE_TTL_DAYS = 14;

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

function newToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000) };
}

/** Where an invite link points; only the emailed copy of the token exists, the database keeps its hash. */
export const inviteUrl = (token: string, origin = siteOrigin()): string => `${origin}/data-rooms/invite/${token}`;

/** Links in email point at the deployment that sent them, so preview and local invites stay testable. */
function siteOrigin(): string {
  if (process.env.VERCEL_ENV === "production") return SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NODE_ENV === "development" ? `http://localhost:${process.env.PORT || 3000}` : SITE_URL;
}

export interface IssuedInvite {
  memberId: string;
  email: string;
  role: RoomRole;
  token: string;
  expiresAt: Date;
}

/**
 * Invites `email` (or refreshes a pending invite with a new token and role).
 * Returns `null` when that email is already an active member.
 */
export async function issueInvite(
  roomId: string,
  rawEmail: string,
  role: RoomRole,
  invitedBy: string,
): Promise<IssuedInvite | null> {
  const email = normalizeEmail(rawEmail);
  const { token, hash, expiresAt } = newToken();
  const [row] = await db()`
    insert into data_room_members (room_id, email, role, invited_by_email, invite_token_hash, invite_expires_at)
    values (${roomId}, ${email}, ${role}, ${invitedBy}, ${hash}, ${expiresAt})
    on conflict (room_id, email) do update set
      role = excluded.role,
      invited_by_email = excluded.invited_by_email,
      invited_at = now(),
      invite_token_hash = excluded.invite_token_hash,
      invite_expires_at = excluded.invite_expires_at
    where data_room_members.accepted_at is null
    returning id
  `;
  return row ? { memberId: String(row.id), email, role, token, expiresAt } : null;
}

/** A fresh token for a pending invite; the old link stops working. */
export async function reissueInvite(roomId: string, memberId: string, invitedBy: string): Promise<IssuedInvite | null> {
  const { token, hash, expiresAt } = newToken();
  const [row] = await db()`
    update data_room_members
    set invite_token_hash = ${hash}, invite_expires_at = ${expiresAt}, invited_at = now(), invited_by_email = ${invitedBy}
    where room_id = ${roomId} and id = ${memberId} and accepted_at is null
    returning id, email, role
  `;
  return row
    ? { memberId: String(row.id), email: String(row.email), role: row.role as RoomRole, token, expiresAt }
    : null;
}

export interface InviteDetails {
  memberId: string;
  roomId: string;
  roomName: string;
  email: string;
  role: RoomRole;
  invitedBy: string | null;
  expired: boolean;
}

export async function findInvite(token: string): Promise<InviteDetails | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db()`
    select m.id, m.room_id, r.name, m.email, m.role, m.invited_by_email, m.invite_expires_at
    from data_room_members m
    join data_rooms r on r.id = m.room_id
    where m.invite_token_hash = ${hashToken(token)} and m.accepted_at is null
  `;
  if (!row) return null;
  return {
    memberId: String(row.id),
    roomId: String(row.room_id),
    roomName: String(row.name),
    email: String(row.email),
    role: row.role as RoomRole,
    invitedBy: row.invited_by_email == null ? null : String(row.invited_by_email),
    expired: !row.invite_expires_at || new Date(row.invite_expires_at as string).getTime() <= Date.now(),
  };
}

export type AcceptResult =
  | { ok: true; roomId: string; role: RoomRole; email: string }
  | { ok: false; reason: "invalid" | "expired" | "email-mismatch" };

/**
 * Binds a pending invite to the signed-in account. The token proves the
 * account holder received mail at the invited address, which ZOS registration
 * alone doesn't, so the email must match as well.
 */
export async function acceptInvite(token: string, account: Account): Promise<AcceptResult> {
  const invite = await findInvite(token);
  if (!invite) return { ok: false, reason: "invalid" };
  if (invite.expired) return { ok: false, reason: "expired" };
  if (normalizeEmail(account.email) !== invite.email) return { ok: false, reason: "email-mismatch" };

  const sql = db();
  const [existing] = await sql`
    select id from data_room_members
    where room_id = ${invite.roomId} and user_id = ${account.userId} and accepted_at is not null
  `;
  if (existing) {
    // Already in the room under another address; the spare invite has nothing left to grant.
    await sql`delete from data_room_members where id = ${invite.memberId}`;
    return { ok: true, roomId: invite.roomId, role: invite.role, email: invite.email };
  }

  const [row] = await sql`
    update data_room_members
    set user_id = ${account.userId}, accepted_at = now(), invite_token_hash = null, invite_expires_at = null
    where id = ${invite.memberId} and accepted_at is null
    returning id
  `;
  return row
    ? { ok: true, roomId: invite.roomId, role: invite.role, email: invite.email }
    : { ok: false, reason: "invalid" };
}
