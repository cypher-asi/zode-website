"use server";

import { after } from "next/server";
import { sendEngineerRequestEmail } from "@/emails/send";
import { createEngineerRequest, parseEngineerRequest } from "./engineerRequests";
import { RECIPIENT_EMAIL } from "@/lib/leads";
import { RATE_LIMITED, clientIp, withinLimits } from "@/lib/rateLimit";

export type EngineerRequestState =
  | { readonly status: "idle" }
  | { readonly status: "error"; readonly error: string }
  | { readonly status: "sent"; readonly name: string; readonly email: string; readonly phone: string };

export async function requestEngineer(
  _prevState: EngineerRequestState,
  formData: FormData,
): Promise<EngineerRequestState> {
  const parsed = parseEngineerRequest(formData);
  if (!parsed.ok) {
    return { status: "error", error: parsed.error };
  }
  const { request } = parsed;
  const sent = { status: "sent", name: request.name, email: request.email, phone: request.phone } as const;
  // Honeypot tripped: look sent so the bot gets no signal, but store nothing.
  if (parsed.spam) return sent;

  const allowed = await withinLimits([{ key: `engineer:ip:${await clientIp()}`, max: 5, windowSeconds: 60 * 60 }]);
  if (!allowed) return { status: "error", error: RATE_LIMITED };

  let reference: string;
  try {
    reference = await createEngineerRequest(request);
  } catch (err) {
    console.error("[engineer] could not store request:", err);
    return {
      status: "error",
      error: `We couldn't send that just now. Please try again, or email ${RECIPIENT_EMAIL}.`,
    };
  }

  after(() => sendEngineerRequestEmail(request, reference));
  return sent;
}
