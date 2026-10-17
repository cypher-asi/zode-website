import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Account } from "@/features/account/zos";
import { normalizeEmail } from "@/features/data-room/rooms";
import type { InviteRole } from "@/features/users/types";
import { db } from "@/lib/db";
import { siteOrigin } from "@/lib/site";

const INVITE_TTL_DAYS = 14;

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

function newToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000) };
}

/** Where an invite link points; only the emailed copy of the token exists, the database keeps its hash. */
export const teamInviteUrl = (token: string, origin = siteOrigin()): string => `${origin}/invite/${token}`;

export interface IssuedTeamInvite {
  id: string;
  email: string;
  role: InviteRole;
  token: string;
  expiresAt: Date;
}

export interface PendingTeamInvite {
  id: string;
  email: string;
  role: InviteRole;
  invitedBy: string | null;
  invitedAt: Date;
  expired: boolean;
}

/** Invites `email` as `role`, or refreshes its pending invite with a new token and that role. */
export async function issueTeamInvite(
  rawEmail: string,
  inviterZosUserId: string,
  role: InviteRole = "team",
): Promise<IssuedTeamInvite> {
  const email = normalizeEmail(rawEmail);
  const { token, hash, expiresAt } = newToken();
  const [row] = await db()`
    insert into team_invites (email, role, invite_token_hash, invite_expires_at, invited_by)
    values (${email}, ${role}, ${hash}, ${expiresAt}, (select id from users where zos_user_id = ${inviterZosUserId}))
    on conflict (email) where accepted_at is null do update set
      role = excluded.role,
      invite_token_hash = excluded.invite_token_hash,
      invite_expires_at = excluded.invite_expires_at,
      invited_by = excluded.invited_by,
      invited_at = now()
    returning id
  `;
  return { id: String(row.id), email, role, token, expiresAt };
}

/** A fresh token for a pending invite; the old link stops working. */
export async function reissueTeamInvite(inviteId: string, inviterZosUserId: string): Promise<IssuedTeamInvite | null> {
  const { token, hash, expiresAt } = newToken();
  const [row] = await db()`
    update team_invites set
      invite_token_hash = ${hash},
      invite_expires_at = ${expiresAt},
      invited_by = (select id from users where zos_user_id = ${inviterZosUserId}),
      invited_at = now()
    where id = ${inviteId} and accepted_at is null
    returning id, email, role
  `;
  return row
    ? { id: String(row.id), email: String(row.email), role: row.role as InviteRole, token, expiresAt }
    : null;
}

/** Revokes a pending invite. Returns the email it was for, or `null` when there was none. */
export async function revokeTeamInvite(inviteId: string): Promise<string | null> {
  const [row] = await db()`delete from team_invites where id = ${inviteId} and accepted_at is null returning email`;
  return row ? String(row.email) : null;
}

/** Invites not yet accepted, oldest first; only those for `role` when it's given. */
export async function listPendingTeamInvites(role?: InviteRole): Promise<PendingTeamInvite[]> {
  const rows = await db()`
    select i.id, i.email, i.role, i.invited_at, i.invite_expires_at, coalesce(p.display_name, d.display_name, d.email) as invited_by
    from team_invites i
    left join users u on u.id = i.invited_by
    left join account_directory d on d.user_id = u.zos_user_id
    left join account_profiles p on p.user_id = u.zos_user_id
    where i.accepted_at is null and (${role ?? null}::text is null or i.role = ${role ?? null})
    order by i.invited_at asc
  `;
  const now = Date.now();
  return rows.map((row) => ({
    id: String(row.id),
    email: String(row.email),
    role: row.role as InviteRole,
    invitedBy: row.invited_by == null ? null : String(row.invited_by),
    invitedAt: new Date(row.invited_at as string | Date),
    expired: !row.invite_expires_at || new Date(row.invite_expires_at as string).getTime() <= now,
  }));
}

export interface TeamInviteDetails {
  id: string;
  email: string;
  role: InviteRole;
  invitedBy: string | null;
  expired: boolean;
}

export async function findTeamInvite(token: string): Promise<TeamInviteDetails | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db()`
    select i.id, i.email, i.role, i.invite_expires_at, coalesce(p.display_name, d.display_name, d.email) as invited_by
    from team_invites i
    left join users u on u.id = i.invited_by
    left join account_directory d on d.user_id = u.zos_user_id
    left join account_profiles p on p.user_id = u.zos_user_id
    where i.invite_token_hash = ${hashToken(token)} and i.accepted_at is null
  `;
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    role: row.role as InviteRole,
    invitedBy: row.invited_by == null ? null : String(row.invited_by),
    expired: !row.invite_expires_at || new Date(row.invite_expires_at as string).getTime() <= Date.now(),
  };
}

export type AcceptTeamResult =
  | { ok: true; email: string; role: InviteRole }
  | { ok: false; reason: "invalid" | "expired" | "email-mismatch" };

/**
 * Records the signed-in account as having accepted, and puts it on the team
 * for a Team invite. The token proves the account holder received mail at the
 * invited address, which ZOS registration alone doesn't, so the email must
 * match as well. Nobody's role is ever lowered: a super admin keeps theirs,
 * and a Regular invite leaves a Team account as it is.
 */
export async function acceptTeamInvite(token: string, account: Account): Promise<AcceptTeamResult> {
  const invite = await findTeamInvite(token);
  if (!invite) return { ok: false, reason: "invalid" };
  if (invite.expired) return { ok: false, reason: "expired" };
  if (normalizeEmail(account.email) !== invite.email) return { ok: false, reason: "email-mismatch" };

  const sql = db();
  await sql`
    insert into users (zos_user_id) select ${account.userId}
    where not exists (select 1 from users where zos_user_id = ${account.userId})
  `;
  const [accepted] = await sql`
    update team_invites set
      accepted_at = now(),
      accepted_user_id = (select id from users where zos_user_id = ${account.userId}),
      invite_token_hash = null,
      invite_expires_at = null
    where id = ${invite.id} and accepted_at is null
    returning id
  `;
  if (!accepted) return { ok: false, reason: "invalid" };
  if (invite.role === "team") {
    await sql`
      update users set
        role = 'team',
        role_updated_at = now(),
        role_updated_by = (select invited_by from team_invites where id = ${invite.id})
      where zos_user_id = ${account.userId} and role = 'member'
    `;
  }
  return { ok: true, email: invite.email, role: invite.role };
}
