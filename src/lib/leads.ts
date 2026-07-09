/**
 * ZODE compute-lead model — the single source of truth shared by the
 * buy/give-compute forms (client) and the `/api/leads` route (server).
 *
 * Keeping the field definitions here means the browser and the server validate
 * against the same option lists and labels: the client can't submit a shape the
 * server rejects, and the human-readable summary sent to the CRM never drifts
 * from what the form actually asked.
 */

export type LeadType = 'buy' | 'give';

/** Fallback inbox used when the CRM webhook is unreachable (see the forms). */
export const RECIPIENT_EMAIL = 'hello@zode.org';

/* --- Option lists (rendered by the forms, enforced by the validator) ------ */

export const BUY_GPU_OPTIONS = [
  '1 - 8 GPUs',
  '8 - 32 GPUs',
  '32 - 128 GPUs',
  '128 - 512 GPUs',
  '512+ GPUs',
] as const;

export const BUY_SPEND_OPTIONS = [
  'Under $10k / mo',
  '$10k - $50k / mo',
  '$50k - $250k / mo',
  '$250k - $1M / mo',
  '$1M+ / mo',
] as const;

export const BUY_START_OPTIONS = [
  'Immediately',
  'Within a week',
  'This month',
  'This quarter',
  'Just exploring',
] as const;

export const GIVE_HARDWARE_OPTIONS = [
  'NVIDIA H100',
  'NVIDIA A100',
  'NVIDIA L40S / L40',
  'NVIDIA RTX 4090',
  'AMD MI300X',
  'Other / mixed fleet',
] as const;

export const GIVE_COUNT_OPTIONS = [
  '1 - 8 GPUs',
  '8 - 32 GPUs',
  '32 - 128 GPUs',
  '128 - 512 GPUs',
  '512+ GPUs',
] as const;

export const GIVE_AVAIL_OPTIONS = [
  'Immediately',
  'Within a week',
  'This month',
  'This quarter',
  'Just exploring',
] as const;

/* --- Field schema --------------------------------------------------------- */

type FieldKind = 'text' | 'email' | 'select' | 'textarea';

interface FieldDef {
  key: string;
  /** Human label used in the CRM summary and the mailto fallback body. */
  label: string;
  required: boolean;
  kind: FieldKind;
  options?: readonly string[];
  maxLength: number;
  /**
   * Normalized CRM column this field maps into. Buy and give ask different
   * questions that mean the same thing (buy's `gpus` needed vs give's `count`
   * available are both a GPU-scale range), so they share a column — one clean
   * table for both sides of the marketplace. See `toCrmRecord` / `CRM_FIELDS`.
   */
  crm: string;
  /**
   * Whether the field is safe to send to analytics. Free-text and identity
   * fields (name, email, workload) are PII and stay out of Mixpanel; the
   * coarse select tiers are not and make useful funnel dimensions.
   */
  analytics?: boolean;
}

export const LEAD_FIELDS: Record<LeadType, readonly FieldDef[]> = {
  buy: [
    { key: 'name', label: 'Name', required: true, kind: 'text', maxLength: 200, crm: 'name' },
    { key: 'email', label: 'Work email', required: true, kind: 'email', maxLength: 200, crm: 'email' },
    { key: 'company', label: 'Company', required: true, kind: 'text', maxLength: 200, crm: 'company' },
    { key: 'gpus', label: 'GPUs needed', required: true, kind: 'select', options: BUY_GPU_OPTIONS, maxLength: 60, crm: 'gpuScale', analytics: true },
    { key: 'spend', label: 'Monthly compute spend', required: true, kind: 'select', options: BUY_SPEND_OPTIONS, maxLength: 60, crm: 'monthlySpend', analytics: true },
    { key: 'start', label: 'When can you start', required: true, kind: 'select', options: BUY_START_OPTIONS, maxLength: 60, crm: 'timing', analytics: true },
    { key: 'workload', label: 'What are you running', required: false, kind: 'textarea', maxLength: 5000, crm: 'details' },
  ],
  give: [
    { key: 'name', label: 'Name', required: true, kind: 'text', maxLength: 200, crm: 'name' },
    { key: 'email', label: 'Work email', required: true, kind: 'email', maxLength: 200, crm: 'email' },
    { key: 'company', label: 'Company', required: true, kind: 'text', maxLength: 200, crm: 'company' },
    { key: 'hardware', label: 'Hardware type', required: true, kind: 'select', options: GIVE_HARDWARE_OPTIONS, maxLength: 60, crm: 'hardware', analytics: true },
    { key: 'count', label: 'GPUs available', required: true, kind: 'select', options: GIVE_COUNT_OPTIONS, maxLength: 60, crm: 'gpuScale', analytics: true },
    { key: 'availability', label: 'Available from', required: true, kind: 'select', options: GIVE_AVAIL_OPTIONS, maxLength: 60, crm: 'timing', analytics: true },
    { key: 'setup', label: 'About their setup', required: false, kind: 'textarea', maxLength: 5000, crm: 'details' },
  ],
};

/**
 * The normalized CRM columns, stable across buy and give. Every lead forwarded
 * to the webhook carries all of these keys (empty string when a side doesn't
 * ask that question), so the CRM mapping is one-to-one and never conditional.
 */
export const CRM_FIELDS = [
  'name',
  'email',
  'company',
  'gpuScale',
  'hardware',
  'monthlySpend',
  'timing',
  'details',
] as const;

/**
 * Flatten a validated lead into the normalized CRM shape. Always returns every
 * `CRM_FIELDS` key so the webhook payload has a constant shape regardless of
 * lead type.
 */
export function toCrmRecord(type: LeadType, values: LeadValues): Record<string, string> {
  const record: Record<string, string> = {};
  for (const key of CRM_FIELDS) record[key] = '';
  for (const field of LEAD_FIELDS[type]) {
    if (values[field.key]) record[field.crm] = values[field.key];
  }
  return record;
}

/** Values keyed by field key, e.g. `{ name, email, company, gpus, ... }`. */
export type LeadValues = Record<string, string>;

/** Name of the honeypot field: a real user never fills it; bots do. */
export const HONEYPOT_FIELD = 'website';

// Deliberately simple: catches obvious garbage without rejecting valid,
// unusual addresses. The webhook consumer / a human is the real gate.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ValidationResult =
  | { ok: true; spam: false; type: LeadType; values: LeadValues }
  /** Honeypot tripped: accept the request but forward nothing. */
  | { ok: true; spam: true }
  | { ok: false; error: string };

/**
 * Validate and normalize an untrusted submission (from the request body).
 * Returns only the fields defined for the lead type — extra keys are dropped.
 */
export function validateLead(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Expected a JSON object.' };
  }
  const body = raw as Record<string, unknown>;

  const type = body.type;
  if (type !== 'buy' && type !== 'give') {
    return { ok: false, error: 'Unknown lead type.' };
  }

  // Honeypot: a filled hidden field means a bot. Report success so the bot
  // gets no signal, but tell the caller to forward nothing.
  const honey = body[HONEYPOT_FIELD];
  if (typeof honey === 'string' && honey.trim() !== '') {
    return { ok: true, spam: true };
  }

  const values: LeadValues = {};
  for (const field of LEAD_FIELDS[type]) {
    const rawValue = body[field.key];
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';

    if (!value) {
      if (field.required) return { ok: false, error: `Missing field: ${field.label}.` };
      continue;
    }
    if (value.length > field.maxLength) {
      return { ok: false, error: `${field.label} is too long.` };
    }
    if (field.kind === 'email' && !EMAIL_RE.test(value)) {
      return { ok: false, error: `${field.label} is not a valid email.` };
    }
    if (field.kind === 'select' && field.options && !field.options.includes(value)) {
      return { ok: false, error: `${field.label} is not a valid option.` };
    }
    values[field.key] = value;
  }

  return { ok: true, spam: false, type, values };
}

/** One-line summary for the CRM/email subject, e.g. "Acme · 8 - 32 GPUs". */
export function summarize(type: LeadType, values: LeadValues): string {
  const who = values.company || values.name || 'Unknown';
  const detail = type === 'buy' ? values.gpus : values.hardware;
  const verb = type === 'buy' ? 'Compute request' : 'Compute offer';
  return detail ? `${verb} — ${who} · ${detail}` : `${verb} — ${who}`;
}

/** Non-PII funnel dimensions safe to send to analytics (tiers only). */
export function analyticsProps(type: LeadType, values: LeadValues): Record<string, string> {
  const props: Record<string, string> = { lead_type: type };
  for (const field of LEAD_FIELDS[type]) {
    if (field.analytics && values[field.key]) props[field.key] = values[field.key];
  }
  return props;
}

/**
 * Build the `mailto:` fallback URL. Used only when the CRM webhook is
 * unreachable, so a lead is still delivered rather than silently lost.
 */
export function buildMailtoUrl(type: LeadType, values: LeadValues): string {
  const lines = LEAD_FIELDS[type]
    .filter((f) => f.kind !== 'textarea')
    .map((f) => `${f.label}: ${values[f.key] ?? ''}`);

  const freeform = LEAD_FIELDS[type].filter((f) => f.kind === 'textarea');
  for (const f of freeform) {
    if (values[f.key]) lines.push('', `${f.label}:`, values[f.key]);
  }

  const subject = summarize(type, values);
  const body = lines.join('\n');
  return `mailto:${RECIPIENT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
