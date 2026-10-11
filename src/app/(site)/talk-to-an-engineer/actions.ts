"use server";

import { after } from "next/server";
import { sendEngineerRequestEmail } from "@/lib/email";
import { createEngineerRequest, parseEngineerRequest } from "@/lib/engineer-requests";
import { RECIPIENT_EMAIL } from "@/lib/leads";
import { isAuthenticated } from "@/lib/session";

export type EngineerRequestState =
  | { readonly status: "idle" }
  | { readonly status: "error"; readonly error: string }
  | { readonly status: "sent"; readonly name: string; readonly email: string; readonly phone: string };

export async function requestEngineer(
  _prevState: EngineerRequestState,
  formData: FormData,
): Promise<EngineerRequestState> {
  if (!(await isAuthenticated())) {
    return { status: "error", error: "Your session has expired. Please sign in again." };
  }

  const parsed = parseEngineerRequest(formData);
  if (!parsed.ok) {
    return { status: "error", error: parsed.error };
  }
  const { request } = parsed;
  const sent = { status: "sent", name: request.name, email: request.email, phone: request.phone } as const;
  // Honeypot tripped: look sent so the bot gets no signal, but store nothing.
  if (parsed.spam) return sent;

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
