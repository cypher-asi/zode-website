"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { Dialog } from "@/features/data-room/Dialog";
import { Icon } from "./bits";
import type { Option } from "./types";
import styles from "./zrm.module.css";

/** Keeps the menu this far from the window's edges. */
const MARGIN = 8;

/** The items of `menu` itself, not of a submenu open inside it. */
const itemsOf = (menu: HTMLElement): HTMLElement[] =>
  Array.from(menu.querySelectorAll<HTMLElement>("[role^=menuitem]")).filter((item) => item.closest("[role=menu]") === menu);

/** Moves focus among a menu's items by `step`, wrapping at the ends. */
function focusStep(menu: HTMLElement, step: number): void {
  const items = itemsOf(menu);
  const at = items.indexOf(document.activeElement as HTMLElement);
  items[at === -1 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length]?.focus();
}

/** A field the menu sets from a submenu of its choices. */
export interface RowMenuChoice {
  key: string;
  label: string;
  options: readonly Option[];
  current: string;
}

/**
 * A record's right-click menu in the list, at the pointer: open it, set one of
 * `choices` from a submenu, pin it, or delete it once confirmed. Closes on a
 * click outside, Escape, scrolling or a choice.
 */
export function RowMenu({
  name,
  x,
  y,
  active,
  choices,
  deleteDescription,
  onOpen,
  onChange,
  onPin,
  onDelete,
  onClose,
}: {
  name: string;
  x: number;
  y: number;
  active: boolean;
  choices: readonly RowMenuChoice[];
  deleteDescription: string;
  onOpen: () => void;
  onChange: (key: string, value: string) => void;
  onPin: () => void;
  onDelete: () => Promise<string | undefined>;
  /** `restoreFocus` when closed from the keyboard, to hand focus back to the row. */
  onClose: (restoreFocus: boolean) => void;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const left = Math.max(MARGIN, Math.min(x, window.innerWidth - width - MARGIN));
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.max(MARGIN, Math.min(y, window.innerHeight - height - MARGIN))}px`;
    menu.toggleAttribute("data-flip", left + width * 2 > window.innerWidth - MARGIN);
    focusStep(menu, 1);
  }, [x, y]);

  useEffect(() => {
    if (confirming) return;
    const close = () => onClose(false);
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onClose(true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [confirming, onClose]);

  const openSub = (key: string) => {
    setSub(key);
    requestAnimationFrame(() => {
      const menu = ref.current?.querySelector<HTMLElement>("[data-sub]");
      if (menu) focusStep(menu, 1);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const menu = target.closest<HTMLElement>("[role=menu]");
    if (!menu) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusStep(menu, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "ArrowRight" && target.dataset.opens) {
      event.preventDefault();
      openSub(target.dataset.opens);
    } else if ((event.key === "ArrowLeft" || event.key === "Escape") && menu.hasAttribute("data-sub")) {
      event.preventDefault();
      event.stopPropagation();
      setSub(null);
      (menu.previousElementSibling as HTMLElement | null)?.focus();
    }
  };

  if (confirming) {
    return (
      <Dialog
        title={`Delete ${name}?`}
        description={deleteDescription}
        confirmLabel="Delete"
        danger
        onConfirm={onDelete}
        onClose={() => onClose(true)}
      />
    );
  }

  return (
    <div
      ref={ref}
      className={styles.contextMenu}
      role="menu"
      aria-label={`Actions for ${name}`}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button type="button" role="menuitem" className={styles.contextItem} onPointerEnter={() => setSub(null)} onClick={onOpen}>
        Open
      </button>
      <div className={styles.contextSeparator} role="separator" />
      {choices.map((choice) => {
        const open = sub === choice.key;
        return (
          <div key={choice.key} className={styles.contextSub} onPointerEnter={() => setSub(choice.key)}>
            <button
              type="button"
              role="menuitem"
              className={styles.contextItem}
              aria-haspopup="menu"
              aria-expanded={open}
              data-opens={choice.key}
              onClick={() => openSub(choice.key)}
            >
              <span>{choice.label}</span>
              <span className={styles.contextValue}>
                {choice.options.find((option) => option.value === choice.current)?.label ?? "None"}
              </span>
              <Icon name="next" className={styles.contextIcon} />
            </button>
            {open ? (
              <div className={styles.contextMenu} data-sub="" role="menu" aria-label={choice.label}>
                {choice.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={option.value === choice.current}
                    className={styles.contextItem}
                    onClick={() => onChange(choice.key, option.value)}
                  >
                    <Icon name="check" className={styles.contextIcon} />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      <div className={styles.contextSeparator} role="separator" />
      <button type="button" role="menuitem" className={styles.contextItem} onPointerEnter={() => setSub(null)} onClick={onPin}>
        {active ? "Unpin" : "Pin to top"}
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.contextItem}
        data-danger=""
        onPointerEnter={() => setSub(null)}
        onClick={() => setConfirming(true)}
      >
        Delete…
      </button>
    </div>
  );
}
