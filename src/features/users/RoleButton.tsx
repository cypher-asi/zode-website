"use client";

import { useState, type ReactElement } from "react";
import { Dialog } from "@/features/data-room/Dialog";
import ui from "@/features/data-room/ui.module.css";
import { setRoleAction } from "./actions";
import type { UserRole } from "./types";

/** Grants or revokes super admin for one user, after a confirmation. */
export function RoleButton({ userId, role, label }: { userId: number; role: UserRole; label: string }): ReactElement {
  const [open, setOpen] = useState(false);
  const granting = role !== "super_admin";

  return (
    <>
      <button type="button" className={granting ? ui.button : ui.danger} onClick={() => setOpen(true)}>
        {granting ? "Make super admin" : "Remove super admin"}
      </button>
      {open ? (
        <Dialog
          title={granting ? `Make ${label} a super admin?` : `Remove ${label} as a super admin?`}
          description={
            granting
              ? "They'll see every account's contracts, posts and subscribers, and can make anyone else a super admin, or remove them."
              : "They'll go back to seeing only their own records."
          }
          confirmLabel={granting ? "Make super admin" : "Remove super admin"}
          danger={!granting}
          onConfirm={async () => (await setRoleAction(userId, granting ? "super_admin" : "member")).error}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
