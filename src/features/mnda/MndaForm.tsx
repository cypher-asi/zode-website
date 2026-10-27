"use client";

import { useId, useState, type ReactElement } from "react";
import { HONEYPOT_FIELD } from "@/lib/leads";
import { consentText } from "./agreement";
import { FIELD_LIMITS, MAX_ADDRESS_LINES } from "./parse";
import styles from "./Mnda.module.css";

const EMPTY = {
  entityName: "",
  entityType: "",
  entityAddress: "",
  signerName: "",
  signerTitle: "",
  signerEmail: "",
  signature: "",
};

type Values = typeof EMPTY;

interface MndaFormProps {
  action: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
  /** The signer's address when it's already known and proven, as in a data room invite. */
  lockedEmail?: string;
  /** The version of the agreement shown beside the form; signing fails if it's been replaced since. */
  templateVersion: string;
  submitLabel: string;
}

/**
 * The counterparty's details and typed signature. Inputs are controlled so a
 * server-side error doesn't clear them when React resets the form.
 */
export function MndaForm({
  action,
  pending,
  error,
  lockedEmail,
  templateVersion,
  submitLabel,
}: MndaFormProps): ReactElement {
  const id = useId();
  const [values, setValues] = useState<Values>({ ...EMPTY, signerEmail: lockedEmail ?? "" });
  const [consent, setConsent] = useState(false);

  const bind = (key: keyof Values) => ({
    id: `${id}-${key}`,
    name: key,
    value: values[key],
    onChange: (event: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: event.target.value })),
  });

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="templateVersion" value={templateVersion} />
      <fieldset className={styles.group}>
        <legend className={styles.legend}>The entity</legend>
        <div className={styles.fields}>
          <div className={`${styles.field} ${styles.full}`}>
            <label className={styles.label} htmlFor={`${id}-entityName`}>
              Legal name
            </label>
            <input
              {...bind("entityName")}
              className={styles.input}
              autoComplete="organization"
              placeholder="Acme Robotics, Inc."
              maxLength={FIELD_LIMITS.entityName}
              required
            />
          </div>
          <div className={`${styles.field} ${styles.full}`}>
            <label className={styles.label} htmlFor={`${id}-entityType`}>
              Entity type and jurisdiction
            </label>
            <input
              {...bind("entityType")}
              className={styles.input}
              placeholder="Delaware corporation"
              maxLength={FIELD_LIMITS.entityType}
              aria-describedby={`${id}-entityType-hint`}
              required
            />
            <span id={`${id}-entityType-hint`} className={styles.hint}>
              Completes &ldquo;{values.entityName.trim() || "Entity"}, a ___&rdquo;.
            </span>
          </div>
          <div className={`${styles.field} ${styles.full}`}>
            <label className={styles.label} htmlFor={`${id}-entityAddress`}>
              Address for notices
            </label>
            <textarea
              {...bind("entityAddress")}
              className={styles.textarea}
              autoComplete="street-address"
              rows={MAX_ADDRESS_LINES}
              placeholder={"123 Market Street, Suite 400\nSan Francisco, CA 94105\nUnited States"}
              maxLength={FIELD_LIMITS.entityAddress}
              required
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Signing for the entity</legend>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-signerName`}>
              Full name
            </label>
            <input
              {...bind("signerName")}
              className={styles.input}
              autoComplete="name"
              maxLength={FIELD_LIMITS.signerName}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${id}-signerTitle`}>
              Title
            </label>
            <input
              {...bind("signerTitle")}
              className={styles.input}
              autoComplete="organization-title"
              placeholder="Chief Executive Officer"
              maxLength={FIELD_LIMITS.signerTitle}
              required
            />
          </div>
          <div className={`${styles.field} ${styles.full}`}>
            <label className={styles.label} htmlFor={`${id}-signerEmail`}>
              Email
            </label>
            <input
              {...bind("signerEmail")}
              className={styles.input}
              type="email"
              autoComplete="email"
              readOnly={Boolean(lockedEmail)}
              aria-describedby={`${id}-signerEmail-hint`}
              required
            />
            <span id={`${id}-signerEmail-hint`} className={styles.hint}>
              {lockedEmail
                ? "The address your invite was sent to. The signed copy goes here."
                : "The executed copy is emailed here and to ZODE."}
            </span>
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Signature</legend>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-signature`}>
            Type your full name to sign
          </label>
          <input
            {...bind("signature")}
            className={styles.signature}
            autoComplete="off"
            spellCheck={false}
            placeholder={values.signerName.trim() || "Your full name"}
            maxLength={FIELD_LIMITS.signerName}
            required
          />
        </div>
        <label className={styles.consent}>
          <input
            type="checkbox"
            name="consent"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            required
          />
          <span>{consentText(values.entityName.trim() || "the entity")}</span>
        </label>
      </fieldset>

      {/* Hidden from people; bots that fill every field give themselves away. */}
      <div className={styles.trap} aria-hidden="true">
        <label>
          Website
          <input name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div className={styles.footer}>
        <div role="alert">{error ? <p className={styles.error}>{error}</p> : null}</div>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? "Signing…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
