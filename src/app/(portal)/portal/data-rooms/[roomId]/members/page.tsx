import type { ReactElement } from "react";
import { MembersPanel } from "@/features/data-room/MembersPanel";
import { listMembers, requireRoomRole } from "@/features/data-room/rooms";
import styles from "@/features/data-room/room.module.css";

/** Admins only: who has access, pending invites, and the room's settings. Inviting is in the header's Share dialog. */
export default async function DataRoomMembersPage({
  params,
}: PageProps<"/portal/data-rooms/[roomId]/members">): Promise<ReactElement> {
  const { roomId } = await params;
  const { room, account } = await requireRoomRole(roomId, "admin");
  const members = await listMembers(roomId);

  return (
    <div className={styles.scroll}>
      <div className={styles.page}>
        <MembersPanel roomId={roomId} roomName={room.name} members={members} selfEmail={account.email.toLowerCase()} />
      </div>
    </div>
  );
}
