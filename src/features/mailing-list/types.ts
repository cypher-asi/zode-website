export type SubscriberStatus = "pending" | "subscribed" | "unsubscribed";

export const SUBSCRIBER_STATUSES: readonly { id: SubscriberStatus; label: string }[] = [
  { id: "subscribed", label: "Subscribed" },
  { id: "pending", label: "Pending" },
  { id: "unsubscribed", label: "Unsubscribed" },
];

export const isSubscriberStatus = (value: unknown): value is SubscriberStatus =>
  value === "pending" || value === "subscribed" || value === "unsubscribed";

/** Where a sign-up came from; anything else is stored as null. */
export const SOURCES = ["news", "changelog", "post", "settings"] as const;
export type SubscribeSource = (typeof SOURCES)[number];

export interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  status: SubscriberStatus;
  source: string | null;
  userId: string | null;
  /** The linked account's display name, when it has renamed itself on the site. */
  accountName: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
}

export type SubscribeState =
  | { readonly status: "idle" }
  | { readonly status: "error"; readonly error: string; readonly email: string }
  | { readonly status: "sent"; readonly email: string };

export interface ActionResult {
  readonly error?: string;
  readonly done?: boolean;
}
