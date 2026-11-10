"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendLoginCodeEmail, sendRegistrationEmails } from "@/emails/send";
import { trackServerEvent } from "@/features/analytics/server";
import { claimPendingInvites } from "@/features/data-room/invites";
import { RATE_LIMITED, clientIp, withinLimits } from "@/lib/rateLimit";
import { isEmail, singleLine } from "@/lib/validation";
import { LOGIN_CODE_TTL_MINUTES, issueLoginCode, redeemLoginCode } from "./loginCodes";
import { MIN_PASSWORD_LENGTH } from "./password";
import { createAccountSession, deleteAccountSession, safeNext } from "./session";
import {
  ZosError,
  describeZosError,
  isZosRejection,
  zosLogin,
  zosLoginWithCode,
  zosRegister,
  zosRequestLoginCode,
  type Account,
} from "./zos";

const MINUTE = 60;
const HOUR = 60 * MINUTE;

export interface AuthFormState {
  readonly error?: string;
  /** Echoed back so the form keeps the address after a failed attempt. */
  readonly email?: string;
  /** Set once a login code is on its way, so the form asks for it. */
  readonly codeSentTo?: string;
}

/**
 * The login form's submit buttons pick the `intent`: a password, emailing a
 * one-time code, or entering that code.
 */
export async function login(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  switch (formData.get("intent")) {
    case "send-code":
      return sendLoginCode(email);
    case "verify-code":
      return loginWithCode(email, String(formData.get("code") ?? "").trim(), formData);
    default:
      return loginWithPassword(email, String(formData.get("password") ?? ""), formData);
  }
}

/** Shared by password and code logins, so guessing either draws on one budget. */
async function withinLoginLimits(email: string): Promise<boolean> {
  return withinLimits([
    { key: `login:ip:${await clientIp()}`, max: 10, windowSeconds: 15 * MINUTE },
    { key: `login:email:${email.toLowerCase()}`, max: 5, windowSeconds: 15 * MINUTE },
  ]);
}

async function loginWithPassword(email: string, password: string, formData: FormData): Promise<AuthFormState> {
  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }
  if (!(await withinLoginLimits(email))) return { error: RATE_LIMITED, email };

  let account: Account;
  try {
    account = await zosLogin(email, password);
  } catch (error) {
    return { error: describeZosError(error, "login", "Couldn't log in right now. Please try again."), email };
  }
  return signIn(account, formData);
}

async function sendLoginCode(email: string): Promise<AuthFormState> {
  if (!isEmail(email)) return { error: "Enter your email to get a login code.", email };

  // Tighter than logins: each one sends someone an email.
  const allowed = await withinLimits([
    { key: `login-code:ip:${await clientIp()}`, max: 5, windowSeconds: 15 * MINUTE },
    { key: `login-code:email:${email.toLowerCase()}`, max: 3, windowSeconds: 15 * MINUTE },
  ]);
  if (!allowed) return { error: RATE_LIMITED, email };

  const failed = { error: "Couldn't send a code right now. Please try again.", email };
  // This site sends the code for an address that has signed in here; ZOS for any other.
  let issued: Awaited<ReturnType<typeof issueLoginCode>>;
  try {
    issued = await issueLoginCode(email);
    if (issued) {
      await sendLoginCodeEmail(email, { code: issued.code, minutes: LOGIN_CODE_TTL_MINUTES }, issued.id);
    }
  } catch (error) {
    console.error("[account] couldn't send a login code", error);
    return failed;
  }
  if (!issued) {
    try {
      await zosRequestLoginCode(email);
    } catch (error) {
      if (!isZosRejection(error)) return { ...failed, error: describeZosError(error, "code", failed.error) };
    }
  }
  return { email, codeSentTo: email };
}

async function loginWithCode(email: string, code: string, formData: FormData): Promise<AuthFormState> {
  if (!email) return { error: "Enter your email to get a login code.", email };
  if (!code) return { error: "Enter the code from your email.", email, codeSentTo: email };
  if (!(await withinLoginLimits(email))) return { error: RATE_LIMITED, email, codeSentTo: email };

  const failed = { error: "Couldn't log in right now. Please try again.", email, codeSentTo: email };
  let account: Account;
  try {
    const result = await redeemLoginCode(email, code);
    if (result.status === "invalid") return { ...failed, error: "That code is invalid or expired." };
    account = result.status === "ok" ? result.account : await zosLoginWithCode(email, code);
  } catch (error) {
    if (!(error instanceof ZosError)) console.error("[account] couldn't check a login code", error);
    return { ...failed, error: describeZosError(error, "code", failed.error) };
  }
  return signIn(account, formData);
}

async function signIn(account: Account, formData: FormData): Promise<never> {
  const next = safeNext(formData.get("next"));
  await createAccountSession(account);
  await joinInvitedRooms(account, next);
  redirect(next);
}

/**
 * Data rooms shared with this email before the account signed in; a failure
 * leaves them in the portal to accept. Skipped on the way to an invite link,
 * which would otherwise find its invite already used; accepting it joins the rest.
 */
async function joinInvitedRooms(account: Account, next: string): Promise<void> {
  if (next.startsWith("/data-rooms/invite/")) return;
  try {
    await claimPendingInvites(account);
  } catch (error) {
    console.error("[account] couldn't join invited data rooms", error);
  }
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
  const next = safeNext(formData.get("next"));
  await createAccountSession(account);
  await joinInvitedRooms(account, next);
  redirect(next);
}

/** Clears the session; callers decide whether to navigate (see `useLogout`). */
export async function logout(): Promise<void> {
  await deleteAccountSession();
}
