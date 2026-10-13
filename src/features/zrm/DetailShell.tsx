"use client";

import { useOptimistic, useState, useTransition, type ReactElement, type ReactNode } from "react";
import { Dialog } from "@/features/data-room/Dialog";
import ui from "@/features/data-room/ui.module.css";
import { deleteRecordAction, setActiveAction } from "./actions";
import { Avatar, Icon } from "./bits";
import { formatDate } from "./fieldUi";
import { ChildSection } from "./sections";
import { KIND_LABELS, type Note, type ZrmKind } from "./types";
import { ZrmLink } from "./ZrmProvider";
import styles from "./zrm.module.css";

function PinButton({ kind, id, active }: { kind: ZrmKind; id: string; active: boolean }): ReactElement {
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [, startTransition] = useTransition();
  const label = optimistic ? "Unpin from the top of the list" : "Pin to the top of the list";
  return (
    <button
      type="button"
      className={`${ui.iconButton} ${styles.iconButton}`}
      aria-pressed={optimistic}
      aria-label={label}
      title={label}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await setActiveAction(kind, id, !optimistic);
        })
      }
    >
      <Icon name="star" />
    </button>
  );
}

function DeleteButton({ kind, id, name }: { kind: ZrmKind; id: string; name: string }): ReactElement {
  const [open, setOpen] = useState(false);
  const singular = KIND_LABELS[kind].singular.toLowerCase();
  return (
    <>
      <button
        type="button"
        className={ui.iconButton}
        aria-label={`Delete ${singular}`}
        title={`Delete ${singular}`}
        onClick={() => setOpen(true)}
      >
        <Icon name="trash" />
      </button>
      {open ? (
        <Dialog
          title={`Delete ${name}?`}
          description={
            kind === "opportunities"
              ? "Its activities and notes go with it. This can't be undone."
              : `Its notes go with it, and anything linked to it is unlinked. This can't be undone.`
          }
          confirmLabel="Delete"
          danger
          onConfirm={async () => (await deleteRecordAction(kind, id)).error}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * The open record: its name and actions over a Profile tab (the panel's
 * sections) and a Notes tab.
 */
export function DetailShell({
  kind,
  id,
  name,
  subtitle,
  active,
  actions,
  notes,
  children,
}: {
  kind: ZrmKind;
  id: string;
  name: string;
  subtitle?: ReactNode;
  active: boolean;
  /** Extra controls beside pin and delete, e.g. an opportunity's stage. */
  actions?: ReactNode;
  notes: readonly Note[];
  children: ReactNode;
}): ReactElement {
  const [tab, setTab] = useState<"profile" | "notes">("profile");

  return (
    <>
      <header className={styles.detailHeader}>
        <ZrmLink href={`/portal/zrm/${kind}`} className={`${ui.iconButton} ${styles.back}`} aria-label={`Back to ${KIND_LABELS[kind].plural}`}>
          <Icon name="back" />
        </ZrmLink>
        <Avatar name={name} shape={kind === "companies" ? "square" : "round"} size="lg" />
        <div className={styles.detailTitle}>
          <h2>{name}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className={styles.detailActions}>
          {actions}
          <PinButton kind={kind} id={id} active={active} />
          <DeleteButton kind={kind} id={id} name={name} />
          <ZrmLink
            href={`/portal/zrm/${kind}`}
            className={`${ui.iconButton} ${styles.close}`}
            aria-label="Close"
            title="Close"
          >
            <Icon name="close" />
          </ZrmLink>
        </div>
      </header>

      <div className={styles.detailTabs} role="tablist" aria-label="Record">
        {(["profile", "notes"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            className={styles.detailTab}
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {value === "profile" ? "Profile" : `Notes${notes.length ? ` (${notes.length})` : ""}`}
          </button>
        ))}
      </div>

      <div className={styles.sections} role="tabpanel">
        {tab === "profile" ? (
          children
        ) : (
          <section className={styles.section}>
            <ChildSection
              child="note"
              kind={kind}
              parentId={id}
              items={notes}
              addLabel="Add note"
              formFirst
              noun="note"
              render={(note) => (
                <>
                  <span className={styles.long}>{note.body}</span>
                  <span className={styles.itemMeta}>
                    {[note.author_email, formatDate(note.created_at)].filter(Boolean).join(" · ")}
                  </span>
                </>
              )}
            />
          </section>
        )}
      </div>
    </>
  );
}
