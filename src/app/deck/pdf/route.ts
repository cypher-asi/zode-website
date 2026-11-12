import { get } from "@vercel/blob";
import { after } from "next/server";
import { seesFullDeck } from "@/features/deck/access";
import { recordDeckDownload } from "@/features/deck/activity";
import { DECK_PDFS } from "@/features/deck/pdf";

/** Opened in place of the file, so it says so and leads back to the deck the reader came from. */
const unavailable = (room: string | undefined) => {
  const deck = room ? `/deck?${new URLSearchParams({ room })}` : "/deck";
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer">` +
      `<title>Investor deck | ZODE</title>` +
      `<p>The deck's PDF isn't ready yet. Try again in a few minutes.</p><p><a href="${deck}">Back to the deck</a></p>`,
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } },
  );
};

/**
 * The deck as a PDF: the whole deck for readers with data room access (signed
 * in, or with a room's share token as `?room=`, passed on from the deck's own
 * address), the public slides for everyone else. Never cached, as the answer
 * depends on who asks. Each download goes in the reader's rooms' activity.
 */
export async function GET(request: Request): Promise<Response> {
  const room = new URL(request.url).searchParams.get("room") ?? undefined;
  const pdf = DECK_PDFS[(await seesFullDeck(room)) ? "full" : "public"];
  let blob: Awaited<ReturnType<typeof get>>;
  try {
    blob = await get(pdf.pathname, { access: "private" });
  } catch (error) {
    console.error("[deck] PDF unavailable", pdf.pathname, error);
    return unavailable(room);
  }
  if (!blob || blob.statusCode !== 200) return unavailable(room);

  after(() =>
    recordDeckDownload(room, pdf.filename).catch((error: unknown) =>
      console.error("[deck] couldn't record a download", error),
    ),
  );
  return new Response(blob.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(blob.blob.size),
      "Content-Disposition": `attachment; filename="${pdf.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
