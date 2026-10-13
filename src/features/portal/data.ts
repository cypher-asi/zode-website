import "server-only";
import { cache } from "react";
import { listOrdersByUser, type OrderSummary } from "@/features/configurator/orders";
import { listAllContracts, listContractsForUser, type Contract } from "@/features/contracts/contracts";
import { listRoomNamesForUser, listRoomsForUser } from "@/features/data-room/rooms";
import type { RoomSummary } from "@/features/data-room/types";
import { listSubscribers } from "@/features/mailing-list/subscribers";
import type { MailingList, Subscriber } from "@/features/mailing-list/types";
import { listAllPosts } from "@/features/posts/posts";
import type { Post } from "@/features/posts/types";
import type { User } from "@/features/users/types";
import { listUsers } from "@/features/users/users";

/** The account's data rooms, or `null` when they couldn't be loaded. Cached per request. */
export const loadRooms = cache((userId: string): Promise<RoomSummary[] | null> =>
  listRoomsForUser(userId).catch((error: unknown) => {
    console.error("Failed to load data rooms", error);
    return null;
  }),
);

/** The account's data rooms by name, for the sidebar, or `null` when they couldn't be loaded. */
export function loadRoomNames(userId: string): Promise<{ id: string; name: string }[] | null> {
  return listRoomNamesForUser(userId).catch((error: unknown) => {
    console.error("Failed to load data room names", error);
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

/** Every news and changelog post, drafts included, for the ZODE team, or `null` when they couldn't be loaded. */
export function loadAllPosts(): Promise<Post[] | null> {
  return listAllPosts().catch((error: unknown) => {
    console.error("Failed to load posts", error);
    return null;
  });
}

/** Every executed agreement, MNDAs and compute contracts, for the ZODE team, or `null` when they couldn't be loaded. */
export function loadAllContracts(): Promise<Contract[] | null> {
  return listAllContracts().catch((error: unknown) => {
    console.error("Failed to load all contracts", error);
    return null;
  });
}

/** Every mailing list, or one, for ZODE admins, or `null` when it couldn't be loaded. */
export function loadSubscribers(list: MailingList | null = null): Promise<Subscriber[] | null> {
  return listSubscribers(list).catch((error: unknown) => {
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
