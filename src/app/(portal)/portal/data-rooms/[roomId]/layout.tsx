import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { DataRoomApp } from "@/features/data-room/DataRoomApp";
import { RoomTabs } from "@/features/data-room/RoomTabs";
import { ShareButton } from "@/features/data-room/ShareDialog";
import { getRoomTree, listMembers, requireRoomRole } from "@/features/data-room/rooms";
import { listShareLinks } from "@/features/data-room/shareLinks";
import { renderSummaries } from "@/features/data-room/RoomSummaries";
import { listSummaries } from "@/features/data-room/summary";
import { roleLabel } from "@/features/data-room/types";
import styles from "@/features/data-room/room.module.css";

export async function generateMetadata({ params }: LayoutProps<"/portal/data-rooms/[roomId]">): Promise<Metadata> {
  const { roomId } = await params;
  const { room } = await requireRoomRole(roomId);
  return { title: `${room.name} | Data room | ZODE`, robots: { index: false, follow: false } };
}

/**
 * A data room fills the viewport beside the portal's icons, with a Files tab
 * that browses its folders; admins also get Members, Activity, a Settings
 * gear and a Share button. The browser lives here rather than in the Files
 * page, so the folder you were in is still open when you come back to it.
 */
export default async function DataRoomLayout({
  children,
  params,
}: LayoutProps<"/portal/data-rooms/[roomId]">): Promise<ReactElement> {
  const { roomId } = await params;
  const { room, role, account } = await requireRoomRole(roomId);
  const isAdmin = role === "admin";
  const [members, tree, summaries, links] = await Promise.all([
    isAdmin ? listMembers(roomId) : [],
    getRoomTree(roomId),
    listSummaries(roomId),
    isAdmin ? listShareLinks(roomId) : [],
  ]);

  return (
    <div className={styles.frame}>
      <header className={styles.bar}>
        <div className={styles.titleGroup}>
          <Link href="/portal/data-rooms" className={styles.crumb}>
            Data Rooms
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </Link>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{room.name}</h1>
            <span className={styles.role}>{roleLabel(role)}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <RoomTabs roomId={roomId} isAdmin={isAdmin} />
          {isAdmin ? (
            <ShareButton
              roomId={roomId}
              roomName={room.name}
              members={members}
              selfEmail={account.email.toLowerCase()}
              links={links}
            />
          ) : null}
        </div>
      </header>
      <div className={styles.body}>
        <DataRoomApp
          roomId={roomId}
          roomName={room.name}
          isAdmin={isAdmin}
          tree={tree}
          summaries={renderSummaries(roomId, summaries)}
        >
          {children}
        </DataRoomApp>
      </div>
    </div>
  );
}
