"use server";

import { redirect } from "next/navigation";
import { deleteAccountSession } from "@/lib/account-session";

export async function logout(): Promise<void> {
  await deleteAccountSession();
  redirect("/");
}
