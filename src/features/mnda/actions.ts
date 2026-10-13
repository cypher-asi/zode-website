"use server";

import { after } from "next/server";
import { sendMndaEmails } from "@/emails/send";
import { getAccount } from "@/features/account/session";
import { trackServerEvent } from "@/features/analytics/server";
import { RATE_LIMITED, clientIp, withinLimits } from "@/lib/rateLimit";
import { createMnda, signFailure } from "./mndas";
import { parseMnda } from "./parse";

export type MndaState =
  | { readonly status: "idle" }
  | { readonly status: "error"; readonly error: string }
  | { readonly status: "signed"; readonly email: string; readonly entityName: string };

/** The public /mnda form: the counterparty signs, ZODE countersigns, and both get the PDF. */
export async function signMndaAction(_prev: MndaState, formData: FormData): Promise<MndaState> {
  const parsed = parseMnda(formData);
  if (!parsed.ok) return { status: "error", error: parsed.error };
  const { party } = parsed;
  const signed = { status: "signed", email: party.signerEmail, entityName: party.entityName } as const;
  // Honeypot tripped: look signed so the bot gets no signal, but execute nothing.
  if (parsed.spam) return signed;

  const allowed = await withinLimits([
    { key: `mnda:ip:${await clientIp()}`, max: 5, windowSeconds: 60 * 60 },
    { key: `mnda:email:${party.signerEmail}`, max: 3, windowSeconds: 24 * 60 * 60 },
  ]);
  if (!allowed) return { status: "error", error: RATE_LIMITED };

  // Logged in with the signing address: bind the agreement to the account too.
  const account = await getAccount();
  const userId = account && account.email.trim().toLowerCase() === party.signerEmail ? account.userId : null;

  try {
    const mnda = await createMnda(party, { userId, room: null });
    after(() => sendMndaEmails(mnda, null));
  } catch (err) {
    return { status: "error", error: signFailure(err) };
  }
  await trackServerEvent("mnda_signed");
  return signed;
}
