/**
 * Every event the site records, named `object_action` in the past tense. Add
 * new events here rather than sending free-form names, so reports and goals
 * stay consistent. Renaming one splits its history, so add a name instead.
 * `client` events may be sent from the browser; the rest are only recorded
 * by server actions, so they can't be faked from the console.
 */
export const ANALYTICS_EVENTS = {
  order_placed: { label: "Order placed", client: false },
  mnda_signed: { label: "MNDA signed", client: false },
  newsletter_subscribed: { label: "Newsletter sign-up", client: false },
  newsletter_confirmed: { label: "Newsletter confirmed", client: false },
  account_registered: { label: "Account registered", client: false },
  engineer_requested: { label: "Engineer requested", client: false },
  investor_requested: { label: "Investor inquiry", client: false },
  outbound_click: { label: "Outbound link", client: true },
  file_download: { label: "File download", client: true },
} as const satisfies Record<string, { label: string; client: boolean }>;

export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS;

export type ClientEvent = {
  [K in AnalyticsEvent]: (typeof ANALYTICS_EVENTS)[K]["client"] extends true ? K : never;
}[AnalyticsEvent];

/** An event's properties: a few flat values, e.g. the order's mode or the link's URL. */
export type EventProps = Record<string, string | number | boolean>;

export function isAnalyticsEvent(name: unknown): name is AnalyticsEvent {
  return typeof name === "string" && Object.hasOwn(ANALYTICS_EVENTS, name);
}

export function isClientEvent(name: unknown): name is ClientEvent {
  return isAnalyticsEvent(name) && ANALYTICS_EVENTS[name].client;
}

export function eventLabel(name: string): string {
  return isAnalyticsEvent(name) ? ANALYTICS_EVENTS[name].label : name;
}

const MAX_PROPS = 10;
const MAX_PROP_LENGTH = 300;

/** Keeps at most ten string, number or boolean properties, each name and value trimmed to size. */
export function cleanProps(input: unknown): EventProps {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const props: EventProps = {};
  for (const [key, value] of Object.entries(input).slice(0, MAX_PROPS)) {
    const name = key.slice(0, 40);
    if (typeof value === "string") props[name] = value.slice(0, MAX_PROP_LENGTH);
    else if (typeof value === "number" && Number.isFinite(value)) props[name] = value;
    else if (typeof value === "boolean") props[name] = value;
  }
  return props;
}
