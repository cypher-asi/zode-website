"use server";

import { refresh } from "next/cache";
import { setDevDbTarget, type DbTarget } from "@/lib/db";

/** Local development only: points `db()` at the dev or prod database for the whole server. */
export async function setDevDb(target: DbTarget): Promise<void> {
  if (target !== "dev" && target !== "prod") {
    throw new Error("Unknown database");
  }
  setDevDbTarget(target);
  refresh();
}
