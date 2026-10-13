"use server";

import { refresh } from "next/cache";
import { isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { setRole, userIdFor } from "./users";
import { isUserRole, type RoleResult } from "./types";

/**
 * Sets anyone's site-wide role: Regular, Team or Super admin. Super admins
 * can't change their own role, so whoever acts always remains one and the
 * site can't be left without any.
 */
export async function setRoleAction(userId: number, role: unknown): Promise<RoleResult> {
  const account = await getAccount();
  if (!account || !(await isZodeAdmin(account))) {
    return { error: "You don't have permission to do that. Try reloading the page." };
  }
  if (!Number.isSafeInteger(userId) || userId <= 0 || !isUserRole(role)) return { error: "That isn't a valid change." };

  try {
    if ((await userIdFor(account.userId)) === userId) return { error: "You can't change your own role." };
    if (!(await setRole(userId, role, account.userId))) return { error: "That user no longer exists." };
  } catch (error) {
    console.error("[users] couldn't set role", userId, role, error);
    return { error: "Couldn't save right now. Please try again." };
  }
  refresh();
  return {};
}
