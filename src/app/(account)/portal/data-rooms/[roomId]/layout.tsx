import type { Metadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { RoomTabs } from "@/features/data-room/RoomTabs";
import { requireRoomRole } from "@/features/data-room/rooms";
import styles from "@/features/data-room/room.module.css";

export async function generateMetadata({ params }: LayoutProps<"/portal/data-rooms/[roomId]">): Promise<Metadata> {
  const { roomId } = await params;
  const { room } = await requireRoomRole(roomId);
  return { title: `${room.name} | Data room | ZODE`, robots: { index: false, follow: false } };
}

/** A data room fills the viewport under the pinned header; admins also get Members and Activity tabs. */
export default async function DataRoomLayout({
  children,
  params,
}: LayoutProps<"/portal/data-rooms/[roomId]">): Promise<ReactElement> {
  const { roomId } = await params;
  const { room, role } = await requireRoomRole(roomId);

  return (
    <div className={styles.frame}>
      <header className={styles.bar}>
        <Link href="/portal" className={styles.back}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3 5 8l5 5" />
          </svg>
          Portal
        </Link>
        <div className={styles.titleGroup}>
          <span className={styles.eyebrow}>Data room</span>
          <h1 className={styles.title}>{room.name}</h1>
        </div>
        <span className={styles.role}>{role === "admin" ? "Admin" : "Viewer"}</span>
        {role === "admin" ? <RoomTabs roomId={roomId} /> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
