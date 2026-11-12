import "server-only";
import { isTeam } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { recordEvents } from "@/features/data-room/audit";
import { listRoomsForUser } from "@/features/data-room/rooms";
import { roomByShareToken, shareAudit } from "@/features/data-room/shareLinks";

/**
 * A deck download, in the activity of the rooms its reader has: through a
 * share link, that link's room, credited to the link as its files' downloads
 * are; signed in, every room they belong to. The ZODE team's own downloads
 * and the public's reach no room, so analytics alone counts those.
 */
export async function recordDeckDownload(roomToken: string | undefined, name: string): Promise<void> {
  const link = roomToken ? await roomByShareToken(roomToken) : null;
  if (link) {
    const { actor, detail } = await shareAudit(link);
    await recordEvents([{ roomId: link.id, account: actor, action: "download", detail: { name, deck: true, ...detail } }]);
    return;
  }
  const account = await getAccount();
  if (!account || (await isTeam(account))) return;
  const rooms = await listRoomsForUser(account.userId);
  await recordEvents(
    rooms.map((room) => ({ roomId: room.id, account, action: "download" as const, detail: { name, deck: true } })),
  );
}
