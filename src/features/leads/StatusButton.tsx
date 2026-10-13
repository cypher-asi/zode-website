"use client";

import { useState, type ReactElement } from "react";
import { Dialog } from "@/features/data-room/Dialog";
import ui from "@/features/data-room/ui.module.css";
import { setLeadStatusAction } from "./actions";
import { LEAD_STATUSES, type LeadSource, type LeadStatus } from "./types";

const OPTIONS = LEAD_STATUSES.map((status) => ({ value: status.id, label: status.label }));

/** Sets one lead's status, picked in a dialog. */
export function StatusButton({
  source,
  id,
  status,
  label,
}: {
  source: LeadSource;
  id: string;
  status: LeadStatus;
  label: string;
}): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={ui.button} onClick={() => setOpen(true)}>
        Set status
      </button>
      {open ? (
        <Dialog
          title={`Set ${label}'s status`}
          description="Where the team stands with this lead. Customers see an order's as Received, In progress or Closed."
          choice={{ label: "Status", options: OPTIONS, initial: status }}
          confirmLabel="Save status"
          onConfirm={async (value) =>
            value === status ? undefined : (await setLeadStatusAction(source, id, value)).error
          }
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
