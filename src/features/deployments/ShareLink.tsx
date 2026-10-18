"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactElement } from "react";
import { Select } from "@/components/ui/Select";
import { Icon } from "@/features/data-room/icons";
import share from "@/features/data-room/share.module.css";
import ui from "@/features/data-room/ui.module.css";
import { copyText } from "@/features/profile/ProfileClient";
import { setDeploymentAccessAction, setDocAccessAction } from "./actions";
import {
  ACCESS_OPTIONS,
  DEPLOYMENT_DOCS,
  DOC_ACCESS_OPTIONS,
  deploymentLink,
  docLink,
  type Deployment,
  type DeploymentDoc,
  type Option,
} from "./types";

const COPIED_MS = 1800;

type Shared = Pick<Deployment, "id" | "name" | "access" | "shareToken" | "docs">;

/** The ZODE team's Share button for a deployment, opening its share dialog. */
export function ShareLink({ deployment }: { deployment: Shared }): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={ui.squareButton}
        aria-label="Share"
        title="Share"
        onClick={() => setOpen(true)}
      >
        <Icon name="userPlus" />
      </button>
      {open ? <ShareDialog deployment={deployment} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const DOC_TITLES: Record<DeploymentDoc, string> = { teaser: "Teaser", presentation: "Presentation" };

/**
 * Who can open the deployment, its teaser and its presentation, each set on
 * its own: picking an option saves it, and the link beside it follows, a
 * public page while anyone can open it, otherwise its page in the portal.
 */
function ShareDialog({ deployment, onClose }: { deployment: Shared; onClose: () => void }): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`${ui.dialog} ${share.dialog}`}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div className={ui.dialogForm}>
        <div className={share.header}>
          <h2 id={`${id}-title`} className={ui.dialogTitle}>
            Share {deployment.name}
          </h2>
          <button type="button" className={ui.iconButton} aria-label="Close" onClick={() => dialogRef.current?.close()}>
            <Icon name="close" />
          </button>
        </div>

        <ShareRow
          title="Deployment"
          options={ACCESS_OPTIONS}
          initial={{ access: deployment.access, token: deployment.shareToken }}
          linkOf={(access, token) => deploymentLink({ id: deployment.id, access, shareToken: token })}
          save={(access) => setDeploymentAccessAction(deployment.id, access)}
        />
        {DEPLOYMENT_DOCS.map((doc) => (
          <ShareRow
            key={doc}
            title={DOC_TITLES[doc]}
            options={DOC_ACCESS_OPTIONS}
            initial={deployment.docs[doc]}
            linkOf={(access, token) => docLink(deployment.id, doc, { access, token })}
            save={(access) => setDocAccessAction(deployment.id, doc, access)}
          />
        ))}
      </div>
    </dialog>
  );
}

/** One thing to share: who can open it, picked from a dropdown that saves, and its link to copy. */
function ShareRow<A extends string>({
  title,
  options,
  initial,
  linkOf,
  save,
}: {
  title: string;
  options: readonly (Option<A> & { detail: string })[];
  initial: { access: A; token: string | null };
  linkOf: (access: A, token: string | null) => string;
  save: (access: A) => Promise<{ access: A; token: string | null } | { error: string }>;
}): ReactElement {
  const id = useId();
  const [access, setAccess] = useState(initial.access);
  const [token, setToken] = useState(initial.token);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [saving, startSaving] = useTransition();
  const link = `${window.location.origin}${linkOf(access, token)}`;

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const pick = (value: string) => {
    const next = options.find((option) => option.value === value)?.value;
    if (!next) return;
    const previous = access;
    setAccess(next);
    setError(undefined);
    setCopied(false);
    startSaving(async () => {
      const result = await save(next);
      if ("error" in result) {
        setAccess(previous);
        setError(result.error);
        return;
      }
      setAccess(result.access);
      setToken(result.token);
    });
  };

  return (
    <section className={share.shareRow} aria-labelledby={`${id}-title`}>
      <div className={share.shareRowHeader}>
        <div className={share.shareRowText}>
          <h3 id={`${id}-title`} className={share.shareRowTitle}>
            {title}
          </h3>
          <p className={share.shareRowDetail}>{options.find((option) => option.value === access)?.detail}</p>
        </div>
        <Select
          size="sm"
          align="end"
          options={options}
          value={access}
          onChange={pick}
          disabled={saving}
          aria-label={`Who can open the ${title.toLowerCase()}`}
          className={share.shareRowAccess}
        />
      </div>
      <div className={share.linkField}>
        <input
          className={ui.input}
          aria-label={`${title} link`}
          value={link}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          className={ui.iconButton}
          aria-label={copied ? "Copied" : `Copy ${title.toLowerCase()} link`}
          title={copied ? "Copied" : "Copy link"}
          data-copied={copied || undefined}
          disabled={saving}
          onClick={async () => {
            if (await copyText(link)) setCopied(true);
          }}
        >
          <Icon key={copied ? "check" : "copy"} name={copied ? "check" : "copy"} className={share.copyIcon} />
        </button>
      </div>
      {error ? (
        <p className={ui.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
