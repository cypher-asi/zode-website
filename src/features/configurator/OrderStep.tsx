"use client";

import { useActionState, useId, useState, type ReactElement } from "react";
import { HONEYPOT_FIELD } from "@/lib/leads";
import { placeOrder, type OrderState } from "./actions";
import type { Config, PriceView } from "./buyConfig";
import type { RentConfig } from "./rentConfig";
import styles from "./OrderStep.module.css";

const INITIAL: OrderState = { status: "idle" };

type Props =
  | { mode: "buy"; config: Config; view: PriceView }
  | { mode: "rent"; config: RentConfig; view: PriceView };

/**
 * The last step: the configuration at a glance, then contact details. The
 * configuration goes to the server as JSON, where it is checked and priced
 * again before the order is stored.
 */
export function OrderStep({ mode, config, view }: Props): ReactElement {
  const [state, formAction, pending] = useActionState(placeOrder, INITIAL);
  const [contact, setContact] = useState({ name: "", email: "", company: "", notes: "" });
  const id = useId();
  const { headline, breakdown, summary } = view;

  if (state.status === "placed") {
    return (
      <div className={styles.placed} role="status">
        <p className={styles.legend}>{mode === "buy" ? "Order placed" : "Request sent"}</p>
        <p className={styles.reference}>{state.reference}</p>
        <p className={styles.placedText}>
          Thanks{contact.name ? `, ${contact.name.split(" ")[0]}` : ""}. We&apos;ve sent a copy to {contact.email}{" "}
          and will be in touch to confirm the configuration and pricing before anything is final. Quote this reference
          in any reply.
        </p>
      </div>
    );
  }

  const field = (key: keyof typeof contact) => ({
    id: `${id}-${key}`,
    name: key,
    value: contact[key],
    onChange: (event: { target: { value: string } }) => setContact((c) => ({ ...c, [key]: event.target.value })),
  });

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="config" value={JSON.stringify(config)} />

      <p className={styles.legend}>Your configuration</p>
      <dl className={styles.summary}>
        {summary.choices.map((s) => (
          <div key={s.label} className={styles.row}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
        <div className={`${styles.row} ${styles.rowTotal}`}>
          <dt>{breakdown.title}</dt>
          <dd>{breakdown.total}</dd>
        </div>
        <div className={styles.row}>
          <dt>{headline.caption}</dt>
          <dd>
            {headline.format(headline.value)}
            {headline.unit}
          </dd>
        </div>
      </dl>

      <p className={styles.legend}>Your details</p>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-name`}>
            Name
          </label>
          <input className={styles.input} {...field("name")} required maxLength={120} autoComplete="name" />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-email`}>
            Work email
          </label>
          <input
            className={styles.input}
            {...field("email")}
            type="email"
            required
            maxLength={200}
            autoComplete="email"
          />
        </div>
        <div className={`${styles.field} ${styles.full}`}>
          <label className={styles.label} htmlFor={`${id}-company`}>
            Company <span className={styles.optional}>Optional</span>
          </label>
          <input className={styles.input} {...field("company")} maxLength={160} autoComplete="organization" />
        </div>
        <div className={`${styles.field} ${styles.full}`}>
          <label className={styles.label} htmlFor={`${id}-notes`}>
            Notes <span className={styles.optional}>Optional</span>
          </label>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            {...field("notes")}
            maxLength={2000}
            placeholder="Timeline, site constraints, anything we should know"
          />
        </div>
      </div>

      {/* Hidden from people; bots that fill every field give themselves away. */}
      <div className={styles.trap} aria-hidden="true">
        <label>
          Website
          <input name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {state.status === "error" ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Sending…" : mode === "buy" ? "Place order" : "Request cluster"}
      </button>
      <p className={styles.fineprint}>
        Nothing is charged now. We confirm the configuration and final pricing with you before anything is binding.
      </p>
    </form>
  );
}
