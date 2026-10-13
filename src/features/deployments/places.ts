import "server-only";
import { isUuid, teamAccount } from "@/features/zrm/access";
import { RATE_LIMITED, withinLimits } from "@/lib/rateLimit";
import type { PlaceAddress, PlaceSuggestion } from "./types";

/** Google Places API (New), called from the server so the key never reaches the browser. */
const API = "https://places.googleapis.com/v1";
const TIMEOUT_MS = 5_000;

/** Where a place's city is, most specific first; outside towns the county stands in. */
const CITY_TYPES = [
  "locality",
  "postal_town",
  "sublocality_level_1",
  "administrative_area_level_3",
  "administrative_area_level_2",
];

interface AddressComponent {
  longText?: string;
  types?: string[];
}

const apiKey = (): string | undefined => process.env.GOOGLE_MAPS_API_KEY || undefined;

const NO_STORE = { "Cache-Control": "private, no-store" };

export const placesJson = (body: unknown, status = 200): Response => Response.json(body, { status, headers: NO_STORE });

/**
 * Lets the ZODE team's address lookups through, each with its `session`
 * token; the error response otherwise. Unconfigured is a 503 the field reads
 * as "type it by hand".
 */
export async function placesRequest(session: string | null): Promise<{ session: string } | Response> {
  const account = await teamAccount();
  if (!account) return new Response("Not found", { status: 404, headers: NO_STORE });
  if (!apiKey()) return placesJson({ error: "unconfigured" }, 503);
  if (!isUuid(session)) return placesJson({ error: "A session token is required." }, 400);
  const allowed = await withinLimits([{ key: `places:user:${account.userId}`, max: 600, windowSeconds: 60 * 60 }]);
  if (!allowed) return placesJson({ error: RATE_LIMITED }, 429);
  return { session };
}

async function call(path: string, init: RequestInit & { fieldMask: string }): Promise<unknown> {
  const { fieldMask, headers, ...rest } = init;
  const res = await fetch(`${API}/${path}`, {
    ...rest,
    headers: { ...headers, "X-Goog-Api-Key": apiKey() ?? "", "X-Goog-FieldMask": fieldMask },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Places ${path.split("?")[0]} answered ${res.status}: ${await res.text()}`);
  return res.json();
}

export function cityOf(components: readonly AddressComponent[]): string | null {
  for (const type of CITY_TYPES) {
    const match = components.find((component) => component.types?.includes(type) && component.longText);
    if (match) return match.longText!;
  }
  return null;
}

/** Up to five places for what's typed, grouped into `session` for billing until one is picked. */
export async function suggestPlaces(input: string, session: string): Promise<PlaceSuggestion[]> {
  const body = (await call("places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, sessionToken: session, languageCode: "en" }),
    fieldMask: "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat",
  })) as {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }[];
  };
  return (body.suggestions ?? []).flatMap(({ placePrediction: p }) =>
    p?.placeId && p.structuredFormat?.mainText?.text
      ? [
          {
            placeId: p.placeId,
            main: p.structuredFormat.mainText.text,
            secondary: p.structuredFormat.secondaryText?.text ?? null,
          },
        ]
      : [],
  );
}

/** The picked place's full address and city; ends `session`. */
export async function placeAddress(placeId: string, session: string): Promise<PlaceAddress | null> {
  const place = (await call(`places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(session)}`, {
    fieldMask: "formattedAddress,addressComponents",
  })) as { formattedAddress?: string; addressComponents?: AddressComponent[] };
  if (!place.formattedAddress) return null;
  return { placeId, address: place.formattedAddress, city: cityOf(place.addressComponents ?? []) };
}
