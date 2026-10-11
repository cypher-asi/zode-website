"use server";

import { redirect } from "next/navigation";
import { checkPassword, createSession } from "@/lib/session";

export interface UnlockState {
  readonly error?: string;
}

export async function unlock(
  _prevState: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const password = formData.get("password");
  if (typeof password !== "string" || !checkPassword(password)) {
    return { error: "Incorrect password." };
  }

  await createSession();
  redirect("/");
}
