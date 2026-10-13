import type { ReactElement } from "react";
import { DataRoomApp } from "@/features/data-room/DataRoomApp";
import { getRoomTree, requireRoomRole } from "@/features/data-room/rooms";
import { getDiligenceSummary } from "@/features/data-room/summary";
import { SummaryView } from "@/features/data-room/SummaryView";

/**
 * The room's landing page and its files: browse on the left, preview on the
 * right, the diligence summary open first. `?file=` opens a file instead.
 */
export default async function DataRoomPage({
  params,
  searchParams,
}: PageProps<"/portal/data-rooms/[roomId]">): Promise<ReactElement> {
  const { roomId } = await params;
  const { file } = await searchParams;
  const { role } = await requireRoomRole(roomId);
  const [tree, summary] = await Promise.all([getRoomTree(roomId), getDiligenceSummary(roomId)]);

  return (
    <DataRoomApp
      roomId={roomId}
      isAdmin={role === "admin"}
      tree={tree}
      initialFileId={typeof file === "string" ? file : null}
      summary={
        summary
          ? { content: <SummaryView roomId={roomId} summary={summary} /> }
          : null
      }
    />
  );
}
