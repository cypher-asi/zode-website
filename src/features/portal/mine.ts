import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { redirect } from "next/navigation";
import { isTeam, isZodeAdmin } from "@/features/account/admin";
import { avatarUrl, loadRequestProfile } from "@/features/account/profile";
import { getAccount } from "@/features/account/session";
import type { Account } from "@/features/account/zos";
import type { OrderSummary } from "@/features/configurator/orders";
import type { Contract } from "@/features/contracts/contracts";
import { accountRoomsTag, canCreateRooms } from "@/features/data-room/rooms";
import type { PendingInvite, RoomSummary } from "@/features/data-room/types";
import { userIdFor } from "@/features/users/users";
import { loadContracts, loadOrders, loadPendingInvites, loadRooms } from "./data";

/*
 * One loader per portal page for the signed-in account's own data, `null`
 * when signed out. Each reads the session itself under `use cache: private`,
 * so the page's content rides in the session's prefetched App Shell and is
 * never kept in a server cache. A page calls its loader from every part
 * that needs it; calls within a request share one result.
 */

type Mine<T> = Promise<({ account: Account } & T) | null>;

/** `mine`, or off to log in and back to `returnTo`, as `requireAccount` does. */
export function orLogIn<T>(mine: T | null, returnTo: string): T {
  if (mine === null) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return mine;
}

/** Home: the account's rooms, orders and contracts, and whether it's on the ZODE team. */
export async function loadMyHome(): Mine<{
  team: boolean;
  rooms: RoomSummary[] | null;
  orders: OrderSummary[] | null;
  contracts: Contract[] | null;
}> {
  "use cache: private";
  cacheLife("minutes");
  const account = await getAccount();
  if (!account) return null;
  cacheTag(accountRoomsTag(account.userId));
  const [team, rooms, orders, contracts] = await Promise.all([
    isTeam(account),
    loadRooms(account.userId),
    loadOrders(account.userId),
    loadContracts(account.userId),
  ]);
  return { account, team, rooms, orders, contracts };
}

/** Orders: every order the account placed, of both kinds. */
export async function loadMyOrders(): Mine<{ orders: OrderSummary[] | null }> {
  "use cache: private";
  cacheLife("minutes");
  const account = await getAccount();
  if (!account) return null;
  return { account, orders: await loadOrders(account.userId) };
}

/** Contracts: the account's agreements, and whether it's on the ZODE team, for the All tab. */
export async function loadMyContracts(): Mine<{ team: boolean; contracts: Contract[] | null }> {
  "use cache: private";
  cacheLife("minutes");
  const account = await getAccount();
  if (!account) return null;
  const [team, contracts] = await Promise.all([isTeam(account), loadContracts(account.userId)]);
  return { account, team, contracts };
}

/** Data rooms: the account's rooms, invites waiting on it, and whether it can open new ones. */
export async function loadMyRooms(): Mine<{ rooms: RoomSummary[] | null; invites: PendingInvite[]; canCreate: boolean }> {
  "use cache: private";
  cacheLife("minutes");
  const account = await getAccount();
  if (!account) return null;
  cacheTag(accountRoomsTag(account.userId));
  const [rooms, invites, canCreate] = await Promise.all([
    loadRooms(account.userId),
    loadPendingInvites(account),
    canCreateRooms(account),
  ]);
  return { account, rooms, invites, canCreate };
}

/** Settings: the account's photo, its ZODE user id, and its role. */
export async function loadMySettings(): Mine<{
  photo: string | null;
  zodeUserId: number | null;
  superAdmin: boolean;
  team: boolean;
}> {
  "use cache: private";
  cacheLife("minutes");
  const account = await getAccount();
  if (!account) return null;
  const [profile, zodeUserId, superAdmin, team] = await Promise.all([
    loadRequestProfile(account.userId),
    userIdFor(account.userId).catch((error: unknown) => {
      console.error("[settings] couldn't load the ZODE user id", error);
      return null;
    }),
    isZodeAdmin(account),
    isTeam(account),
  ]);
  const photo = profile?.avatarPathname ? avatarUrl(account.userId, profile.avatarPathname) : null;
  return { account, photo, zodeUserId, superAdmin, team };
}
