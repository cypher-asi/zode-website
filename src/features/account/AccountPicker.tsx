"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { initials } from "./initials";
import type { RememberedAccount } from "./rememberedAccounts";
import styles from "./auth.module.css";

function Avatar({ account }: { account: RememberedAccount }): ReactElement {
  const [broken, setBroken] = useState(false);
  return (
    <span className={styles.accountAvatar} aria-hidden="true">
      {account.image && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.image} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        initials(account.name || account.email)
      )}
    </span>
  );
}

function Identity({ account }: { account: RememberedAccount }): ReactElement {
  return (
    <>
      <Avatar account={account} />
      <span className={styles.accountText}>
        <span className={styles.accountName}>{account.name || account.email}</span>
        {account.name ? <span className={styles.accountEmail}>{account.email}</span> : null}
      </span>
    </>
  );
}

/**
 * Chooses which remembered account to log in as, in place of the email
 * field. Each account can be forgotten from this device, and the last row
 * switches back to typing an email.
 */
export function AccountPicker({
  accounts,
  selected,
  onSelect,
  onAdd,
  onRemove,
}: {
  accounts: readonly RememberedAccount[];
  selected: RememberedAccount;
  onSelect: (email: string) => void;
  onAdd: () => void;
  onRemove: (email: string) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const options = (): HTMLElement[] =>
    Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-option]") ?? []);

  const openList = () => {
    setOpen(true);
    requestAnimationFrame(() => options()[0]?.focus());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) {
      if (event.key === "ArrowDown" && event.target === triggerRef.current) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "Escape") {
      // Keeps the surrounding modal dialog from closing too.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    const items = options();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = at === -1 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length;
    event.preventDefault();
    items[next]?.focus();
  };

  const remove = (email: string) => {
    onRemove(email);
    if (email === selected.email || accounts.length <= 1) {
      setOpen(false);
      return;
    }
    requestAnimationFrame(() => options()[0]?.focus());
  };

  return (
    <div ref={rootRef} className={styles.picker} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.pickerTrigger}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Account: ${selected.name ? `${selected.name}, ` : ""}${selected.email}. Change account`}
        onClick={() => (open ? setOpen(false) : openList())}
      >
        <Identity account={selected} />
        <svg className={styles.pickerChevron} viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <ul id={listId} className={styles.pickerList} aria-label="Saved accounts">
          {accounts.map((account) => (
            <li key={account.email} className={styles.pickerRow}>
              <button
                type="button"
                data-option=""
                className={styles.pickerOption}
                aria-current={account.email === selected.email || undefined}
                onClick={() => {
                  onSelect(account.email);
                  setOpen(false);
                }}
              >
                <Identity account={account} />
              </button>
              <button
                type="button"
                data-option=""
                className={styles.pickerRemove}
                aria-label={`Remove ${account.email} from this device`}
                title="Remove from this device"
                onClick={() => remove(account.email)}
              >
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M3 3l8 8M11 3l-8 8" />
                </svg>
              </button>
            </li>
          ))}
          <li className={styles.pickerRow}>
            <button
              type="button"
              data-option=""
              className={`${styles.pickerOption} ${styles.pickerAdd}`}
              onClick={() => {
                setOpen(false);
                onAdd();
              }}
            >
              <span className={styles.accountAvatar} aria-hidden="true">
                +
              </span>
              <span className={styles.accountName}>Use another account</span>
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
