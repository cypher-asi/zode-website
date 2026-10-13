import "server-only";
import { cache } from "react";
import { isUserRole, onTeam, type UserRole } from "@/features/users/types";
import { db } from "@/lib/db";
import type { Account } from "./zos";

const loadRole = cache(async (zosUserId: string): Promise<UserRole> => {
  try {
    const [row] = await db()`select role from users where zos_user_id = ${zosUserId}`;
    return row && isUserRole(row.role) ? row.role : "member";
  } catch (error) {
    console.error("[admin] role lookup failed; treating as a member", error);
    return "member";
  }
});

/**
 * The account's site-wide role, `users.role`, keyed by ZOS user id rather
 * than email, because ZOS registration is open and doesn't verify addresses.
 * Separate from the account's role in any data room.
 */
export function systemRole(account: Account): Promise<UserRole> {
  return loadRole(account.userId);
}

/** ZODE super admins, who see every account's records in the portal and set anyone's role. */
export async function isZodeAdmin(account: Account): Promise<boolean> {
  return (await loadRole(account.userId)) === "super_admin";
}

/** The ZODE team, super admins included: they can open data rooms and see the team in Settings. */
export async function isTeam(account: Account): Promise<boolean> {
  return onTeam(await loadRole(account.userId));
}
