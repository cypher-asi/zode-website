import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { notFound } from "next/navigation";
import { getAccount } from "@/features/account/session";
import { getRoomTree, osHrefFor, sharedMapSrc } from "@/features/data-room/rooms";
import { roomByShareToken } from "@/features/data-room/shareLinks";
import { SharedRoom } from "@/features/data-room/SharedRoom";
import styles from "@/features/data-room/SharedRoom.module.css";
import { getDiligenceSummary } from "@/features/data-room/summary";
import { SummaryView } from "@/features/data-room/SummaryView";

export async function generateMetadata({ params }: PageProps<"/shared/data-rooms/[token]">): Promise<Metadata> {
  const room = await roomByShareToken((await params).token);
  return {
    title: room ? `${room.name} | ZODE` : "Data room | ZODE",
    // Shared by link only.
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

/** The public browser. The shell is static; the room is read behind Suspense because it hits the database. */
export default function SharedDataRoomPage({ params }: PageProps<"/shared/data-rooms/[token]">): ReactElement {
  return (
    <Suspense fallback={<div className={styles.page} data-theme="dark" />}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({
  params,
}: Pick<PageProps<"/shared/data-rooms/[token]">, "params">): Promise<ReactElement> {
  const { token } = await params;
  const room = await roomByShareToken(token);
  if (!room) notFound();
  const [tree, summary, account] = await Promise.all([getRoomTree(room.id), getDiligenceSummary(room.id), getAccount()]);
  return (
    <SharedRoom
      token={token}
      roomName={room.name}
      tree={tree}
      osHref={await osHrefFor(room.id, account?.userId ?? null)}
      summary={
        summary
          ? {
              content: (
                <SummaryView
                  roomId={room.id}
                  summary={summary}
                  mapSrc={summary.site ? sharedMapSrc(token, summary.site) : null}
                />
              ),
            }
          : null
      }
    />
  );
}
