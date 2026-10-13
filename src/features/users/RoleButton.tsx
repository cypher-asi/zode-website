"use client";

import { useState, type ReactElement } from "react";
import { Dialog } from "@/features/data-room/Dialog";
import ui from "@/features/data-room/ui.module.css";
import { setRoleAction } from "./actions";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "./types";

const OPTIONS = USER_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

/** Sets one user's site-wide role, after a confirmation. */
export function RoleButton({ userId, role, label }: { userId: number; role: UserRole; label: string }): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={ui.button} onClick={() => setOpen(true)}>
        Change role
      </button>
      {open ? (
        <Dialog
          title={`Change ${label}'s role`}
          description={
            <>
              Regular accounts see only their own records and the data rooms shared with them. Team can also open data
              rooms and see the team in Settings. Super admins see every account&apos;s records and set anyone&apos;s
              role.
            </>
          }
          choice={{ label: "Role", options: OPTIONS, initial: role }}
          confirmLabel="Save role"
          onConfirm={async (value) => (value === role ? undefined : (await setRoleAction(userId, value)).error)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
