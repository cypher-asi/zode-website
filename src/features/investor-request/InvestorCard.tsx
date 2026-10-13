"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, type ReactElement } from "react";
import { useModalClose } from "@/components/ui/RouteModal";
import { requestInvestor, type InvestorRequestState } from "./actions";
import { InvestorForm } from "./InvestorForm";
import styles from "@/features/engineer-request/EngineerCard.module.css";

const INITIAL: InvestorRequestState = { status: "idle" };

/**
 * The Invest card: a two-step form, then a thank-you in its place. Shared by
 * the modal and the standalone page; the close button only appears inside the
 * modal.
 */
export function InvestorCard(): ReactElement {
  const [state, formAction, pending] = useActionState(requestInvestor, INITIAL);
  const close = useModalClose();

  return (
    <section className={styles.card}>
      <div className={styles.body}>
        {state.status === "sent" ? (
          <Thanks name={state.name} email={state.email} close={close} />
        ) : (
          <InvestorForm action={formAction} pending={pending} error={state.status === "error" ? state.error : null} />
        )}
      </div>
      {close ? (
        <button type="button" className={styles.close} onClick={close} aria-label="Close">
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      ) : null}
    </section>
  );
}

function Thanks({ name, email, close }: { name: string; email: string; close: (() => void) | null }): ReactElement {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className={styles.thanks} role="status">
      <svg className={styles.tick} viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="24" />
        <path d="M15 27.5l7 7 15-16" />
      </svg>
      <p className={styles.eyebrow}>Inquiry received</p>
      <h2 ref={headingRef} className={styles.title} tabIndex={-1}>
        Thanks, {name.split(" ")[0]}.
      </h2>
      <p className={styles.lede}>
        Our team will be in touch at <strong>{email}</strong> with next steps.
      </p>
      <div className={styles.actions}>
        {close ? (
          <button type="button" className={styles.primary} onClick={close}>
            Done
          </button>
        ) : (
          <Link className={styles.primary} href="/">
            Back to home
          </Link>
        )}
      </div>
    </div>
  );
}
