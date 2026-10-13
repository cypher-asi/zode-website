"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendRegistrationEmails } from "@/emails/send";
import { trackServerEvent } from "@/features/analytics/server";
import { RATE_LIMITED, clientIp, withinLimits } from "@/lib/rateLimit";
import { isEmail, singleLine } from "@/lib/validation";
import { MIN_PASSWORD_LENGTH } from "./password";
import { createAccountSession, deleteAccountSession, safeNext } from "./session";
import { describeZosError, zosLogin, zosRegister, type Account } from "./zos";

const MINUTE = 60;
const HOUR = 60 * MINUTE;

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

  const ip = await clientIp();
  const allowed = await withinLimits([
    { key: `login:ip:${ip}`, max: 10, windowSeconds: 15 * MINUTE },
    { key: `login:email:${email.toLowerCase()}`, max: 5, windowSeconds: 15 * MINUTE },
  ]);
  if (!allowed) return { error: RATE_LIMITED, email };

  let account: Account;
  try {
    account = await zosLogin(email, password);
  } catch (error) {
    return { error: describeZosError(error, "login", "Couldn't log in right now. Please try again."), email };
  }

  await createAccountSession(account);
  redirect(safeNext(formData.get("next")));
}

export interface RegisterState {
  readonly error?: string;
  /** Echoed back so the form keeps what was typed after a failed attempt. */
  readonly values?: { name: string; email: string; inviteCode: string };
}

export async function register(_prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const values = {
    name: singleLine(String(formData.get("name") ?? "")),
    email: String(formData.get("email") ?? "").trim(),
    inviteCode: singleLine(String(formData.get("inviteCode") ?? "")),
  };
  const password = String(formData.get("password") ?? "");

  if (!values.name) return { error: "Name is required.", values };
  if (values.name.length > 120) return { error: "Name is too long.", values };
  if (!isEmail(values.email)) return { error: "Enter a valid email.", values };
  if (values.inviteCode.length > 100) return { error: "That invite code isn't valid.", values };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, values };
  }

  const allowed = await withinLimits([{ key: `register:ip:${await clientIp()}`, max: 5, windowSeconds: HOUR }]);
  if (!allowed) return { error: RATE_LIMITED, values };

  let account: Account;
  try {
    account = await zosRegister({ ...values, password });
  } catch (error) {
    return {
      error: describeZosError(error, "register", "Couldn't create your account right now. Please try again."),
      values,
    };
  }

  after(() => sendRegistrationEmails(account, values.inviteCode));
  await trackServerEvent("account_registered", { invited: Boolean(values.inviteCode) }, account);
  await createAccountSession(account);
  redirect(safeNext(formData.get("next")));
}

/** Clears the session; callers decide whether to navigate (see `useLogout`). */
export async function logout(): Promise<void> {
  await deleteAccountSession();
}
