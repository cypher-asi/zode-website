"use client";

import type { ReactElement } from "react";
import { openMailDraft } from "@/lib/mailto";
import styles from "./page.module.css";

const RECIPIENT = "hello@zode.org";

export function SubmittedPanel({
  mailtoUrl,
  onReset,
}: {
  mailtoUrl: string;
  onReset: () => void;
}): ReactElement {
  return (
    <div className={styles.confirmation}>
      <span className={styles.confirmationIcon} aria-hidden="true">
        <BigCheckIcon />
      </span>
      <h2 className={styles.confirmationTitle}>Your email draft is ready</h2>
      <p className={styles.confirmationText}>
        Your email app should have opened with your request pre-filled — just
        hit send and we&apos;ll reply, usually within a few hours.
      </p>
      <p className={styles.confirmationText}>
        Nothing opened? Reopen the draft, or email us directly at{" "}
        <a className={styles.confirmationLink} href={`mailto:${RECIPIENT}`}>
          {RECIPIENT}
        </a>
        .
      </p>
      <div className={styles.confirmationActions}>
        <button
          type="button"
          className={styles.submit}
          onClick={() => openMailDraft(mailtoUrl)}
        >
          Reopen email draft
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onReset}>
          Edit details
        </button>
      </div>
    </div>
  );
}

function BigCheckIcon(): ReactElement {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
