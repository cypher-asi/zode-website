/**
 * Client-side lead submission for the compute forms.
 *
 * POSTs the lead to `/api/leads`. Returns `true` when the CRM accepted it; the
 * form falls back to a pre-filled `mailto:` draft on `false` so a lead is never
 * lost. (No analytics here — zode-website has no analytics boundary; the
 * monorepo build fires the Mixpanel funnel events.)
 */
export async function postLead(payload: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
