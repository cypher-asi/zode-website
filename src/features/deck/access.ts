import "server-only";
import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { isTeam } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { isAnyRoomMember } from "@/features/data-room/rooms";
import { roomByShareToken } from "@/features/data-room/shareLinks";
import { DECK_PRINT_HEADER } from "./pdf";
import { GATE, PUBLIC_SLIDES, type Slide } from "./slides";
import { FULL_SLIDES } from "./slides.full";

/**
 * Whether the reader may see the deck past project finance: they came from a
 * live share link to a data room (`roomToken`), or they're signed in as the
 * ZODE team or a member of a room. Signing in alone isn't enough, as ZOS
 * registration is open to anyone.
 */
async function hasDataRoomAccess(roomToken: string | undefined): Promise<boolean> {
  if (await isDeckPrint()) return true;
  if (roomToken && (await roomByShareToken(roomToken))) return true;
  const account = await getAccount();
  if (!account) return false;
  return (await isTeam(account)) || (await isAnyRoomMember(account.userId));
}

/**
 * The deck's PDF print (scripts/make-deck-pdf.mjs), which sends the key it
 * started this server with. Only that server has a `DECK_PRINT_KEY`, a random
 * one per build, so a deployed site never takes this path.
 */
async function isDeckPrint(): Promise<boolean> {
  const key = process.env.DECK_PRINT_KEY;
  const sent = key ? (await headers()).get(DECK_PRINT_HEADER) : null;
  if (!key || !sent) return false;
  const [a, b] = [Buffer.from(sent), Buffer.from(key)];
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Only the sections behind the gate leave the server: their titles carry figures of their own. */
const LOCKED = FULL_SLIDES.slice(PUBLIC_SLIDES.length)
  .filter((slide) => slide.kind !== "close" && slide.kind !== "sources")
  .map((slide) => slide.section);

const GATED: readonly Slide[] = [...PUBLIC_SLIDES, { ...GATE, locked: LOCKED }];

/** Whether the reader gets the whole deck; a failed check gets the public one. */
export async function seesFullDeck(roomToken: string | undefined): Promise<boolean> {
  try {
    return await hasDataRoomAccess(roomToken);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[deck] access check failed; showing the public deck", error);
    return false;
  }
}

/** The whole deck for readers with data room access; for everyone else, the public slides ending on the gate. */
export async function deckSlides(roomToken: string | undefined): Promise<readonly Slide[]> {
  return (await seesFullDeck(roomToken)) ? FULL_SLIDES : GATED;
}
