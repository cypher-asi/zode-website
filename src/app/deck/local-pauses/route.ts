import { connection } from "next/server";
import { getLocalPauses } from "@/features/deck/policy";

/**
 * The states slide's local pauses, which the deck fetches as the slide comes
 * near rather than carrying them in the page. Read per request, from the
 * tracker's hourly cache, so a tracker that's down never prerenders as an
 * error; browsers keep a copy for a few minutes.
 */
export async function GET(): Promise<Response> {
  await connection();
  try {
    return Response.json(await getLocalPauses(), {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
    });
  } catch (error) {
    console.error("[deck] local pauses unavailable", error);
    return Response.json({ error: "The policy tracker can't be read right now." }, { status: 503 });
  }
}
