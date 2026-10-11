"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  ViewTransition,
  type KeyboardEvent,
  type ReactElement,
} from "react";
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
  const avatarRef = useRef<HTMLAnchorElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [brandTone, setBrandTone] = useState<Tone>("light");
  const [actionTone, setActionTone] = useState<Tone>("light");
  const [actionOverMedia, setActionOverMedia] = useState(false);
  const [open, setOpen] = useState(false);
  const accountInitials = useAccountInitials();
  const signedIn = accountInitials !== null;
  const inPortal = isPortalPath(pathname ?? "/");
  // The portal page already shows who you are, so the avatar only appears on the public site.
  const showAvatar = showAction && signedIn && !inPortal;
  const menu = inPortal ? PORTAL_ACTION_MENU : ACTION_MENU;
  const { logOut, pending: loggingOut } = useLogout();
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
      const avatarRect = avatarRef.current?.getBoundingClientRect();
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
      const rightEdge = actionRect ? (avatarRect ?? actionRect).left - SIDE_PAD : Infinity;
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
  }, [showAction, showAvatar]);

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
          {showAvatar ? (
            <Link ref={avatarRef} className={styles.avatar} href="/portal" aria-label="Your portal">
              {accountInitials || (
                <svg className={styles.avatarGlyph} viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="5.5" r="2.75" />
                  <path d="M2.75 14c.6-2.9 2.7-4.5 5.25-4.5s4.65 1.6 5.25 4.5" />
                </svg>
              )}
            </Link>
          ) : null}
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
              {menu.map((item) => (
                <li key={item.id} role="none">
                  <Link
                    role="menuitem"
                    className={styles.menuItem}
                    href={item.href}
                    scroll={"scroll" in item ? item.scroll : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
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
                    {loggingOut ? "Logging out…" : "Logout"}
                  </button>
                </li>
              ) : (
                SIGNED_OUT_MENU.map((item) => (
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
                ))
              )}
            </ul>
          )}
        </div>
      ) : null}
      <LogoutNotice />
    </>
  );
}
