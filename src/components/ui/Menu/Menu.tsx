"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import styles from "./Menu.module.css";

export interface MenuItem {
  id: string;
  label: string;
  onSelect: () => void;
}

export interface MenuProps {
  items: readonly MenuItem[];
  /** Accessible name for the trigger and the menu it opens. */
  label: string;
  /** The trigger's content, usually an icon. */
  children: ReactNode;
  /** Extra class on the trigger, for its size and placement. */
  triggerClassName?: string;
  /** Which of the trigger's edges the menu lines up with. */
  align?: "start" | "end";
}

/** Moves focus among `items` by `step`, wrapping at the ends. */
function focusStep(items: readonly HTMLElement[], step: number): void {
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = at === -1 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length;
  items[next]?.focus();
}

/**
 * A button that drops the site's standard menu, styled like the header's Buy
 * Compute menu: an ink outline on paper that unrolls downward, its uppercase
 * rows typing in behind a block cursor. It stays mounted so it can roll back
 * up; while closed it is hidden, which keeps its rows out of the tab order.
 */
export function Menu({ items, label, children, triggerClassName, align = "end" }: MenuProps): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const rows = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    if (open) {
      focusStep(rows(), step);
    } else {
      setOpen(true);
      requestAnimationFrame(() => focusStep(rows(), step));
    }
  };

  const onMenuKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    focusStep(rows(), step);
  };

  return (
    <div ref={rootRef} className={styles.root} data-open={open || undefined} data-align={align}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName ? `${styles.trigger} ${triggerClassName}` : styles.trigger}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKey}
      >
        {children}
      </button>
      <ul ref={listRef} id={menuId} role="menu" aria-label={label} className={styles.menu} onKeyDown={onMenuKey}>
        {items.map((item, i) => (
          <li key={item.id} role="none">
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <span className={styles.line} style={{ "--i": i, "--chars": item.label.length } as CSSProperties}>
                <span className={styles.text}>{item.label}</span>
                <span className={styles.cursor} aria-hidden="true" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
