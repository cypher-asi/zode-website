"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, type ReactElement } from "react";
import { useModalClose } from "@/components/RouteModal";
import { requestEngineer, type EngineerRequestState } from "./actions";
import { EngineerForm } from "./EngineerForm";
import styles from "./EngineerCard.module.css";

const INITIAL: EngineerRequestState = { status: "idle" };

/**
 * The Talk to an Engineer card: a two-step form, then a thank-you in its
 * place. Shared by the modal and the standalone page; the close button only
 * appears inside the modal.
 */
export function EngineerCard(): ReactElement {
  const [state, formAction, pending] = useActionState(requestEngineer, INITIAL);
  const close = useModalClose();

  return (
    <section className={styles.card}>
      <div className={styles.body}>
        {state.status === "sent" ? (
          <Thanks name={state.name} email={state.email} phone={state.phone} close={close} />
        ) : (
          <EngineerForm action={formAction} pending={pending} error={state.status === "error" ? state.error : null} />
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

function Thanks({
  name,
  email,
  phone,
  close,
}: {
  name: string;
  email: string;
  phone: string;
  close: (() => void) | null;
}): ReactElement {
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
      <p className={styles.eyebrow}>Request received</p>
      <h2 ref={headingRef} className={styles.title} tabIndex={-1}>
        Thanks, {name.split(" ")[0]}.
      </h2>
      <p className={styles.lede}>
        An engineer will email you at <strong>{email}</strong> or text <strong>{phone}</strong> to find a time to meet.
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
