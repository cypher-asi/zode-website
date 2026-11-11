import { get } from "@vercel/blob";
import { seesFullDeck } from "@/features/deck/access";
import { DECK_PDFS } from "@/features/deck/pdf";

const unavailable = () =>
  new Response("The deck's PDF isn't ready yet. Try again in a few minutes.", {
    status: 503,
    headers: { "Cache-Control": "private, no-store" },
  });

/**
 * The deck as a PDF: the whole deck for readers with data room access (signed
 * in, or with a room's share token as `?room=`, passed on from the deck's own
 * address), the public slides for everyone else. Never cached, as the answer
 * depends on who asks.
 */
export async function GET(request: Request): Promise<Response> {
  const room = new URL(request.url).searchParams.get("room") ?? undefined;
  const pdf = DECK_PDFS[(await seesFullDeck(room)) ? "full" : "public"];
  try {
    const blob = await get(pdf.pathname, { access: "private" });
    if (!blob || blob.statusCode !== 200) return unavailable();
    return new Response(blob.stream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(blob.blob.size),
        "Content-Disposition": `attachment; filename="${pdf.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[deck] PDF unavailable", pdf.pathname, error);
    return unavailable();
  }
}
