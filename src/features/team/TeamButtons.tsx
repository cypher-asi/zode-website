"use client";

import { useState, useTransition, type ReactElement } from "react";
import { Dialog } from "@/features/data-room/Dialog";
import ui from "@/features/data-room/ui.module.css";
import { removeFromTeamAction, resendTeamInviteAction, revokeTeamInviteAction } from "./actions";

/** Takes one Team member back to Regular, after a confirmation. */
export function RemoveFromTeamButton({ userId, label }: { userId: number; label: string }): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={ui.danger} onClick={() => setOpen(true)}>
        Remove
      </button>
      {open ? (
        <Dialog
          title={`Remove ${label} from the team?`}
          description="Their account goes back to Regular: they keep the data rooms shared with them, but can't open new ones or see the team."
          confirmLabel="Remove from team"
          danger
          onConfirm={async () => (await removeFromTeamAction(userId)).error}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** Resend and Revoke for one pending team invite. */
export function PendingInviteButtons({ inviteId }: { inviteId: string }): ReactElement {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; ok?: string }>({});

  const run = (action: (id: string) => Promise<{ error?: string; ok?: string }>) =>
    startTransition(async () => setResult(await action(inviteId)));

  return (
    <>
      {result.error ? (
        <span className={ui.error} role="alert">
          {result.error}
        </span>
      ) : result.ok ? (
        <span className={ui.ok} role="status">
          {result.ok}
        </span>
      ) : null}
      <button type="button" className={ui.button} disabled={pending} onClick={() => run(resendTeamInviteAction)}>
        Resend
      </button>
      <button type="button" className={ui.danger} disabled={pending} onClick={() => run(revokeTeamInviteAction)}>
        Revoke
      </button>
    </>
  );
}
