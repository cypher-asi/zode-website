"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { sendMailingListConfirmation } from "@/emails/send";
import { getAccount } from "@/features/account/session";
import type { Account } from "@/features/account/zos";
import { normalizeEmail } from "@/features/data-room/rooms";
import { HONEYPOT_FIELD } from "@/lib/leads";
import { RATE_LIMITED, clientIp, withinLimits } from "@/lib/rateLimit";
import { isEmail, singleLine } from "@/lib/validation";
import {
  confirmSubscription,
  confirmUrl,
  requestSubscription,
  subscriptionsFor,
  unsubscribe,
  verifyUnsubscribe,
  type PendingConfirmation,
} from "./subscribers";
import { isMailingList, type ActionResult, type MailingList, type SubscribeState } from "./types";

const FAILED = "We couldn't sign you up just now. Please try again shortly.";

/** Stores the sign-up and emails a confirmation link; `name` is only known for signed-in accounts. */
async function signUp(
  list: MailingList,
  email: string,
  source: string | null,
  account: Account | null,
): Promise<string | null> {
  const ip = await clientIp();
  const allowed = await withinLimits([
    { key: `subscribe:ip:${ip}`, max: 10, windowSeconds: 60 * 60 },
    { key: `subscribe:email:${email}`, max: 3, windowSeconds: 24 * 60 * 60 },
  ]);
  if (!allowed) return RATE_LIMITED;

  const ownEmail = account && normalizeEmail(account.email) === email;
  let pending: PendingConfirmation | null;
  try {
    pending = await requestSubscription({
      list,
      email,
      name: ownEmail ? account.displayName : null,
      source,
      account,
      ip,
      userAgent: (await headers()).get("user-agent")?.slice(0, 300) ?? null,
    });
  } catch (error) {
    console.error("[mailing-list] couldn't store sign-up", error);
    return FAILED;
  }
  if (pending) {
    after(() =>
      sendMailingListConfirmation(
        pending.email,
        { name: pending.name, list, confirmUrl: confirmUrl(pending.token) },
        pending.token.slice(0, 16),
      ),
    );
  }
  return null;
}

/**
 * The public sign-up form. Every accepted address gets the same answer,
 * whether or not it was already on the list, so the form can't be used to
 * find out who is subscribed.
 */
export async function subscribeAction(_prev: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const raw = singleLine(String(formData.get("email") ?? ""));
  const email = normalizeEmail(raw);
  if (!isEmail(email)) return { status: "error", error: "Enter a valid email address.", email: raw };
  // Honeypot tripped: look sent so the bot gets no signal, but store nothing.
  const honey = formData.get(HONEYPOT_FIELD);
  if (typeof honey === "string" && honey.trim()) return { status: "sent", email };

  const list = formData.get("list");
  if (!isMailingList(list)) return { status: "error", error: FAILED, email: raw };
  const source = formData.get("source");
  const error = await signUp(list, email, typeof source === "string" ? source : null, await getAccount());
  return error ? { status: "error", error, email: raw } : { status: "sent", email };
}

/** Spends a confirmation link. A button press rather than the page load does it, so link scanners can't. */
export async function confirmSubscriptionAction(token: string): Promise<ActionResult> {
  try {
    const email = await confirmSubscription(token);
    return email ? { done: true } : { error: "This link has expired or was already used. Sign up again to get a new one." };
  } catch (error) {
    console.error("[mailing-list] confirm failed", error);
    return { error: "Couldn't confirm right now. Please try again." };
  }
}

export async function unsubscribeAction(id: string, sig: string): Promise<ActionResult> {
  if (!verifyUnsubscribe(id, sig)) return { error: "This unsubscribe link isn't valid." };
  try {
    await unsubscribe(id);
    return { done: true };
  } catch (error) {
    console.error("[mailing-list] unsubscribe failed", error);
    return { error: "Couldn't unsubscribe right now. Please try again." };
  }
}

/** Portal settings: sign the account's own email up to a list, or take it off one. */
export async function accountSubscribeAction(list: MailingList): Promise<ActionResult> {
  if (!isMailingList(list)) return { error: FAILED };
  const account = await getAccount();
  if (!account) return { error: "Your session has ended. Log in again to make changes." };
  const error = await signUp(list, normalizeEmail(account.email), "settings", account);
  if (error) return { error };
  refresh();
  return { done: true };
}

export async function accountUnsubscribeAction(list: MailingList): Promise<ActionResult> {
  if (!isMailingList(list)) return { error: "Couldn't unsubscribe right now. Please try again." };
  const account = await getAccount();
  if (!account) return { error: "Your session has ended. Log in again to make changes." };
  try {
    const subscription = (await subscriptionsFor(account)).find((row) => row.list === list);
    if (subscription) await unsubscribe(subscription.id);
  } catch (error) {
    console.error("[mailing-list] account unsubscribe failed", error);
    return { error: "Couldn't unsubscribe right now. Please try again." };
  }
  refresh();
  return { done: true };
}
