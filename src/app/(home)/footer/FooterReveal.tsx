"use client";

import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { FooterNav } from "@/components/SiteFooter";
import styles from "./FooterReveal.module.css";

/**
 * Copyright line under the landscape band. Its arrow slides the footer link
 * columns up in a panel over the photo; Escape or a click outside closes it.
 */
export function FooterReveal(): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={ref} className={styles.root}>
      <div id={panelId} className={styles.panel} data-open={open || undefined} inert={!open}>
        <FooterNav />
      </div>

      <div className={styles.row}>
        <p className={styles.copyright}>Copyright 2026 ZODE, Inc.</p>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Hide footer links" : "Show footer links"}
          onClick={() => setOpen((o) => !o)}
        >
          <svg className={styles.arrow} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.5 10 8 5.5l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
