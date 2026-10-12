import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Account } from "./zos";

const loadIsSuperAdmin = cache(async (zosUserId: string): Promise<boolean> => {
  try {
    const [row] = await db()`select 1 from users where zos_user_id = ${zosUserId} and role = 'super_admin'`;
    return Boolean(row);
  } catch (error) {
    console.error("[admin] role lookup failed; treating as a member", error);
    return false;
  }
});

/**
 * ZODE super admins, who see every account's records in the portal and grant
 * or revoke super admin for others on the Users page: `users.role`, keyed by
 * ZOS user id rather than email, because ZOS registration is open and doesn't
 * verify addresses.
 */
export function isZodeAdmin(account: Account): Promise<boolean> {
  return loadIsSuperAdmin(account.userId);
}
