import type { NextRequest } from "next/server";
import { placesJson, placesRequest, suggestPlaces } from "@/features/deployments/places";

const MAX_QUERY = 200;

/** Google address suggestions for the deployment form. ZODE team only. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const gate = await placesRequest(params.get("session"));
  if (gate instanceof Response) return gate;

  const query = (params.get("q") ?? "").trim().slice(0, MAX_QUERY);
  if (query.length < 3) return placesJson([]);
  try {
    return placesJson(await suggestPlaces(query, gate.session));
  } catch (error) {
    console.error("[places] autocomplete failed", error);
    return placesJson({ error: "Suggestions aren't available right now." }, 502);
  }
}
