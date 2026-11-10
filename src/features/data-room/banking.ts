import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/** An address as it's printed, a line at a time. */
export type AddressLines = readonly string[];

/** Where to send a room's funds, as scripts/write-room-banking.mjs writes it. */
export interface RoomBanking {
  account: {
    /** e.g. "Commercial Checking". */
    label: string;
    accountNumber: string;
  };
  /** A US wire or ACH. */
  domestic: {
    beneficiaryName: string;
    accountType: string;
    routingNumber: string;
    bankName: string;
    bankAddress: AddressLines;
  };
  /** A SWIFT wire from abroad. */
  international: {
    bankName: string;
    swift: string;
    bankAddress: AddressLines;
    beneficiaryName: string;
    beneficiaryAddress: AddressLines;
  };
  stablecoin: {
    coin: string;
    network: string;
    address: string;
  };
}

/** The room's banking details, or null when it has none. */
export const getRoomBanking = cache(async (roomId: string): Promise<RoomBanking | null> => {
  const [row] = await db()`select details from data_room_banking where room_id = ${roomId}`;
  return row ? (row.details as RoomBanking) : null;
});
