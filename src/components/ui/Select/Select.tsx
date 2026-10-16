"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ToggleEvent,
} from "react";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
  /** A muted second line under the label, e.g. what a role can do. */
  detail?: string;
}

export interface SelectProps {
  options: readonly SelectOption[];
  /** Controlled value; pair with `onChange`. */
  value?: string;
  /** Starting value when uncontrolled. Changing it later resets the choice, e.g. after "Clear filters". */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Muted text on the trigger while the value matches no option, e.g. a controlled `""` before anything's picked. */
  placeholder?: string;
  /** Submits the value with the surrounding form through a hidden input. */
  name?: string;
  size?: "md" | "sm";
  /** `ghost` reads as plain text until hovered or focused, for a value edited in place. */
  variant?: "ghost";
  /** Which edge of the trigger the panel lines up with. */
  align?: "start" | "end";
  disabled?: boolean;
  /** Id of the trigger button, for a `<label htmlFor>`. */
  id?: string;
  /**
   * Id of the visible label. Use a sibling `<label htmlFor={id}>` rather than
   * wrapping the select, whose open panel would otherwise join the label's text.
   */
  "aria-labelledby"?: string;
  /** Accessible name when there's no visible label. */
  "aria-label"?: string;
  /** Extra class on the root, e.g. for width or a minimum width. */
  className?: string;
}

const GAP = 4;
const EDGE = 8;
const MAX_HEIGHT = 320;
const TYPEAHEAD_MS = 600;

/**
 * A select-style picker drawn by us rather than the OS: an input-styled
 * trigger that opens a listbox in the top layer (Popover API), so it isn't
 * clipped by scroll containers, stacks above modal dialogs, and gets light
 * dismiss and Escape for free.
 */
export function Select({
  options,
  value,
  defaultValue,
  onChange,
  placeholder,
  name,
  size = "md",
  variant,
  align = "start",
  disabled,
  id: triggerId,
  "aria-labelledby": labelledBy,
  "aria-label": ariaLabel,
  className,
}: SelectProps): ReactElement {
  const id = useId();
  const valueId = `${id}-value`;
  const panelId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const scrollToActive = useRef(false);

  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const [seed, setSeed] = useState(defaultValue);
  if (seed !== defaultValue) {
    setSeed(defaultValue);
    setInner(defaultValue ?? options[0]?.value ?? "");
  }

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const current = value ?? inner;
  const selectedIndex = options.findIndex((option) => option.value === current);
  const selected = options[selectedIndex];
  const hasDetail = options.some((option) => option.detail);

  /*
   * Placed from the trigger alone, before the panel is shown and can be
   * measured: it opens below unless the options won't fit there and there's
   * more room above, and the max height keeps it inside the viewport.
   */
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();
    const { clientWidth: vw, clientHeight: vh } = document.documentElement;
    const below = vh - rect.bottom - GAP - EDGE;
    const above = rect.top - GAP - EDGE;
    const wanted = Math.min(MAX_HEIGHT, options.length * (hasDetail ? 56 : 34) + 10);
    const up = below < wanted && above > below;

    const s = panel.style;
    s.setProperty("--trigger-width", `${rect.width}px`);
    s.top = up ? "auto" : `${rect.bottom + GAP}px`;
    s.bottom = up ? `${vh - rect.top + GAP}px` : "auto";
    s.maxHeight = `${Math.min(MAX_HEIGHT, up ? above : below)}px`;
    if (align === "end") {
      s.left = "auto";
      s.right = `${vw - rect.right}px`;
      s.maxWidth = `${rect.right - EDGE}px`;
    } else {
      s.left = `${rect.left}px`;
      s.right = "auto";
      s.maxWidth = `${vw - rect.left - EDGE}px`;
    }
    panel.dataset.side = up ? "top" : "bottom";
  }, [align, hasDetail, options.length]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", place, { capture: true, passive: true });
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open || !scrollToActive.current) return;
    scrollToActive.current = false;
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  });

  const highlight = (index: number) => {
    scrollToActive.current = true;
    setActive(index);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    if (value === undefined) setInner(option.value);
    if (option.value !== current) onChange?.(option.value);
    panelRef.current?.hidePopover();
  };

  const typeahead = (key: string, now: number) => {
    const text = now - typed.current.at > TYPEAHEAD_MS ? key : typed.current.text + key;
    typed.current = { text, at: now };
    // A repeated single letter cycles through the options starting with it.
    const from = text.length === 1 ? active + 1 : active;
    for (let step = 0; step < options.length; step++) {
      const index = (Math.max(from, 0) + step) % options.length;
      if (options[index].label.toLowerCase().startsWith(text.toLowerCase())) return highlight(index);
    }
  };

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    panelRef.current?.showPopover();
  };

  const onPanelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        highlight(active >= last ? 0 : active + 1);
        break;
      case "ArrowUp":
        highlight(active <= 0 ? last : active - 1);
        break;
      case "Home":
        highlight(0);
        break;
      case "End":
        highlight(last);
        break;
      case " ":
        break;
      case "Enter":
        choose(active);
        break;
      case "Escape":
        panelRef.current?.hidePopover();
        break;
      case "Tab":
        panelRef.current?.hidePopover();
        return;
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) typeahead(event.key, event.timeStamp);
        return;
    }
    event.preventDefault();
  };

  const onBeforeToggle = (event: ToggleEvent<HTMLDivElement>) => {
    if (event.newState === "open") {
      place();
      highlight(Math.max(selectedIndex, 0));
    } else if (event.currentTarget.contains(document.activeElement)) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  };

  const onToggle = (event: ToggleEvent<HTMLDivElement>) => {
    const isOpen = event.newState === "open";
    setOpen(isOpen);
    if (isOpen) event.currentTarget.focus({ preventScroll: true });
  };

  return (
    <div className={className ? `${styles.root} ${className}` : styles.root}>
      <button
        ref={triggerRef}
        type="button"
        className={[styles.trigger, size === "sm" && styles.sm, variant === "ghost" && styles.ghost].filter(Boolean).join(" ")}
        disabled={disabled}
        popoverTarget={panelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={panelId}
        id={triggerId}
        aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
        aria-label={ariaLabel && selected ? `${ariaLabel}: ${selected.label}` : ariaLabel}
        onKeyDown={onTriggerKey}
      >
        <span id={valueId} className={styles.value} data-placeholder={(!selected && placeholder) || undefined}>
          {selected?.label ?? placeholder ?? ""}
        </span>
        <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <div
        ref={panelRef}
        id={panelId}
        className={styles.panel}
        popover="auto"
        role="listbox"
        tabIndex={-1}
        aria-labelledby={labelledBy}
        aria-label={ariaLabel}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        data-detail={hasDetail || undefined}
        onBeforeToggle={onBeforeToggle}
        onToggle={onToggle}
        onKeyDown={onPanelKey}
        // Space picks on keyup so its release can't land on the trigger once focus has returned there.
        onKeyUp={(event) => {
          if (event.key === " ") choose(active);
        }}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={optionId(index)}
            className={styles.option}
            role="option"
            aria-selected={index === selectedIndex}
            data-active={index === active || undefined}
            onPointerMove={() => {
              if (index !== active) setActive(index);
            }}
            onClick={() => choose(index)}
          >
            <svg className={styles.check} viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
            <span className={styles.label}>{option.label}</span>
            {option.detail ? <span className={styles.detail}>{option.detail}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
