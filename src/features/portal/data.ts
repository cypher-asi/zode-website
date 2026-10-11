import "server-only";
import { listOrdersByUser, type OrderSummary } from "@/features/configurator/orders";
import { listRoomsForUser } from "@/features/data-room/rooms";
import type { RoomSummary } from "@/features/data-room/types";

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
