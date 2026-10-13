"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import styles from "./Deck.module.css";

const COPIED_MS = 1800;
/** Whether the system share sheet exists doesn't change while the page is open. */
const noSubscribe = () => () => {};

type Copied = "slide" | "deck" | null;

const deckUrl = (slide?: number) =>
  `${window.location.origin}/deck${slide && slide > 1 ? `?slide=${slide}` : ""}`;

/**
 * The deck's share popover: copy a link to this slide or the whole deck,
 * hand it to the system share sheet where there is one, or print the deck to
 * PDF. It opens upward from the control bar.
 */
export function ShareMenu({
  open,
  onOpenChange,
  slideNumber,
  slideTitle,
  buttonClassName,
  iconClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slideNumber: number;
  slideTitle: string;
  buttonClassName: string;
  iconClassName: string;
}): ReactElement {
  const menuId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [copied, setCopied] = useState<Copied>(null);
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onOpenChange]);

  const close = () => {
    onOpenChange(false);
    buttonRef.current?.focus();
  };

  const copy = async (which: Exclude<Copied, null>) => {
    try {
      await navigator.clipboard.writeText(deckUrl(which === "slide" ? slideNumber : undefined));
      setCopied(which);
    } catch {
      // Clipboard access can be refused; the address bar still holds the slide's link.
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: "ZODE investor deck", text: slideTitle, url: deckUrl(slideNumber) });
      close();
    } catch {
      // Dismissing the share sheet rejects; nothing to do.
    }
  };

  const print = () => {
    onOpenChange(false);
    window.print();
  };

  const onMenuKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (at + 1) % items.length;
    else if (event.key === "ArrowUp") next = (at - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      close();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <div ref={anchorRef} className={styles.shareAnchor}>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => onOpenChange(!open)}
      >
        <svg className={iconClassName} viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 7.5V1.5M3.5 4L6 1.5 8.5 4M2 6.5v4h8v-4" />
        </svg>
        Share
      </button>
      {open ? (
        <ul ref={menuRef} id={menuId} className={styles.menu} role="menu" aria-label="Share" onKeyDown={onMenuKey}>
          <li role="none">
            <button type="button" role="menuitem" className={styles.menuItem} onClick={() => copy("slide")}>
              {copied === "slide" ? "Link copied" : `Copy link to slide ${slideNumber}`}
              <span className={styles.cursor} aria-hidden="true" />
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" className={styles.menuItem} onClick={() => copy("deck")}>
              {copied === "deck" ? "Link copied" : "Copy link to deck"}
              <span className={styles.cursor} aria-hidden="true" />
            </button>
          </li>
          {canShare ? (
            <li role="none">
              <button type="button" role="menuitem" className={styles.menuItem} onClick={share}>
                Share…
                <span className={styles.cursor} aria-hidden="true" />
              </button>
            </li>
          ) : null}
          <li role="none" className={styles.menuRule} />
          <li role="none">
            <button type="button" role="menuitem" className={styles.menuItem} onClick={print}>
              Download PDF
              <span className={styles.cursor} aria-hidden="true" />
            </button>
          </li>
        </ul>
      ) : null}
      <span className={styles.srOnly} aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
