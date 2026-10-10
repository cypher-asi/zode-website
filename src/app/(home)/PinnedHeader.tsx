"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import styles from "./PinnedHeader.module.css";

type Tone = "light" | "dark";

const ACTION_MENU = [
  { id: "buy", label: "Buy Compute", href: "/buy-compute" },
  { id: "rent", label: "Rent Compute", href: "/rent-compute" },
  { id: "give", label: "Give Compute", href: "/give-compute" },
  { id: "meet", label: "Schedule Meeting", href: "/contact" },
] as const;

/** Content is fully transparent this far below the wordmark and button... */
const FADE_GAP = 8;
/** ...and fully opaque again this much further down. */
const FADE_LENGTH = 64;
/** The faded corners reach this far toward the middle past the wordmark and button... */
const SIDE_PAD = 24;
/** ...and blend back to opaque over this much more. */
const SIDE_FEATHER = 64;

/** Surface tone (`data-surface`) of whatever sits under the center of `el`. */
function sampleTone(el: HTMLElement): Tone | null {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  for (const node of document.elementsFromPoint(x, y)) {
    if (el.contains(node)) continue;
    const surface = node.closest<HTMLElement>("[data-surface]")?.dataset.surface;
    if (surface === "light" || surface === "dark") return surface;
  }
  return null;
}

/** Whether `el` sits over photography (`data-media`), whose tone varies shot to shot. */
function overMedia(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  return document
    .elementsFromPoint(x, y)
    .some((node) => !el.contains(node) && node.closest("[data-media]") !== null);
}

/**
 * Top-left wordmark and top-right "Buy Compute" split button that stay fixed
 * while the page scrolls. The button's chevron opens a menu of other actions. Each is black over light surfaces and white over dark ones:
 * it reads the nearest `data-surface` ancestor of whatever sits under its
 * center point. Content marked with `data-top-fade` is masked out as it scrolls
 * up into the top corners, while the top middle stays solid. `data-top-fade`
 * set to "left" or "right" limits the fade to that corner (the hero gallery
 * starts under the button, so it only fades under the wordmark). Section
 * backgrounds stay unmarked so the surface behind both remains solid.
 */
export function PinnedHeader({
  showAction = true,
}: {
  /** Set false to leave out the top-right action, e.g. on the page it links to. */
  showAction?: boolean;
}): ReactElement {
  const brandRef = useRef<HTMLAnchorElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [brandTone, setBrandTone] = useState<Tone>("light");
  const [actionTone, setActionTone] = useState<Tone>("light");
  const [actionOverMedia, setActionOverMedia] = useState(false);
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (actionRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /** Moves focus between the menu items with the arrow keys, wrapping at the ends. */
  const onMenuKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]"));
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = at === -1 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length;
    event.preventDefault();
    items[next]?.focus();
  };

  const onToggleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    if (open) {
      menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    } else {
      setOpen(true);
      requestAnimationFrame(() =>
        menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus(),
      );
    }
  };

  useEffect(() => {
    let frame = 0;

    const sample = () => {
      frame = 0;
      const brand = brandRef.current;
      const action = actionRef.current;
      if (!brand) return;
      const brandRect = brand.getBoundingClientRect();
      const actionRect = action?.getBoundingClientRect();

      const clear = Math.max(brandRect.bottom, actionRect?.bottom ?? 0) + FADE_GAP;
      const solid = clear + FADE_LENGTH;
      const leftEdge = brandRect.right + SIDE_PAD;
      const rightEdge = actionRect ? actionRect.left - SIDE_PAD : Infinity;
      for (const node of document.querySelectorAll<HTMLElement>("[data-top-fade]")) {
        const { top, left, right } = node.getBoundingClientRect();
        const sides = node.dataset.topFade;
        const fadeLeft = sides !== "right" && left < leftEdge;
        const fadeRight = sides !== "left" && right > rightEdge;
        if (solid - top <= 0 || (!fadeLeft && !fadeRight)) {
          node.style.maskImage = "";
          continue;
        }

        const vertical = `linear-gradient(to bottom, transparent ${clear - top}px, #000 ${solid - top}px)`;
        // On narrow screens the two corners meet, so the whole top band fades.
        if (fadeLeft && fadeRight && rightEdge - leftEdge < 2 * SIDE_FEATHER) {
          node.style.maskImage = vertical;
          continue;
        }
        const stops = [
          ...(fadeLeft
            ? [`transparent ${leftEdge - left}px`, `#000 ${leftEdge - left + SIDE_FEATHER}px`]
            : ["#000 0px"]),
          ...(fadeRight
            ? [`#000 ${rightEdge - left - SIDE_FEATHER}px`, `transparent ${rightEdge - left}px`]
            : ["#000 100%"]),
        ];
        // Mask layers composite with `add`, so content hides only in the top band at the sides.
        node.style.maskImage = `${vertical}, linear-gradient(to right, ${stops.join(", ")})`;
      }

      const nextBrandTone = sampleTone(brand);
      if (nextBrandTone) setBrandTone(nextBrandTone);
      if (action) {
        const nextActionTone = sampleTone(action);
        if (nextActionTone) setActionTone(nextActionTone);
        setActionOverMedia(overMedia(action));
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sample);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [showAction]);

  return (
    <>
      <Link
        ref={brandRef}
        className={styles.brand}
        href="/"
        aria-label="ZODE — home"
        data-tone={brandTone}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.wordmark} src="/wordmark.png" alt="" aria-hidden="true" />
      </Link>
      {showAction ? (
        <div
          className={styles.action}
          data-tone={actionTone}
          data-media={actionOverMedia || undefined}
          data-open={open || undefined}
        >
          <div ref={actionRef} className={styles.split}>
            <Link className={styles.primary} href="/buy-compute">
              Buy Compute
            </Link>
            <button
              ref={toggleRef}
              type="button"
              className={styles.toggle}
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={menuId}
              onClick={() => setOpen((value) => !value)}
              onKeyDown={onToggleKey}
            >
              <svg className={styles.chevron} viewBox="0 0 10 6" aria-hidden="true">
                <path d="M1 1l4 4 4-4" />
              </svg>
            </button>
          </div>
          {open && (
            <ul
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="Get started"
              className={styles.menu}
              onKeyDown={onMenuKey}
            >
              {ACTION_MENU.map((item) => (
                <li key={item.id} role="none">
                  <Link
                    role="menuitem"
                    className={styles.menuItem}
                    href={item.href}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </>
  );
}
