import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { requireRoomRole } from "@/features/data-room/rooms";
import { getDiligenceSummary } from "@/features/data-room/summary";
import { SummaryView } from "@/features/data-room/SummaryView";
import styles from "@/features/data-room/room.module.css";

/** The room's landing page: its diligence summary and site economics. Links to `?file=` predate the Files tab. */
export default async function DataRoomSummaryPage({
  params,
  searchParams,
}: PageProps<"/portal/data-rooms/[roomId]">): Promise<ReactElement> {
  const { roomId } = await params;
  const { file } = await searchParams;
  if (typeof file === "string") redirect(`/portal/data-rooms/${roomId}/files?file=${encodeURIComponent(file)}`);

  await requireRoomRole(roomId);
  const summary = await getDiligenceSummary(roomId);

  return (
    <div className={styles.scroll}>
      <div className={styles.page}>
        <SummaryView roomId={roomId} summary={summary} />
      </div>
    </div>
  );
}
