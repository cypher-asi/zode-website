import type { ReactElement } from "react";
import { getRoomSite, requireRoomRole } from "@/features/data-room/rooms";
import { RoomSettingsPanel } from "@/features/data-room/RoomSettingsPanel";
import { hasDiligenceSummary } from "@/features/data-room/summary";
import styles from "@/features/data-room/room.module.css";

/** Admins only: the room's name, type and site address, and deleting it. */
export default async function DataRoomSettingsPage({
  params,
}: PageProps<"/portal/data-rooms/[roomId]/settings">): Promise<ReactElement> {
  const { roomId } = await params;
  const { room } = await requireRoomRole(roomId, "admin");
  const [hasSummary, site] = await Promise.all([hasDiligenceSummary(roomId), getRoomSite(roomId)]);

  return (
    <div className={styles.scroll}>
      <div className={styles.page}>
        <RoomSettingsPanel
          roomId={roomId}
          roomName={room.name}
          roomKind={room.kind}
          hasSummary={hasSummary}
          site={site}
        />
      </div>
    </div>
  );
}
