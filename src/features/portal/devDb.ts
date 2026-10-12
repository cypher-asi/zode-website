"use server";

import { refresh } from "next/cache";
import { isZodeAdmin } from "@/features/account/admin";
import { getAccount } from "@/features/account/session";
import { setDevDbTarget, type DbTarget } from "@/lib/db";

/** Local development only, for ZODE admins: points `db()` at the dev or prod database for the whole server. */
export async function setDevDb(target: DbTarget): Promise<void> {
  if (target !== "dev" && target !== "prod") {
    throw new Error("Unknown database");
  }
  const account = await getAccount();
  if (!account || !(await isZodeAdmin(account))) {
    throw new Error("Only ZODE admins can switch databases");
  }
  setDevDbTarget(target);
  refresh();
}
