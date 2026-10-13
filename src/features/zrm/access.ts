import "server-only";
import { notFound } from "next/navigation";
import { isTeam } from "@/features/account/admin";
import { getAccount, requireAccount } from "@/features/account/session";
import type { Account } from "@/features/account/zos";

/** ZRM is the ZODE team's: everyone else gets a 404 rather than a hint that it exists. */
export async function requireTeam(returnTo: string): Promise<Account> {
  const account = await requireAccount(returnTo);
  if (!(await isTeam(account))) notFound();
  return account;
}

/** For server actions, which are reachable by direct POST: the team member's account, or null. */
export async function teamAccount(): Promise<Account | null> {
  const account = await getAccount();
  return account && (await isTeam(account)) ? account : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);
