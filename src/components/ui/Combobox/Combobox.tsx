"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import type { SelectOption } from "../Select";
import styles from "./Combobox.module.css";

export interface ComboboxProps {
  /** The choices; one valued `""`, e.g. "None", is offered only until something's typed. */
  options: readonly SelectOption[];
  /** Controlled value; pair with `onChange`. */
  value?: string;
  /** Starting value when uncontrolled. */
  defaultValue?: string;
  /** Called on every pick, even of the current value, with the option picked. */
  onChange?: (value: string, option: SelectOption) => void;
  /**
   * Offers to add what's typed when no option is named exactly that, and
   * picks what it returns, or shows its error.
   */
  onCreate?: (query: string) => Promise<{ option?: SelectOption; error?: string }>;
  /** Called on Escape in place of closing the list, e.g. to stop editing in place. */
  onCancel?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  /** Submits the value with the surrounding form through a hidden input. */
  name?: string;
  size?: "md" | "sm";
  /** Focuses the input and opens the list on mount. */
  autoFocus?: boolean;
  /** Id of the input, for a `<label htmlFor>`. */
  id?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** Extra class on the root, e.g. for width. */
  className?: string;
  /** Replaces the input's own look, e.g. for a value edited in place. */
  inputClassName?: string;
}

type Row = { option: SelectOption } | { create: string };

const GAP = 4;
const EDGE = 8;
const MAX_HEIGHT = 320;
const ROW_HEIGHT = 34;
/** Rows rendered at most; the rest are reached by typing more. */
const MAX_ROWS = 50;

/** Options whose label holds `query`, those starting with it first; the empty option only while nothing's typed. */
function filter(options: readonly SelectOption[], query: string): SelectOption[] {
  if (!query) return [...options];
  const q = query.toLowerCase();
  const starts: SelectOption[] = [];
  const contains: SelectOption[] = [];
  for (const option of options) {
    if (!option.value) continue;
    const at = option.label.toLowerCase().indexOf(q);
    if (at === 0) starts.push(option);
    else if (at > 0) contains.push(option);
  }
  return [...starts, ...contains];
}

/**
 * A text input that narrows a list of options as it's typed in, in the top
 * layer like Select's, and with `onCreate` adds what's typed as a new one.
 * Focus stays in the input throughout; leaving it puts back the chosen
 * option's label, or with the text cleared picks the empty option if there is one.
 */
export function Combobox({
  options,
  value,
  defaultValue,
  onChange,
  onCreate,
  onCancel,
  onBlur,
  placeholder,
  name,
  size = "md",
  autoFocus,
  id: inputId,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  className,
  inputClassName,
}: ComboboxProps): ReactElement {
  const id = useId();
  const panelId = `${id}-list`;
  const errorId = `${id}-error`;
  const rowId = (index: number) => `${id}-row-${index}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollToActive = useRef(false);

  const [inner, setInner] = useState(defaultValue ?? "");
  /** The last option picked, so one just created reads by its label before `options` has it. */
  const [picked, setPicked] = useState<SelectOption | null>(null);
  /** What's typed, or null while the input shows the chosen option. */
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(autoFocus === true);
  const [active, setActive] = useState(() =>
    autoFocus ? options.slice(0, MAX_ROWS).findIndex((option) => option.value === (value ?? defaultValue)) : -1,
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = value ?? inner;
  const selected = options.find((option) => option.value === current) ?? (picked?.value === current ? picked : undefined);
  const query = text?.trim() ?? "";
  const matches = filter(options, query);
  const exact = query && options.some((option) => option.label.toLowerCase() === query.toLowerCase());
  const rows: Row[] = matches.slice(0, MAX_ROWS).map((option) => ({ option }));
  if (onCreate && query && !exact) rows.push({ create: query });
  const more = matches.length - Math.min(matches.length, MAX_ROWS);
  const shownText = text ?? (selected?.value ? selected.label : "");

  const place = () => {
    const input = inputRef.current;
    const panel = panelRef.current;
    if (!input || !panel) return;
    const rect = input.getBoundingClientRect();
    const { clientWidth: vw, clientHeight: vh } = document.documentElement;
    const below = vh - rect.bottom - GAP - EDGE;
    const above = rect.top - GAP - EDGE;
    const wanted = Math.min(MAX_HEIGHT, Math.max(rows.length + (more > 0 ? 1 : 0), 1) * ROW_HEIGHT + 10);
    const up = below < wanted && above > below;
    const s = panel.style;
    s.setProperty("--trigger-width", `${rect.width}px`);
    s.top = up ? "auto" : `${rect.bottom + GAP}px`;
    s.bottom = up ? `${vh - rect.top + GAP}px` : "auto";
    s.maxHeight = `${Math.min(MAX_HEIGHT, up ? above : below)}px`;
    s.left = `${rect.left}px`;
    s.right = "auto";
    s.maxWidth = `${vw - rect.left - EDGE}px`;
    panel.dataset.side = up ? "top" : "bottom";
  };

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const shown = panel.matches(":popover-open");
    if (open) {
      place();
      if (!shown) panel.showPopover();
    } else if (shown) {
      panel.hidePopover();
    }
  });

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener("scroll", onMove, { capture: true, passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, { capture: true });
      window.removeEventListener("resize", onMove);
    };
  });

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [autoFocus]);

  useEffect(() => {
    if (!open || !scrollToActive.current) return;
    scrollToActive.current = false;
    document.getElementById(rowId(active))?.scrollIntoView({ block: "nearest" });
  });

  const highlight = (index: number) => {
    scrollToActive.current = true;
    setActive(index);
  };

  const show = () => {
    if (open) return;
    setOpen(true);
    highlight(Math.max(rows.findIndex((row) => "option" in row && row.option.value === current), 0));
  };

  const close = () => {
    setOpen(false);
    setText(null);
    setActive(-1);
  };

  const choose = (option: SelectOption) => {
    if (value === undefined) setInner(option.value);
    setPicked(option);
    setError(null);
    close();
    onChange?.(option.value, option);
  };

  const pick = async (row: Row | undefined) => {
    if (!row || creating) return;
    if ("option" in row) return choose(row.option);
    if (!onCreate) return;
    setCreating(true);
    const result = await onCreate(row.create);
    setCreating(false);
    if (result.option) choose(result.option);
    else setError(result.error ?? "Couldn't add that. Try again.");
  };

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    setError(null);
    setOpen(true);
    highlight(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = rows.length - 1;
    switch (event.key) {
      case "ArrowDown":
        if (!open) show();
        else highlight(active >= last ? 0 : active + 1);
        break;
      case "ArrowUp":
        if (!open) show();
        else highlight(active <= 0 ? last : active - 1);
        break;
      case "Enter":
        if (!open) return;
        void pick(rows[active]);
        break;
      case "Escape":
        if (onCancel) onCancel();
        else if (open) close();
        else return;
        event.stopPropagation();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onInputBlur = () => {
    if (text !== null && !text.trim() && !creating) {
      const empty = options.find((option) => !option.value);
      if (empty && current) choose(empty);
    }
    close();
    onBlur?.();
  };

  const inputClass = inputClassName ?? [styles.input, size === "sm" && styles.sm].filter(Boolean).join(" ");

  return (
    <div className={className ? `${styles.root} ${className}` : styles.root}>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        className={inputClass}
        value={shownText}
        placeholder={placeholder}
        readOnly={creating}
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={panelId}
        aria-activedescendant={open && active >= 0 && rows[active] ? rowId(active) : undefined}
        aria-labelledby={labelledBy}
        aria-describedby={[describedBy, error && errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={invalid || error ? true : undefined}
        aria-busy={creating || undefined}
        onChange={onInput}
        onKeyDown={onKeyDown}
        onClick={show}
        onBlur={onInputBlur}
      />
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <div ref={panelRef} id={panelId} className={styles.panel} popover="manual" role="listbox" aria-labelledby={labelledBy}>
        {rows.map((row, index) => (
          <div
            key={"option" in row ? row.option.value : "create"}
            id={rowId(index)}
            className={styles.option}
            role="option"
            aria-selected={"option" in row && row.option.value === current}
            data-active={index === active || undefined}
            data-create={"create" in row || undefined}
            // Keeps focus in the input, whose blur would close the list before the click lands.
            onPointerDown={(event) => event.preventDefault()}
            onPointerMove={() => {
              if (index !== active) setActive(index);
            }}
            onClick={() => void pick(row)}
          >
            {"option" in row ? (
              <>
                <svg className={styles.check} viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
                <span className={styles.label}>{row.option.label}</span>
              </>
            ) : (
              <>
                <svg className={styles.plus} viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 3.5v9M3.5 8h9" />
                </svg>
                <span className={styles.label}>{creating ? `Adding “${row.create}”…` : `Add “${row.create}”`}</span>
              </>
            )}
          </div>
        ))}
        {more > 0 ? <div className={styles.note}>{more} more — keep typing to narrow</div> : null}
        {rows.length === 0 ? <div className={styles.note}>No matches</div> : null}
      </div>
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
