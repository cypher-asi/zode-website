"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendRegistrationEmails } from "@/emails/send";
import { MIN_PASSWORD_LENGTH } from "./password";
import { createAccountSession, deleteAccountSession, safeNext } from "./session";
import { describeZosError, zosLogin, zosRegister, type Account } from "./zos";

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

export interface RegisterState {
  readonly error?: string;
  /** Echoed back so the form keeps what was typed after a failed attempt. */
  readonly values?: { name: string; email: string; inviteCode: string };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register(_prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const values = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    inviteCode: String(formData.get("inviteCode") ?? "").trim(),
  };
  const password = String(formData.get("password") ?? "");

  if (!values.name) return { error: "Name is required.", values };
  if (values.name.length > 120) return { error: "Name is too long.", values };
  if (!EMAIL_RE.test(values.email)) return { error: "Enter a valid email.", values };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, values };
  }

  let account: Account;
  try {
    account = await zosRegister({ ...values, password });
  } catch (error) {
    return { error: describeZosError(error, "Couldn't create your account right now. Please try again."), values };
  }

  after(() => sendRegistrationEmails(account, values.inviteCode));
  await createAccountSession(account);
  redirect(safeNext(formData.get("next")));
}

/** Clears the session; callers decide whether to navigate (see `useLogout`). */
export async function logout(): Promise<void> {
  await deleteAccountSession();
}
