import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type DbTarget = "dev" | "prod";

const clients = new Map<string, NeonQueryFunction<false, false>>();

/** Shared across the server's module instances (actions, rendering) and survives HMR; resets on restart. */
const TARGET_KEY = Symbol.for("zode.devDbTarget");
const store = globalThis as typeof globalThis & { [TARGET_KEY]?: DbTarget };

function client(url: string): NeonQueryFunction<false, false> {
  let sql = clients.get(url);
  if (!sql) {
    sql = neon(url);
    clients.set(url, sql);
  }
  return sql;
}

/** Local development with DATABASE_URL_PROD set, so the portal can flip `db()` to the prod database. */
export function devDbSwitchAvailable(): boolean {
  return process.env.NODE_ENV === "development" && Boolean(process.env.DATABASE_URL_PROD);
}

export function devDbTarget(): DbTarget {
  return devDbSwitchAvailable() ? (store[TARGET_KEY] ?? "dev") : "dev";
}

export function setDevDbTarget(target: DbTarget): void {
  if (!devDbSwitchAvailable()) {
    throw new Error("The database switch is only available in local development");
  }
  store[TARGET_KEY] = target;
}

/**
 * Neon's HTTP query function for DATABASE_URL, created on first use so that
 * importing this module never needs the variable (e.g. while prerendering).
 * Ignores the dev switch: sessions and rate limits stay in the local database.
 */
export function homeDb(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  return client(url);
}

/** The app's data: DATABASE_URL, or DATABASE_URL_PROD while the dev switch is on prod. */
export function db(): NeonQueryFunction<false, false> {
  if (devDbTarget() === "prod") {
    return client(process.env.DATABASE_URL_PROD!);
  }
  return homeDb();
}
