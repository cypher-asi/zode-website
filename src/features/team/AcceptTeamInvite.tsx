"use client";

import { useActionState, type ReactElement } from "react";
import styles from "@/features/data-room/invite.module.css";
import ui from "@/features/data-room/ui.module.css";
import type { InviteRole } from "@/features/users/types";
import { acceptTeamInviteAction, type TeamActionState } from "./actions";

export function AcceptTeamInvite({ token, role }: { token: string; role: InviteRole }): ReactElement {
  const [state, accept, pending] = useActionState<TeamActionState>(() => acceptTeamInviteAction(token), {});
  return (
    <form action={accept} className={styles.actions}>
      <button type="submit" className={ui.primary} disabled={pending}>
        {pending ? "Joining…" : role === "team" ? "Join the team" : "Accept invite"}
      </button>
      {state.error ? <p className={ui.error}>{state.error}</p> : null}
    </form>
  );
}
