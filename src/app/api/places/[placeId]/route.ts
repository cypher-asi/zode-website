import type { NextRequest } from "next/server";
import { placeAddress, placesJson, placesRequest } from "@/features/deployments/places";
import { isPlaceId } from "@/features/deployments/types";

/** A picked place's full address and city, for the deployment form. ZODE team only. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/places/[placeId]">) {
  const { placeId } = await ctx.params;
  const gate = await placesRequest(request.nextUrl.searchParams.get("session"));
  if (gate instanceof Response) return gate;
  if (!isPlaceId(placeId)) return placesJson({ error: "Unknown place." }, 404);

  try {
    const place = await placeAddress(placeId, gate.session);
    return place ? placesJson(place) : placesJson({ error: "Unknown place." }, 404);
  } catch (error) {
    console.error("[places] details failed", error);
    return placesJson({ error: "That address couldn't be looked up right now." }, 502);
  }
}
