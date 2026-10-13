import type { PostKind } from "@/features/posts/types";

/** Each list mails one kind of post, and people join each one on its own. */
export type MailingList = PostKind;

export const MAILING_LISTS: readonly {
  id: MailingList;
  label: string;
  /** What the list sends, to finish "Get …" or "stop getting …". */
  topic: string;
  /** To finish "You get an email when …". */
  when: string;
}[] = [
  { id: "news", label: "News", topic: "ZODE news", when: "we publish news" },
  { id: "changelog", label: "Changelog", topic: "ZODE changelog updates", when: "we ship changelog updates" },
];

export const isMailingList = (value: unknown): value is MailingList => value === "news" || value === "changelog";

export const mailingList = (id: MailingList) => MAILING_LISTS.find((list) => list.id === id) ?? MAILING_LISTS[0];

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

/** One email on one list; the same email on both lists is two subscribers. */
export interface Subscriber {
  id: string;
  list: MailingList;
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
