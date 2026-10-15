"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import ui from "@/features/data-room/ui.module.css";
import type { PlaceAddress, PlaceSuggestion } from "./types";
import styles from "./deployments.module.css";

const SEARCH_DELAY_MS = 250;
const MIN_QUERY = 3;
const GAP = 4;
const EDGE = 8;
const MAX_LIST_HEIGHT = 300;

/** Puts the suggestions under the address field, or above it when there's more room there. */
function placeList(field: HTMLElement, list: HTMLElement): void {
  const rect = field.getBoundingClientRect();
  const vh = document.documentElement.clientHeight;
  const below = vh - rect.bottom - GAP - EDGE;
  const above = rect.top - GAP - EDGE;
  const up = below < 160 && above > below;
  const s = list.style;
  s.left = `${rect.left}px`;
  s.width = `${rect.width}px`;
  s.top = up ? "auto" : `${rect.bottom + GAP}px`;
  s.bottom = up ? `${vh - rect.top + GAP}px` : "auto";
  s.maxHeight = `${Math.min(MAX_LIST_HEIGHT, up ? above : below)}px`;
  list.dataset.side = up ? "top" : "bottom";
}

interface AddressFieldProps {
  address: string | null;
  city: string | null;
  placeId: string | null;
  label?: string;
}

/**
 * The data center address, picked from Google's suggestions, and its city,
 * which fills in from the picked place. Typing over a picked address clears
 * the city; without the Places key, or for accounts outside the ZODE team,
 * the address is typed by hand.
 */
export function AddressField(props: AddressFieldProps): ReactElement {
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const fieldRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const session = useRef<string | null>(null);

  const [text, setText] = useState(props.address ?? "");
  const [place, setPlace] = useState<Pick<PlaceAddress, "placeId" | "city"> | null>(
    props.placeId ? { placeId: props.placeId, city: props.city } : null,
  );
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = text.trim();
  const searching = !place && !unavailable && query.length >= MIN_QUERY;
  const suggestions = searching ? results : [];
  const listOpen = focused && !dismissed && suggestions.length > 0;
  const activeIndex = active < suggestions.length ? active : -1;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      session.current ??= crypto.randomUUID();
      try {
        const res = await fetch(
          `/api/places?q=${encodeURIComponent(query)}&session=${encodeURIComponent(session.current)}`,
          { signal: controller.signal },
        );
        if (res.status === 503 || res.status === 404) setUnavailable(true);
        else if (res.ok) setResults((await res.json()) as PlaceSuggestion[]);
      } catch {
        // Aborted by the next keystroke, or offline; the last suggestions stay.
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searching, query]);

  // The list sits in the top layer so the form's scrolling can't clip it; it's placed under the field each render.
  useLayoutEffect(() => {
    const list = listRef.current;
    const field = fieldRef.current;
    if (!list || !field) return;
    if (!listOpen) {
      if (list.matches(":popover-open")) list.hidePopover();
      return;
    }
    placeList(field, list);
    if (!list.matches(":popover-open")) list.showPopover();
    if (activeIndex >= 0) document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
  });

  useEffect(() => {
    if (!listOpen) return;
    const follow = () => {
      if (fieldRef.current && listRef.current) placeList(fieldRef.current, listRef.current);
    };
    window.addEventListener("scroll", follow, { capture: true, passive: true });
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, { capture: true });
      window.removeEventListener("resize", follow);
    };
  }, [listOpen]);

  const pick = async (suggestion: PlaceSuggestion) => {
    const token = session.current ?? crypto.randomUUID();
    session.current = null;
    setText([suggestion.main, suggestion.secondary].filter(Boolean).join(", "));
    setPlace({ placeId: suggestion.placeId, city: null });
    setResults([]);
    setActive(-1);
    setError(null);
    try {
      const res = await fetch(
        `/api/places/${encodeURIComponent(suggestion.placeId)}?session=${encodeURIComponent(token)}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const picked = (await res.json()) as PlaceAddress;
      setText(picked.address);
      setPlace({ placeId: picked.placeId, city: picked.city });
    } catch {
      setPlace(null);
      setError("That address couldn't be looked up. Pick it again, or type it in full.");
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = suggestions.length - 1;
    switch (event.key) {
      case "ArrowDown":
        if (!suggestions.length) return;
        setDismissed(false);
        setActive(activeIndex >= last ? 0 : activeIndex + 1);
        break;
      case "ArrowUp":
        if (!suggestions.length) return;
        setDismissed(false);
        setActive(activeIndex <= 0 ? last : activeIndex - 1);
        break;
      case "Escape":
        if (!listOpen) return;
        setDismissed(true);
        setActive(-1);
        break;
      case "Enter":
        // Picks rather than submitting the form while the list is open.
        if (!listOpen) return;
        void pick(suggestions[Math.max(activeIndex, 0)]);
        break;
      case "Tab":
        if (!listOpen || activeIndex < 0) return;
        void pick(suggestions[activeIndex]);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div className={styles.addressRow} data-wide="">
      <div className={ui.field}>
        <label htmlFor={`${id}-address`} className={ui.label}>
          {props.label ?? "Data center address"}
        </label>
        <input
          ref={fieldRef}
          id={`${id}-address`}
          name="address"
          className={ui.input}
          value={text}
          maxLength={500}
          placeholder={unavailable ? "Street, city, region" : "Search for an address"}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-activedescendant={listOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setPlace(null);
            setDismissed(false);
            setActive(-1);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <input type="hidden" name="place_id" value={place?.placeId ?? ""} />
        <ul
          ref={listRef}
          id={listId}
          className={styles.suggestions}
          popover="manual"
          role="listbox"
          aria-label="Addresses"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.placeId}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              className={styles.suggestion}
              data-active={index === activeIndex || undefined}
              onPointerMove={() => {
                if (index !== activeIndex) setActive(index);
              }}
              // Keeps focus in the field, so the list doesn't close before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void pick(suggestion)}
            >
              <span className={styles.suggestionMain}>{suggestion.main}</span>
              {suggestion.secondary ? <span className={styles.suggestionSecondary}>{suggestion.secondary}</span> : null}
            </li>
          ))}
          <li className={styles.attribution} aria-hidden="true">
            Powered by Google
          </li>
        </ul>
        {error ? <p className={ui.error}>{error}</p> : null}
        {unavailable && !error ? (
          <p className={styles.hint}>Address search isn&apos;t set up here, so type the address in full.</p>
        ) : null}
      </div>
      <div className={ui.field}>
        <label htmlFor={`${id}-city`} className={ui.label}>
          City
        </label>
        <input
          id={`${id}-city`}
          name="city"
          className={ui.input}
          value={place?.city ?? ""}
          placeholder="From the address"
          readOnly
          tabIndex={-1}
        />
      </div>
    </div>
  );
}
