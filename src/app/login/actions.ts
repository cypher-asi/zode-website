"use server";

import { redirect } from "next/navigation";
import { createAccountSession, safeNext } from "@/lib/account-session";
import { describeZosError, zosLogin, type Account } from "@/lib/zos";

export interface AuthFormState {
  readonly error?: string;
  /** Echoed back so the form keeps the address after a failed attempt. */
  readonly email?: string;
}

export async function login(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }

  let account: Account;
  try {
    account = await zosLogin(email, password);
  } catch (error) {
    return { error: describeZosError(error, "Couldn't log in right now. Please try again."), email };
  }

  await createAccountSession(account);
  redirect(safeNext(formData.get("next")));
}
