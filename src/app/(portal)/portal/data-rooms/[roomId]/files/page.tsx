import type { ReactElement } from "react";
import { DataRoomApp } from "@/features/data-room/DataRoomApp";
import { getRoomTree, requireRoomRole } from "@/features/data-room/rooms";

/** The room's files: browse on the left, preview on the right. `?file=` opens one directly. */
export default async function DataRoomFilesPage({
  params,
  searchParams,
}: PageProps<"/portal/data-rooms/[roomId]/files">): Promise<ReactElement> {
  const { roomId } = await params;
  const { file } = await searchParams;
  const { role } = await requireRoomRole(roomId);
  const tree = await getRoomTree(roomId);

  return (
    <DataRoomApp
      roomId={roomId}
      isAdmin={role === "admin"}
      tree={tree}
      initialFileId={typeof file === "string" ? file : null}
    />
  );
}
