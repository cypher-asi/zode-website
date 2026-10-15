"use client";

import { useActionState, type ReactElement } from "react";
import { acceptInviteAction } from "./actions";
import type { ActionState, InviteRef } from "./types";
import ui from "./ui.module.css";
import styles from "./invite.module.css";

export function AcceptInvite({ invite }: { invite: InviteRef }): ReactElement {
  const [state, accept, pending] = useActionState<ActionState>(() => acceptInviteAction(invite), {});
  return (
    <form action={accept} className={styles.actions}>
      <button type="submit" className={ui.primary} disabled={pending}>
        {pending ? "Joining…" : "Accept and open"}
      </button>
      {state.error ? <p className={ui.error}>{state.error}</p> : null}
    </form>
  );
}
