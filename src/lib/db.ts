import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | undefined;

/**
 * Neon's HTTP query function for DATABASE_URL, created on first use so that
 * importing this module never needs the variable (e.g. while prerendering).
 */
export function db(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not configured");
    }
    client = neon(url);
  }
  return client;
}
