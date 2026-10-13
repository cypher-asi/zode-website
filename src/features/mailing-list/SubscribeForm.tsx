"use client";

import { useActionState, useId, type ReactElement } from "react";
import ui from "@/features/data-room/ui.module.css";
import { HONEYPOT_FIELD } from "@/lib/leads";
import { subscribeAction } from "./actions";
import type { MailingList, SubscribeSource, SubscribeState } from "./types";
import styles from "./MailingList.module.css";

const INITIAL: SubscribeState = { status: "idle" };

const COPY: Record<MailingList, { title: string; description: string }> = {
  news: {
    title: "Get ZODE news by email",
    description: "Announcements from the ZODE team, straight to your inbox. Unsubscribe any time.",
  },
  changelog: {
    title: "Get changelog updates by email",
    description: "Hear about new features and fixes when they ship. Unsubscribe any time.",
  },
};

/** A mailing list sign-up: one email field. Confirmation happens by email, so success says to check the inbox. */
export function SubscribeForm({
  list,
  source,
  title = COPY[list].title,
  description = COPY[list].description,
}: {
  list: MailingList;
  source: SubscribeSource;
  title?: string;
  description?: string;
}): ReactElement {
  const id = useId();
  const [state, action, pending] = useActionState(subscribeAction, INITIAL);

  return (
    <section className={styles.box} aria-labelledby={`${id}-title`}>
      <div className={styles.copy}>
        <h2 id={`${id}-title`} className={styles.title}>
          {title}
        </h2>
        <p className={styles.description}>{description}</p>
      </div>
      {state.status === "sent" ? (
        <p className={styles.sent} role="status">
          Check <strong>{state.email}</strong> for a link to confirm your subscription.
        </p>
      ) : (
        <form action={action} className={styles.form} noValidate>
          <input type="hidden" name="list" value={list} />
          <input type="hidden" name="source" value={source} />
          <label className={styles.honeypot} aria-hidden="true">
            Website
            <input name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
          <div className={styles.row}>
            <label htmlFor={`${id}-email`} className={styles.srOnly}>
              Email
            </label>
            <input
              id={`${id}-email`}
              className={ui.input}
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
              maxLength={254}
              defaultValue={state.status === "error" ? state.email : ""}
              aria-invalid={state.status === "error" || undefined}
              aria-describedby={state.status === "error" ? `${id}-error` : undefined}
            />
            <button type="submit" className={styles.submit} disabled={pending}>
              {pending ? "Subscribing…" : "Subscribe"}
            </button>
          </div>
          {state.status === "error" ? (
            <p id={`${id}-error`} className={ui.error} role="alert">
              {state.error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
