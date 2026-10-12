"use client";

import { useState, type ReactElement } from "react";
import styles from "./Styleguide.module.css";

/** Copies `text` to the clipboard, confirming in place for a moment. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }): ReactElement {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className={styles.copy} onClick={copy}>
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
