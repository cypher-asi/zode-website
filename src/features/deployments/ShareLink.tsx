"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactElement } from "react";
import { Icon } from "@/features/data-room/icons";
import share from "@/features/data-room/share.module.css";
import ui from "@/features/data-room/ui.module.css";
import { copyText } from "@/features/profile/ProfileClient";
import { setDeploymentAccessAction } from "./actions";
import { ACCESS_OPTIONS, deploymentLink, type Deployment, type DeploymentAccess } from "./types";

const COPIED_MS = 1800;

/** The ZODE team's Share button for a deployment, opening its share dialog. */
export function ShareLink({
  deployment,
}: {
  deployment: Pick<Deployment, "id" | "name" | "access" | "shareToken">;
}): ReactElement {
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

/**
 * Who can open the deployment, like a data room's share dialog: picking an
 * option saves it, and the link to copy follows it, the public page while
 * anyone can open it, otherwise its page in the portal.
 */
function ShareDialog({
  deployment,
  onClose,
}: {
  deployment: Pick<Deployment, "id" | "name" | "access" | "shareToken">;
  onClose: () => void;
}): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [access, setAccess] = useState<DeploymentAccess>(deployment.access);
  const [token, setToken] = useState(deployment.shareToken);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [saving, startSaving] = useTransition();
  const link = `${window.location.origin}${deploymentLink({ id: deployment.id, access, shareToken: token })}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const pick = (next: DeploymentAccess) => {
    const previous = access;
    setAccess(next);
    setError(undefined);
    setCopied(false);
    startSaving(async () => {
      const result = await setDeploymentAccessAction(deployment.id, next);
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

        <fieldset className={share.roles} disabled={saving}>
          <legend className={ui.label}>Who can open it</legend>
          {ACCESS_OPTIONS.map((option) => (
            <label key={option.value} className={share.roleOption}>
              <input
                type="radio"
                name={`${id}-access`}
                value={option.value}
                checked={access === option.value}
                onChange={() => pick(option.value)}
              />
              <span>
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className={ui.field}>
          <label htmlFor={`${id}-link`} className={ui.label}>
            Link
          </label>
          <input
            id={`${id}-link`}
            className={ui.input}
            value={link}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>

        <div className={share.footer}>
          {error ? (
            <p className={ui.error} role="alert">
              {error}
            </p>
          ) : (
            <p className={ui.ok} aria-live="polite">
              {saving ? "Saving…" : copied ? "Link copied" : ""}
            </p>
          )}
          <button
            type="button"
            className={ui.primary}
            disabled={saving}
            onClick={async () => {
              if (await copyText(link)) setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
