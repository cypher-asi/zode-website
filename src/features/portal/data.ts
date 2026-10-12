import "server-only";
import { listOrdersByUser, type OrderSummary } from "@/features/configurator/orders";
import { listAllContracts, listContractsForUser, type Contract } from "@/features/contracts/contracts";
import { listRoomsForUser } from "@/features/data-room/rooms";
import type { RoomSummary } from "@/features/data-room/types";
import { listSubscribers } from "@/features/mailing-list/subscribers";
import type { Subscriber } from "@/features/mailing-list/types";
import { listAllPosts } from "@/features/posts/posts";
import type { Post } from "@/features/posts/types";
import type { User } from "@/features/users/types";
import { listUsers } from "@/features/users/users";

/** The account's data rooms, or `null` when they couldn't be loaded. */
export function loadRooms(userId: string): Promise<RoomSummary[] | null> {
  return listRoomsForUser(userId).catch((error: unknown) => {
    console.error("Failed to load data rooms", error);
    return null;
  });
}

/** The account's compute orders, newest first, or `null` when they couldn't be loaded. */
export function loadOrders(userId: string): Promise<OrderSummary[] | null> {
  return listOrdersByUser(userId).catch((error: unknown) => {
    console.error("Failed to load portal orders", error);
    return null;
  });
}

/** Agreements the account signed, newest first, or `null` when they couldn't be loaded. */
export function loadContracts(userId: string): Promise<Contract[] | null> {
  return listContractsForUser(userId).catch((error: unknown) => {
    console.error("Failed to load contracts", error);
    return null;
  });
}

/** Every news and changelog post, drafts included, for ZODE admins, or `null` when they couldn't be loaded. */
export function loadAllPosts(): Promise<Post[] | null> {
  return listAllPosts().catch((error: unknown) => {
    console.error("Failed to load posts", error);
    return null;
  });
}

/** Every signed agreement, for ZODE admins, or `null` when they couldn't be loaded. */
export function loadAllContracts(): Promise<Contract[] | null> {
  return listAllContracts().catch((error: unknown) => {
    console.error("Failed to load all contracts", error);
    return null;
  });
}

/** The whole mailing list, for ZODE admins, or `null` when it couldn't be loaded. */
export function loadSubscribers(): Promise<Subscriber[] | null> {
  return listSubscribers().catch((error: unknown) => {
    console.error("Failed to load mailing list subscribers", error);
    return null;
  });
}

/** Every account by ZODE user id, for super admins, or `null` when they couldn't be loaded. */
export function loadUsers(): Promise<User[] | null> {
  return listUsers().catch((error: unknown) => {
    console.error("Failed to load users", error);
    return null;
  });
}
