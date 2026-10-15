import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { NewRoomForm } from "@/features/data-room/NewRoomForm";
import { loadMyRooms, orLogIn } from "@/features/portal/mine";
import { PortalLoading } from "@/features/portal/PortalLoading";
import { Empty, InviteList, PageHeader, RoomList } from "@/features/portal/sections";
import styles from "@/features/portal/portal.module.css";

export const metadata: Metadata = {
  title: "Data rooms | ZODE",
  robots: { index: false, follow: false },
};

/** Every room you own or that's been shared with you; the ZODE team can open new ones. */
export default function DataRoomsPage(): ReactElement {
  return (
    <div className={styles.page}>
      <PageHeader
        title="Data rooms"
        subtitle="Private documents, with every view and download tracked."
        actions={
          <Suspense fallback={null}>
            <NewRoom />
          </Suspense>
        }
      />
      <Suspense fallback={<PortalLoading header={false} nested />}>
        <Rooms />
      </Suspense>
    </div>
  );
}

/** The new room button, for those who can open one. */
async function NewRoom(): Promise<ReactElement | null> {
  const mine = await loadMyRooms();
  return mine?.canCreate ? <NewRoomForm /> : null;
}

async function Rooms(): Promise<ReactElement> {
  const { rooms, invites, canCreate } = orLogIn(await loadMyRooms(), "/portal/data-rooms");
  const list =
    rooms === null ? (
      <Empty>Your data rooms couldn&apos;t be loaded right now. Please try again shortly.</Empty>
    ) : rooms.length ? (
      <RoomList rooms={rooms} />
    ) : (
      <Empty>
        {canCreate
          ? "Create a room to share documents privately. Rooms shared with you appear here too."
          : "Data rooms shared with you appear here."}
      </Empty>
    );
  if (!invites.length) return list;
  return (
    <>
      <InviteList invites={invites} />
      {rooms?.length !== 0 ? (
        <section className={styles.section} aria-label="Rooms">
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Rooms</h2>
          </div>
          {list}
        </section>
      ) : null}
    </>
  );
}
