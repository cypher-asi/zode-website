"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendTeamInvite } from "@/emails/send";
import { isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import type { Account } from "@/features/account/zos";
import { isUuid } from "@/features/data-room/rooms";
import { setRole, userIdFor } from "@/features/users/users";
import { RATE_LIMITED, withinLimits } from "@/lib/rateLimit";
import { isEmail } from "@/lib/validation";
import {
  acceptTeamInvite,
  issueTeamInvite,
  reissueTeamInvite,
  revokeTeamInvite,
  teamInviteUrl,
  type AcceptTeamResult,
  type IssuedTeamInvite,
} from "./invites";

export interface TeamActionState {
  readonly error?: string;
  readonly ok?: string;
}

const NO_ACCESS: TeamActionState = { error: "You don't have permission to do that. Try reloading the page." };

const MAX_INVITES = 20;

const DAY = 24 * 60 * 60;

const expiresOn = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

async function superAdmin(): Promise<Account | null> {
  const account = await getAccount();
  return account && (await isZodeAdmin(account)) ? account : null;
}

/** Every invite emails an address the admin typed, so sends are capped per admin. */
const withinInviteLimits = (account: Account, count: number): Promise<boolean> =>
  withinLimits([{ key: `team-invite:user:${account.userId}`, max: 50, windowSeconds: DAY, cost: count }]);

function emailInvite(account: Account, invite: IssuedTeamInvite): void {
  after(() =>
    sendTeamInvite(
      invite.email,
      {
        inviterName: account.displayName,
        inviterEmail: account.email,
        inviteUrl: teamInviteUrl(invite.token),
        expiresOn: expiresOn.format(invite.expiresAt),
      },
      invite.token.slice(0, 16),
    ),
  );
}

export async function inviteTeamAction(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const account = await superAdmin();
  if (!account) return NO_ACCESS;

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
  if (!(await withinInviteLimits(account, emails.length))) return { error: RATE_LIMITED };

  try {
    for (const email of emails) emailInvite(account, await issueTeamInvite(email, account.userId));
  } catch (error) {
    console.error("[team] couldn't issue invites", error);
    return { error: "Couldn't send invites right now. Please try again." };
  }
  refresh();
  return { ok: `Invited ${emails.join(", ")}.` };
}

export async function resendTeamInviteAction(inviteId: string): Promise<TeamActionState> {
  const account = await superAdmin();
  if (!account) return NO_ACCESS;
  if (!(await withinInviteLimits(account, 1))) return { error: RATE_LIMITED };
  const invite = isUuid(inviteId) ? await reissueTeamInvite(inviteId, account.userId) : null;
  if (!invite) return { error: "That invite was already accepted or revoked." };
  emailInvite(account, invite);
  refresh();
  return { ok: `Sent a new link to ${invite.email}.` };
}

export async function revokeTeamInviteAction(inviteId: string): Promise<TeamActionState> {
  if (!(await superAdmin())) return NO_ACCESS;
  if (isUuid(inviteId)) await revokeTeamInvite(inviteId);
  refresh();
  return {};
}

/** Puts an existing Regular user on the team, without an invite. */
export async function addToTeamAction(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const account = await superAdmin();
  if (!account) return NO_ACCESS;
  const userId = Number(formData.get("userId"));
  if (!Number.isSafeInteger(userId) || userId <= 0) return { error: "Choose someone to add." };
  try {
    if (!(await setRole(userId, "team", account.userId, "member"))) {
      return { error: "That user is already on the team or no longer exists." };
    }
  } catch (error) {
    console.error("[team] couldn't add to team", userId, error);
    return { error: "Couldn't save right now. Please try again." };
  }
  refresh();
  return {};
}

/** Takes a Team user back to Regular. Super admins are changed on the Users page instead. */
export async function removeFromTeamAction(userId: number): Promise<TeamActionState> {
  const account = await superAdmin();
  if (!account) return NO_ACCESS;
  if (!Number.isSafeInteger(userId) || userId <= 0) return { error: "That isn't a valid change." };
  try {
    if ((await userIdFor(account.userId)) === userId) return { error: "You can't change your own role." };
    if (!(await setRole(userId, "member", account.userId, "team"))) {
      return { error: "That user is no longer on the team, or is a super admin." };
    }
  } catch (error) {
    console.error("[team] couldn't remove from team", userId, error);
    return { error: "Couldn't save right now. Please try again." };
  }
  refresh();
  return {};
}

const ACCEPT_ERRORS: Record<Extract<AcceptTeamResult, { ok: false }>["reason"], string> = {
  invalid: "This invite is no longer valid.",
  expired: "This invite has expired. Ask a ZODE super admin to resend it.",
  "email-mismatch": "This invite was sent to a different email address.",
};

export async function acceptTeamInviteAction(token: string): Promise<TeamActionState> {
  const account = await getAccount();
  if (!account) return { error: "Log in to accept this invite." };
  const result = await acceptTeamInvite(token, account);
  if (!result.ok) return { error: ACCEPT_ERRORS[result.reason] };
  redirect("/portal/settings/team");
}
