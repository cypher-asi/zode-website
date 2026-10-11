"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  ViewTransition,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { markSignedIn, readSignedInCookie } from "@/features/account/signedInCookie";
import { isPortalPath, useAccountInitials, useLogout, useLogoutToast } from "@/features/account/useAccount";
import { COMPUTE_ACTIONS, ENGINEER_ACTION } from "@/lib/navigation";
import styles from "./PinnedHeader.module.css";

type Tone = "light" | "dark";

const ACTION_MENU = [
  ...COMPUTE_ACTIONS,
  ENGINEER_ACTION,
];

/** In the portal the menu leads back to the public site first. */
const PORTAL_ACTION_MENU = [
  { id: "home", label: "Home", href: "/" },
  ...ACTION_MENU,
];

const SIGNED_OUT_MENU = [
  { id: "login", label: "Login", href: "/login" },
  { id: "register", label: "Register", href: "/register" },
];

/** Bottom-centre notice after logging out, fading in and out. */
function LogoutNotice(): ReactElement | null {
  const toast = useLogoutToast();
  if (toast === "hidden") return null;
  return (
    <p className={styles.notice} role="status" data-leaving={toast === "leaving" || undefined}>
      You&apos;re logged out
    </p>
  );
}

/**
 * A menu row's label, typed in behind a block cursor like the footer menu's
 * lines once the menu has unrolled; `index` staggers it after the rows above.
 */
function TypedLabel({ text, index }: { text: string; index: number }): ReactElement {
  return (
    <span className={styles.line} style={{ "--i": index, "--chars": text.length } as CSSProperties}>
      <span className={styles.text}>{text}</span>
      <span className={styles.cursor} aria-hidden="true" />
    </span>
  );
}

/** Content is fully transparent this far below the wordmark and button... */
const FADE_GAP = 8;
/** ...and fully opaque again this much further down. */
const FADE_LENGTH = 64;
/** The faded corners reach this far toward the middle past the wordmark and button... */
const SIDE_PAD = 24;
/** ...and blend back to opaque over this much more. */
const SIDE_FEATHER = 64;

/**
 * What sits under the center of `el`: the surface tone (`data-surface`) and
 * whether it's photography (`data-media`), whose tone varies shot to shot.
 */
function sampleUnder(el: HTMLElement, rect: DOMRect): { tone: Tone | null; media: boolean } {
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  let tone: Tone | null = null;
  let media = false;
  for (const node of document.elementsFromPoint(x, y)) {
    if (el.contains(node)) continue;
    if (!media && node.closest("[data-media]")) media = true;
    if (!tone) {
      const surface = node.closest<HTMLElement>("[data-surface]")?.dataset.surface;
      if (surface === "light" || surface === "dark") tone = surface;
    }
    if (tone && media) break;
  }
  return { tone, media };
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
  const pathname = usePathname();
  const brandRef = useRef<HTMLAnchorElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const growRef = useRef<HTMLSpanElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [brandTone, setBrandTone] = useState<Tone>("light");
  const [actionTone, setActionTone] = useState<Tone>("light");
  const [actionOverMedia, setActionOverMedia] = useState(false);
  const [open, setOpen] = useState(false);
  const accountInitials = useAccountInitials();
  const signedIn = accountInitials !== null;
  const inPortal = isPortalPath(pathname ?? "/");
  const menu = inPortal ? PORTAL_ACTION_MENU : ACTION_MENU;
  const { logOut, pending: loggingOut } = useLogout();
  const menuId = useId();

  /**
   * Keeps the avatar's `<html>` flags in step after signing in or out. Reads
   * the cookie rather than `accountInitials`, which is still `null` while
   * hydrating; also restores the flags after the dev Strict Mode remount resets `<html>`.
   */
  useLayoutEffect(() => {
    markSignedIn(readSignedInCookie(document.cookie));
  }, [accountInitials]);

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

  /**
   * How much the split button has to widen to match the menu below it, written
   * to `--grow` on the anchor. The button's resting width excludes the spacer,
   * so it reads the same mid-animation.
   */
  useEffect(() => {
    const anchor = anchorRef.current;
    const split = actionRef.current;
    const grow = growRef.current;
    const list = menuRef.current;
    if (!anchor || !split || !grow || !list) return;

    const measure = () => {
      const resting = split.getBoundingClientRect().width - grow.getBoundingClientRect().width;
      const extra = Math.max(0, list.getBoundingClientRect().width - resting);
      anchor.style.setProperty("--grow", `${extra}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(split);
    observer.observe(list);
    return () => observer.disconnect();
  }, [showAction]);

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
    // Faded nodes near the top of the viewport. Only these are measured each
    // frame; the margins are generous so a node is tracked well before it
    // reaches the fade band, even on a fast fling.
    const observed = new WeakSet<HTMLElement>();
    const near = new Set<HTMLElement>();
    // Last mask written per node, so unchanged masks aren't rewritten (each write repaints the node).
    const masks = new WeakMap<HTMLElement, string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const node = entry.target as HTMLElement;
          if (entry.isIntersecting) near.add(node);
          else near.delete(node);
        }
        schedule();
      },
      { rootMargin: "50% 0px -25% 0px" },
    );

    const setMask = (node: HTMLElement, mask: string) => {
      if (masks.get(node) === mask) return;
      masks.set(node, mask);
      node.style.maskImage = mask;
    };

    const sample = () => {
      frame = 0;
      const brand = brandRef.current;
      const action = actionRef.current;
      if (!brand) return;

      // Reads first: interleaving them with the mask writes below would force a style recalc per node.
      const brandRect = brand.getBoundingClientRect();
      const actionRect = action?.getBoundingClientRect();
      const measured: [HTMLElement, DOMRect][] = [];
      // Re-queried every frame because sections such as the assembly line mount late.
      for (const node of document.querySelectorAll<HTMLElement>("[data-top-fade]")) {
        if (!observed.has(node)) {
          // Treated as near until the observer's first report says otherwise.
          observed.add(node);
          near.add(node);
          io.observe(node);
        }
        if (near.has(node)) {
          measured.push([node, node.getBoundingClientRect()]);
        } else {
          setMask(node, "");
        }
      }
      const brandUnder = sampleUnder(brand, brandRect);
      const actionUnder = action && actionRect ? sampleUnder(action, actionRect) : null;

      const clear = Math.max(brandRect.bottom, actionRect?.bottom ?? 0) + FADE_GAP;
      const solid = clear + FADE_LENGTH;
      const leftEdge = brandRect.right + SIDE_PAD;
      const rightEdge = actionRect ? actionRect.left - SIDE_PAD : Infinity;
      for (const [node, { top, left, right }] of measured) {
        const sides = node.dataset.topFade;
        const fadeLeft = sides !== "right" && left < leftEdge;
        const fadeRight = sides !== "left" && right > rightEdge;
        if (solid - top <= 0 || (!fadeLeft && !fadeRight)) {
          setMask(node, "");
          continue;
        }

        const vertical = `linear-gradient(to bottom, transparent ${clear - top}px, #000 ${solid - top}px)`;
        // On narrow screens the two corners meet, so the whole top band fades.
        if (fadeLeft && fadeRight && rightEdge - leftEdge < 2 * SIDE_FEATHER) {
          setMask(node, vertical);
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
        setMask(node, `${vertical}, linear-gradient(to right, ${stops.join(", ")})`);
      }

      if (brandUnder.tone) setBrandTone(brandUnder.tone);
      if (actionUnder) {
        if (actionUnder.tone) setActionTone(actionUnder.tone);
        setActionOverMedia(actionUnder.media);
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
      io.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [showAction]);

  return (
    <>
      {/* Pages set their own `--edge`, so the wordmark sits at a different spot on
          each; the shared name slides it across instead of jumping. */}
      <ViewTransition name="zode-wordmark" share="auto" default="none">
        <Link
          ref={brandRef}
          className={styles.brand}
          href="/"
          aria-label="ZODE — home"
          data-tone={brandTone}
          onClick={(event) => {
            if (pathname !== "/" || event.metaKey || event.ctrlKey || event.shiftKey) return;
            event.preventDefault();
            window.scrollTo({ top: 0 });
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.wordmark} src="/wordmark.png" alt="" aria-hidden="true" />
        </Link>
      </ViewTransition>
      {showAction ? (
        <div
          className={styles.action}
          data-tone={actionTone}
          data-media={actionOverMedia || undefined}
          data-open={open || undefined}
        >
          <div ref={anchorRef} className={styles.menuAnchor}>
            <div ref={actionRef} className={styles.split}>
              <Link className={styles.primary} href="/buy-compute">
                Buy Compute
                <span ref={growRef} className={styles.grow} aria-hidden="true" />
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
            <ul
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="Get started"
              className={styles.menu}
              onKeyDown={onMenuKey}
            >
              {menu.map((item, i) => (
                <li key={item.id} role="none">
                  <Link
                    role="menuitem"
                    className={styles.menuItem}
                    href={item.href}
                    scroll={"scroll" in item ? item.scroll : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <TypedLabel text={item.label} index={i} />
                  </Link>
                </li>
              ))}
              <li role="separator" className={styles.separator} />
              {signedIn ? (
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuItem}
                    disabled={loggingOut}
                    onClick={() => logOut(() => setOpen(false))}
                  >
                    <TypedLabel text={loggingOut ? "Logging out…" : "Logout"} index={menu.length} />
                  </button>
                </li>
              ) : (
                SIGNED_OUT_MENU.map((item, i) => (
                  <li key={item.id} role="none">
                    <Link
                      role="menuitem"
                      className={styles.menuItem}
                      href={item.href}
                      onClick={() => setOpen(false)}
                    >
                      <TypedLabel text={item.label} index={menu.length + i} />
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
          {/* Always rendered; CSS shows it and supplies the initials from the `<html>` flags. */}
          <Link className={styles.avatar} href="/portal" aria-label="Your portal">
            <svg className={styles.avatarGlyph} viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="5.5" r="2.75" />
              <path d="M2.75 14c.6-2.9 2.7-4.5 5.25-4.5s4.65 1.6 5.25 4.5" />
            </svg>
          </Link>
        </div>
      ) : null}
      <LogoutNotice />
    </>
  );
}
