"use server";

import { after } from "next/server";
import { sendOrderEmails } from "@/emails/send";
import { getAccount } from "@/features/account/session";
import { RECIPIENT_EMAIL } from "@/lib/leads";
import { RATE_LIMITED, clientIp, withinLimits } from "@/lib/rateLimit";
import { createOrder, parseOrder, referenceFor } from "./orders";

const HOUR = 60 * 60;

export type OrderState =
  | { readonly status: "idle" }
  | { readonly status: "error"; readonly error: string }
  | { readonly status: "placed"; readonly reference: string };

export async function placeOrder(_prevState: OrderState, formData: FormData): Promise<OrderState> {
  const parsed = parseOrder(formData);
  if (!parsed.ok) {
    return { status: "error", error: parsed.error };
  }
  // Honeypot tripped: look placed so the bot gets no signal, but store nothing.
  if (parsed.spam) {
    return { status: "placed", reference: referenceFor(crypto.randomUUID()) };
  }

  const { order } = parsed;
  // Each order emails the address typed in, so both the sender and the recipient are capped.
  const allowed = await withinLimits([
    { key: `order:ip:${await clientIp()}`, max: 5, windowSeconds: HOUR },
    { key: `order:email:${order.contact.email.toLowerCase()}`, max: 3, windowSeconds: HOUR },
  ]);
  if (!allowed) return { status: "error", error: RATE_LIMITED };

  const account = await getAccount();
  let reference: string;
  try {
    reference = await createOrder(order, account?.userId ?? null);
  } catch (err) {
    console.error(`[orders] could not store ${order.mode} order:`, err);
    return {
      status: "error",
      error: `We couldn't place your order just now. Please try again, or email ${RECIPIENT_EMAIL}.`,
    };
  }

  after(() => sendOrderEmails(order, reference));
  return { status: "placed", reference };
}
