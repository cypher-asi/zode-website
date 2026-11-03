import "server-only";
import { staticMap } from "@/features/deployments/places";
import { notFoundResponse } from "./http";

/** The satellite image for a room's address. Callers check access and rate limits first. */
export async function siteMapResponse(address: string): Promise<Response> {
  const map = await staticMap(address).catch((error: unknown) => {
    console.error("[data-room] static map failed", error);
    return null;
  });
  if (!map) return notFoundResponse();
  return new Response(map.body, {
    headers: {
      "Content-Type": map.contentType,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
