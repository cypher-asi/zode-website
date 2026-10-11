"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { FooterNav } from "@/components/SiteFooter";
import styles from "./FooterReveal.module.css";

/**
 * Band under the landscape: the faded wordmark, centred, with a sideways
 * copyright line in the right-hand rail. The MENU button in the left rail
 * swaps the wordmark for the site's footer links, in the same spot; Escape
 * closes them again.
 */
export function FooterReveal(): ReactElement {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navId = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open || event.key !== "Escape") return;
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div
      className={styles.root}
      data-circuit-rule
      data-open={open || undefined}
      onKeyDown={onKeyDown}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls={navId}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Close" : "Menu"}
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.mark}
        src="/wordmark.svg"
        alt=""
        aria-hidden="true"
        inert={open}
      />
      <div id={navId} className={styles.nav} inert={!open}>
        <FooterNav open={open} />
      </div>
      <p className={styles.copyright}>Copyright 2026 ZODE, Inc.</p>
    </div>
  );
}
