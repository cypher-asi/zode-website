"use client";

import { useActionState, type ReactElement, type ReactNode } from "react";
import ui from "@/features/data-room/ui.module.css";
import styles from "@/features/data-room/invite.module.css";
import type { ActionResult } from "./types";

/**
 * One button that runs a mailing list action (confirm, unsubscribe, the
 * settings toggle) and shows its error. `done` replaces the button once it worked.
 */
export function MailingListButton({
  run,
  label,
  pendingLabel,
  done,
  variant = "primary",
}: {
  run: () => Promise<ActionResult>;
  label: string;
  pendingLabel: string;
  done?: ReactNode;
  variant?: "primary" | "button";
}): ReactElement {
  const [state, action, pending] = useActionState<ActionResult>(() => run(), {});
  if (state.done && done) return <>{done}</>;
  return (
    <form action={action} className={styles.actions}>
      <button type="submit" className={ui[variant]} disabled={pending}>
        {pending ? pendingLabel : label}
      </button>
      {state.error ? (
        <p className={ui.error} role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
