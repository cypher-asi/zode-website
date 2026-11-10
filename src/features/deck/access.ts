import "server-only";
import { unstable_rethrow } from "next/navigation";
import { isTeam } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { isAnyRoomMember } from "@/features/data-room/rooms";
import { roomByShareToken } from "@/features/data-room/shareLinks";
import { GATE, PUBLIC_SLIDES, type Slide } from "./slides";
import { FULL_SLIDES } from "./slides.full";

/**
 * Whether the reader may see the deck past project finance: they came from a
 * live share link to a data room (`roomToken`), or they're signed in as the
 * ZODE team or a member of a room. Signing in alone isn't enough, as ZOS
 * registration is open to anyone.
 */
async function hasDataRoomAccess(roomToken: string | undefined): Promise<boolean> {
  if (roomToken && (await roomByShareToken(roomToken))) return true;
  const account = await getAccount();
  if (!account) return false;
  return (await isTeam(account)) || (await isAnyRoomMember(account.userId));
}

/** Only the sections behind the gate leave the server: their titles carry figures of their own. */
const LOCKED = FULL_SLIDES.slice(PUBLIC_SLIDES.length)
  .filter((slide) => slide.kind !== "close" && slide.kind !== "sources")
  .map((slide) => slide.section);

const GATED: readonly Slide[] = [...PUBLIC_SLIDES, { ...GATE, locked: LOCKED }];

/**
 * The whole deck for readers with data room access; for everyone else, the
 * public slides ending on the gate, which is also what a failed check gets.
 */
export async function deckSlides(roomToken: string | undefined): Promise<readonly Slide[]> {
  try {
    return (await hasDataRoomAccess(roomToken)) ? FULL_SLIDES : GATED;
  } catch (error) {
    unstable_rethrow(error);
    console.error("[deck] access check failed; showing the public deck", error);
    return GATED;
  }
}
