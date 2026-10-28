"use client";

import { useEffect, useState, type ReactElement } from "react";
import { copyText } from "@/features/profile/ProfileClient";
import { Icon } from "./icons";
import styles from "./Summary.module.css";

const COPIED_MS = 1800;

/** Copies `text`, reading "Copied" with a check for a moment after; `label` names what it copies. */
export function CopyButton({ text, label }: { text: string; label: string }): ReactElement {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <>
      <button
        type="button"
        className={`${styles.modelLink} ${styles.copyButton}`}
        aria-label={copied ? "Copied" : `Copy ${label}`}
        title={copied ? "Copied" : `Copy ${label}`}
        data-copied={copied || undefined}
        onClick={async () => {
          if (await copyText(text)) setCopied(true);
        }}
      >
        <span className={styles.copyLabel}>
          <span>Copy</span>
          <span>Copied</span>
        </span>
        <Icon key={copied ? "check" : "copy"} name={copied ? "check" : "copy"} className={styles.copyIcon} />
      </button>
      <span className={styles.srOnly} aria-live="polite">
        {copied ? `${label[0].toUpperCase()}${label.slice(1)} copied` : ""}
      </span>
    </>
  );
}
