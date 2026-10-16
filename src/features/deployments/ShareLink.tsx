"use client";

import { useEffect, useState, useTransition, type ReactElement } from "react";
import { Dialog } from "@/features/data-room/Dialog";
import ui from "@/features/data-room/ui.module.css";
import { copyText } from "@/features/profile/ProfileClient";
import { shareDeploymentAction } from "./actions";
import shared from "./shared.module.css";
import { sharePath } from "./types";

const COPIED_MS = 1800;

/**
 * The ZODE team's control for a deployment's public link: creating it copies
 * it, after which it can be copied again or turned off, which breaks it.
 */
export function ShareLink({ id, token: initial }: { id: string; token: string | null }): ReactElement {
  const [token, setToken] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async (shared: string) => {
    if (await copyText(`${window.location.origin}${sharePath(shared)}`)) setCopied(true);
  };

  const create = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await shareDeploymentAction(id, true);
      if ("error" in result) return setError(result.error);
      setToken(result.token);
      if (result.token) await copy(result.token);
    });

  return (
    <>
      {token ? (
        <>
          <a href={sharePath(token)} className={ui.button} target="_blank" rel="noopener">
            Open public link
          </a>
          <button type="button" className={ui.button} onClick={() => copy(token)}>
            {copied ? "Copied" : "Copy public link"}
          </button>
          <button type="button" className={ui.button} onClick={() => setConfirming(true)}>
            Stop sharing
          </button>
        </>
      ) : (
        <button type="button" className={ui.button} onClick={create} disabled={pending}>
          {pending ? "Creating…" : "Create public link"}
        </button>
      )}
      <span className={shared.srOnly} aria-live="polite">
        {copied ? "Public link copied" : ""}
      </span>
      {error ? (
        <span className={ui.error} role="alert">
          {error}
        </span>
      ) : null}
      {confirming ? (
        <Dialog
          title="Stop sharing this deployment?"
          description="The public link stops working for everyone who has it. Sharing again makes a new link."
          confirmLabel="Stop sharing"
          danger
          onConfirm={async () => {
            const result = await shareDeploymentAction(id, false);
            if ("error" in result) return result.error;
            setToken(null);
          }}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}
