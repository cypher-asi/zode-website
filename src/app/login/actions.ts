"use server";

import { redirect } from "next/navigation";
import { checkPassword, createSession } from "@/lib/session";

export interface LoginState {
  readonly error?: string;
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = formData.get("password");
  if (typeof password !== "string" || !checkPassword(password)) {
    return { error: "Incorrect password." };
  }

  await createSession();
  redirect("/");
}
