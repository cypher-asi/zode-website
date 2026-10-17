"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactElement } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/features/data-room/icons";
import share from "@/features/data-room/share.module.css";
import ui from "@/features/data-room/ui.module.css";
import { inviteTeamAction } from "@/features/team/actions";
import { INVITE_ROLES, ROLE_LABELS, type InviteRole } from "./types";

const INVITES_PATH = "/portal/users/invites";

const ROLE_DETAILS: Record<InviteRole, string> = {
  member: "Sees their own records and the data rooms shared with them.",
  team: "Can also open data rooms, ZRM and Posts, and see the team.",
};

/** Opens the invite dialog; shown to super admins beside the Users tabs. */
export function InviteUserButton({ defaultRole }: { defaultRole: InviteRole }): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={ui.primary} onClick={() => setOpen(true)}>
        <Icon name="userPlus" />
        Invite
      </button>
      {open ? <InviteUserDialog defaultRole={defaultRole} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Emails a personal invite link to each address, as a Regular user or a Team member. */
function InviteUserDialog({ defaultRole, onClose }: { defaultRole: InviteRole; onClose: () => void }): ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<InviteRole>(defaultRole);
  const [error, setError] = useState<string>();
  const [sending, startSending] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // showModal focuses the first control, which is the close button.
    inputRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`${ui.dialog} ${share.dialog}`}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
    >
      <form
        className={ui.dialogForm}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setError(undefined);
          startSending(async () => {
            const outcome = await inviteTeamAction({}, form);
            if (outcome.error) {
              setError(outcome.error);
              return;
            }
            ref.current?.close();
            if (pathname !== INVITES_PATH) router.push(INVITES_PATH);
          });
        }}
      >
        <div className={share.header}>
          <h2 id={`${id}-title`} className={ui.dialogTitle}>
            Invite people
          </h2>
          <button type="button" className={ui.iconButton} aria-label="Close" onClick={() => ref.current?.close()}>
            <Icon name="close" />
          </button>
        </div>
        <p className={ui.dialogText}>
          Each address gets a personal link. They sign in, or create a ZODE account, with that email to accept.
        </p>

        <label className={ui.field}>
          <span className={ui.label}>Emails</span>
          <input
            ref={inputRef}
            name="emails"
            type="text"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            placeholder="name@example.com, another@example.com"
            className={ui.input}
            value={emails}
            onChange={(event) => setEmails(event.target.value)}
            required
          />
        </label>

        <fieldset className={share.roles}>
          <legend className={ui.label}>Role</legend>
          {INVITE_ROLES.map((option) => (
            <label key={option} className={share.roleOption}>
              <input
                type="radio"
                name="role"
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
              />
              <span>
                <strong>{ROLE_LABELS[option]}</strong>
                <span>{ROLE_DETAILS[option]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className={share.footer}>
          {error ? (
            <p className={ui.error} role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className={ui.primary} disabled={sending || !emails.trim()}>
            {sending ? "Sending…" : "Send invites"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
