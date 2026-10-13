import type { Metadata } from "next";
import type { ReactElement } from "react";
import { requireAccount } from "@/features/account/session";
import { NewRoomForm } from "@/features/data-room/NewRoomForm";
import { canCreateRooms } from "@/features/data-room/rooms";
import { loadRooms } from "@/features/portal/data";
import { Empty, PageHeader, RoomList } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Data rooms | ZODE",
  robots: { index: false, follow: false },
};

/** Every room you own or that's been shared with you; the ZODE team can open new ones. */
export default async function DataRoomsPage(): Promise<ReactElement> {
  const account = await requireAccount("/portal/data-rooms");
  const [rooms, canCreate] = await Promise.all([loadRooms(account.userId), canCreateRooms(account)]);

  return (
    <div className={styles.page}>
      <PageHeader title="Data rooms" subtitle="Private documents, with every view and download tracked.">
        {canCreate ? <NewRoomForm /> : null}
      </PageHeader>
      {rooms === null ? (
        <Empty>Your data rooms couldn&apos;t be loaded right now. Please try again shortly.</Empty>
      ) : rooms.length ? (
        <RoomList rooms={rooms} />
      ) : (
        <Empty>
          {canCreate
            ? "Create a room to share documents privately. Rooms shared with you appear here too."
            : "Data rooms shared with you appear here."}
        </Empty>
      )}
    </div>
  );
}
