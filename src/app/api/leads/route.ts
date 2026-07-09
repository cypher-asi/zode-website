/**
 * ZODE compute-lead capture.
 *
 * Accepts a buy/give-compute submission, validates it against the shared lead
 * schema, and forwards a normalized envelope to the CRM webhook configured in
 * `ZODE_LEADS_WEBHOOK_URL` (the same Airtable webhook the monorepo uses, so
 * zode.org leads land in the same table).
 *
 * Failure is loud on purpose: a misconfigured or failing webhook returns a
 * non-2xx so the browser falls back to its `mailto:` draft and the lead is
 * never silently dropped. Uses the web-standard Request/Response APIs (POST
 * route handlers are never cached), so no `next/server` dependency.
 */
import { validateLead, summarize, toCrmRecord, type LeadType, type LeadValues } from "@/lib/leads";

const WEBHOOK_TIMEOUT_MS = 8000;

interface LeadEnvelope {
  source: "zode.org";
  leadType: LeadType;
  summary: string;
  submittedAt: string;
  lead: LeadValues;
  [column: string]: string | LeadValues;
}

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = validateLead(raw);
  if (!result.ok) {
    return Response.json({ error: "invalid", message: result.error }, { status: 422 });
  }

  // Honeypot tripped — accept without forwarding so the bot gets no signal.
  if (result.spam) {
    return Response.json({ ok: true });
  }

  const webhookUrl = process.env.ZODE_LEADS_WEBHOOK_URL;
  if (!webhookUrl) {
    // Fail loud: we must never believe we're capturing leads when we aren't.
    console.error(
      "[leads] ZODE_LEADS_WEBHOOK_URL is not set — lead NOT captured; client will fall back to mailto.",
    );
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const envelope: LeadEnvelope = {
    source: "zode.org",
    leadType: result.type,
    summary: summarize(result.type, result.values),
    submittedAt: new Date().toISOString(),
    ...toCrmRecord(result.type, result.values),
    lead: result.values,
  };

  const forwarded = await forwardToWebhook(webhookUrl, envelope);
  if (!forwarded.ok) {
    console.error(
      `[leads] webhook forward failed (${forwarded.reason}) for "${envelope.summary}" — client will fall back to mailto.`,
    );
    return Response.json({ error: "forward_failed" }, { status: 502 });
  }

  return Response.json({ ok: true });
}

/** POST the envelope with a timeout; one retry on network error or 5xx. */
async function forwardToWebhook(
  url: string,
  envelope: LeadEnvelope,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const attempt = async (): Promise<{ ok: true } | { ok: false; reason: string; retryable: boolean }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
        signal: controller.signal,
      });
      if (res.ok) return { ok: true };
      // 5xx is worth a retry; a 4xx means the webhook rejected the shape.
      return { ok: false, reason: `status_${res.status}`, retryable: res.status >= 500 };
    } catch (err) {
      const reason = err instanceof Error && err.name === "AbortError" ? "timeout" : "network_error";
      return { ok: false, reason, retryable: true };
    } finally {
      clearTimeout(timer);
    }
  };

  const first = await attempt();
  if (first.ok) return { ok: true };
  if (!first.retryable) return { ok: false, reason: first.reason };

  const second = await attempt();
  return second.ok ? { ok: true } : { ok: false, reason: second.reason };
}
