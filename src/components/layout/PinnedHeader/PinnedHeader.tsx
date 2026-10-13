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
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";
import { markSignedIn, readSignedInCookie } from "@/features/account/signedInCookie";
import { isPortalPath, useAccountInitials, useLogout, useLogoutToast } from "@/features/account/useAccount";
import { COMPUTE_ACTIONS, ENGINEER_ACTION, RESOURCE_LINKS, TOOL_LINKS } from "@/lib/navigation";
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

/** Menu rows that open a flyout of links, in menu order. */
const SUBMENUS = [
  { id: "tools", label: "Tools", links: TOOL_LINKS },
  { id: "resources", label: "Resources", links: RESOURCE_LINKS },
] as const;

type SubmenuId = (typeof SUBMENUS)[number]["id"];

/** How long a flyout lingers after the mouse leaves, so it can cut diagonally across into it. */
const SUBMENU_CLOSE_DELAY = 150;
/** Closest a flyout comes to the viewport's left edge on narrow screens, overlapping the menu instead. */
const SUBMENU_VIEWPORT_GAP = 8;

/** Moves focus among `items` by `step`, wrapping at the ends. */
function focusStep(items: readonly HTMLElement[], step: number): void {
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = at === -1 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length;
  items[next]?.focus();
}

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
/** A cover's mask while nothing sits under the corners. */
const COVER_HIDDEN = "linear-gradient(transparent, transparent)";

/** The fade band under the wordmark and button, in viewport pixels. */
type FadeBand = { clear: number; solid: number; leftEdge: number; rightEdge: number };

/**
 * The mask fading content at `rect` out of the top corners, or for a cover the
 * inverse, showing it only there. `null` when the node sits clear of them.
 */
function topFadeMask(
  { top, left, right }: DOMRect,
  sides: string | undefined,
  cover: boolean,
  { clear, solid, leftEdge, rightEdge }: FadeBand,
): string | null {
  const fadeLeft = sides !== "right" && left < leftEdge;
  const fadeRight = sides !== "left" && right > rightEdge;
  if (solid - top <= 0 || (!fadeLeft && !fadeRight)) return null;

  const [hidden, shown] = cover ? ["#000", "transparent"] : ["transparent", "#000"];
  const vertical = `linear-gradient(to bottom, ${hidden} ${clear - top}px, ${shown} ${solid - top}px)`;
  // On narrow screens the two corners meet, so the whole top band fades.
  if (fadeLeft && fadeRight && rightEdge - leftEdge < 2 * SIDE_FEATHER) return vertical;
  const stops = [
    ...(fadeLeft
      ? [`${hidden} ${leftEdge - left}px`, `${shown} ${leftEdge - left + SIDE_FEATHER}px`]
      : [`${shown} 0px`]),
    ...(fadeRight
      ? [`${shown} ${rightEdge - left - SIDE_FEATHER}px`, `${hidden} ${rightEdge - left}px`]
      : [`${shown} 100%`]),
  ];
  // Content's layers composite with `add`, hiding it only in the top band at the sides; a cover's must `intersect`.
  return `${vertical}, linear-gradient(to right, ${stops.join(", ")})`;
}

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
 *
 * Masking content means rewriting its mask as it scrolls, a frame behind the
 * scroll itself. Over a plain surface, a `data-top-fade-cover` does the same
 * job without that lag: a sticky band of the surface colour (with
 * `mask-composite: intersect`) that's masked down to just the corners.
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
  const submenuRowRefs = useRef<Partial<Record<SubmenuId, HTMLButtonElement | null>>>({});
  const flyoutRefs = useRef<Partial<Record<SubmenuId, HTMLUListElement | null>>>({});
  const submenuTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [brandTone, setBrandTone] = useState<Tone>("light");
  const [actionTone, setActionTone] = useState<Tone>("light");
  const [actionOverMedia, setActionOverMedia] = useState(false);
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<SubmenuId | null>(null);
  const accountInitials = useAccountInitials();
  const signedIn = accountInitials !== null;
  const inPortal = isPortalPath(pathname ?? "/");
  const menu = inPortal ? PORTAL_ACTION_MENU : ACTION_MENU;
  /** The route this header mounted on, cleared by the first route change after. */
  const [mountPath, setMountPath] = useState<string | null>(pathname);
  if (mountPath !== null && mountPath !== pathname) setMountPath(null);
  /**
   * Whether the wordmark and button carry their shared transition names. The
   * portal's header stays put across its routes, so there they only join the
   * navigation that mounts it; past that each route change would sit through
   * the whole morph for nothing.
   */
  const morph = !inPortal || mountPath !== null;
  const { logOut, pending: loggingOut } = useLogout();
  const menuId = useId();
  const flyoutIdPrefix = useId();

  /** Closes the menu along with any open flyout, so it reopens collapsed. */
  const closeMenu = () => {
    clearTimeout(submenuTimer.current);
    setOpen(false);
    setSubmenu(null);
  };

  /**
   * Keeps the avatar's `<html>` flags in step after signing in or out. Reads
   * the cookie rather than `accountInitials`, which is still `null` while
   * hydrating; also restores the flags after the dev Strict Mode remount resets `<html>`.
   */
  useLayoutEffect(() => {
    markSignedIn(readSignedInCookie(document.cookie));
  }, [accountInitials]);

  /** Shifts the open flyout right by however far it would run off the left edge, written to `--shift`. */
  useLayoutEffect(() => {
    const flyout = submenu ? flyoutRefs.current[submenu] : null;
    if (!flyout) return;
    flyout.style.removeProperty("--shift");
    const overflow = SUBMENU_VIEWPORT_GAP - flyout.getBoundingClientRect().left;
    if (overflow > 0) flyout.style.setProperty("--shift", `${Math.ceil(overflow)}px`);
  }, [submenu]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (actionRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      clearTimeout(submenuTimer.current);
      setOpen(false);
      setSubmenu(null);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      // A flyout handles its own Escape, closing just itself.
      if (event.key !== "Escape" || event.defaultPrevented) return;
      clearTimeout(submenuTimer.current);
      setOpen(false);
      setSubmenu(null);
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

  /** Moves focus between the menu's own items (not the flyout's) with the arrow keys, wrapping at the ends. */
  const onMenuKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    focusStep(
      Array.from(event.currentTarget.querySelectorAll<HTMLElement>(":scope > li > [role=menuitem]")),
      step,
    );
  };

  const onToggleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    const focusFirst = () =>
      menuRef.current?.querySelector<HTMLElement>(":scope > li > [role=menuitem]")?.focus();
    if (open) {
      focusFirst();
    } else {
      setOpen(true);
      setSubmenu(null);
      requestAnimationFrame(focusFirst);
    }
  };

  /** Whether flyouts expand in place inside the menu (phones), where hovering shouldn't open them. */
  const submenuInline = (id: SubmenuId) => {
    const flyout = flyoutRefs.current[id];
    return flyout != null && getComputedStyle(flyout).position === "static";
  };

  /** Opens a flyout and moves focus to its first link. */
  const enterSubmenu = (id: SubmenuId) => {
    clearTimeout(submenuTimer.current);
    setSubmenu(id);
    requestAnimationFrame(() =>
      flyoutRefs.current[id]?.querySelector<HTMLElement>("[role=menuitem]")?.focus(),
    );
  };

  /** Closes a flyout and hands focus back to its row. */
  const leaveSubmenu = (id: SubmenuId) => {
    clearTimeout(submenuTimer.current);
    setSubmenu(null);
    submenuRowRefs.current[id]?.focus();
  };

  const onSubmenuRowKey = (id: SubmenuId, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft") return;
    event.preventDefault();
    enterSubmenu(id);
  };

  /**
   * Keyboard clicks (`detail` 0) enter the flyout, mouse clicks keep it open
   * after hovering, taps (and any click where it expands in place) toggle it.
   */
  const onSubmenuClick = (id: SubmenuId, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) {
      enterSubmenu(id);
    } else if ((event.nativeEvent as PointerEvent).pointerType === "mouse" && !submenuInline(id)) {
      clearTimeout(submenuTimer.current);
      setSubmenu(id);
    } else {
      setSubmenu((value) => (value === id ? null : id));
    }
  };

  /**
   * Arrows move within the flyout; Escape or ArrowRight return to its row.
   * Stops propagation so the outer menu's arrow handling stays out of it, and
   * Escape is marked handled so the document listener leaves the menu open.
   */
  const onFlyoutKey = (id: SubmenuId, event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === "Escape" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      leaveSubmenu(id);
      return;
    }
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    focusStep(Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")), step);
  };

  /**
   * Swapping out another open flyout waits the close delay too, so cutting
   * diagonally down into a tall flyout across the next row doesn't swap it.
   */
  const onSubmenuEnter = (id: SubmenuId, event: ReactPointerEvent<HTMLLIElement>) => {
    if (event.pointerType !== "mouse" || submenuInline(id)) return;
    clearTimeout(submenuTimer.current);
    if (submenu === null || submenu === id) setSubmenu(id);
    else submenuTimer.current = setTimeout(() => setSubmenu(id), SUBMENU_CLOSE_DELAY);
  };

  const onSubmenuLeave = (id: SubmenuId, event: ReactPointerEvent<HTMLLIElement>) => {
    if (event.pointerType !== "mouse" || submenuInline(id)) return;
    clearTimeout(submenuTimer.current);
    submenuTimer.current = setTimeout(() => setSubmenu(null), SUBMENU_CLOSE_DELAY);
  };

  useEffect(() => {
    // The portal's panel is fixed and light under both, with nothing to fade, so the default tones hold.
    if (inPortal) return;
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
      // Covers are pinned to the top, so they're always measured; their masks only change on resize.
      const covers = Array.from(
        document.querySelectorAll<HTMLElement>("[data-top-fade-cover]"),
        (node) => [node, node.getBoundingClientRect()] as const,
      );
      const brandUnder = sampleUnder(brand, brandRect);
      const actionUnder = action && actionRect ? sampleUnder(action, actionRect) : null;

      const clear = Math.max(brandRect.bottom, actionRect?.bottom ?? 0) + FADE_GAP;
      const band: FadeBand = {
        clear,
        solid: clear + FADE_LENGTH,
        leftEdge: brandRect.right + SIDE_PAD,
        rightEdge: actionRect ? actionRect.left - SIDE_PAD : Infinity,
      };
      for (const [node, rect] of measured) {
        setMask(node, topFadeMask(rect, node.dataset.topFade, false, band) ?? "");
      }
      for (const [node, rect] of covers) {
        setMask(node, topFadeMask(rect, undefined, true, band) ?? COVER_HIDDEN);
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
    // Surfaces can also change tone in place, e.g. the deck's ground between slides.
    const surfaces = new MutationObserver(schedule);
    surfaces.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-surface"] });
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      surfaces.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [showAction, inPortal]);

  return (
    <>
      {/* Pages set their own `--edge`, so the wordmark sits at a different spot on
          each; the shared name slides it across instead of jumping. */}
      <ViewTransition name={morph ? "zode-wordmark" : undefined} share="auto" default="none">
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
          data-portal={inPortal || undefined}
          // Joins the wordmark's route transition, so it slides across too. Set here because CSS Modules would hash the name.
          style={morph ? { viewTransitionName: "zode-action" } : undefined}
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
                onClick={() => (open ? closeMenu() : setOpen(true))}
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
                    onClick={closeMenu}
                  >
                    <TypedLabel text={item.label} index={i} />
                  </Link>
                </li>
              ))}
              <li role="separator" className={styles.separator} />
              {SUBMENUS.map((sub, s) => {
                const index = menu.length + s;
                const flyoutId = `${flyoutIdPrefix}-${sub.id}`;
                const expanded = submenu === sub.id;
                return (
                  <li
                    key={sub.id}
                    role="none"
                    className={styles.submenuRow}
                    onPointerEnter={(event) => onSubmenuEnter(sub.id, event)}
                    onPointerLeave={(event) => onSubmenuLeave(sub.id, event)}
                  >
                    <button
                      ref={(node) => {
                        submenuRowRefs.current[sub.id] = node;
                      }}
                      type="button"
                      role="menuitem"
                      className={styles.menuItem}
                      aria-haspopup="menu"
                      aria-expanded={expanded}
                      aria-controls={flyoutId}
                      style={{ "--i": index } as CSSProperties}
                      onClick={(event) => onSubmenuClick(sub.id, event)}
                      onKeyDown={(event) => onSubmenuRowKey(sub.id, event)}
                    >
                      <svg className={styles.submenuIcon} viewBox="0 0 6 10" aria-hidden="true">
                        <path d="M5 1L1 5l4 4" />
                      </svg>
                      <TypedLabel text={sub.label} index={index} />
                    </button>
                    <ul
                      ref={(node) => {
                        flyoutRefs.current[sub.id] = node;
                      }}
                      id={flyoutId}
                      role="menu"
                      aria-label={sub.label}
                      className={styles.submenu}
                      data-open={expanded || undefined}
                      onKeyDown={(event) => onFlyoutKey(sub.id, event)}
                    >
                      {sub.links.map((link, i) => (
                        <li key={link.label} role="none">
                          {link.external ? (
                            <a
                              role="menuitem"
                              className={styles.menuItem}
                              href={link.href}
                              target="_blank"
                              rel="noreferrer noopener"
                              onClick={closeMenu}
                            >
                              <TypedLabel text={link.label} index={i} />
                            </a>
                          ) : (
                            <Link role="menuitem" className={styles.menuItem} href={link.href} onClick={closeMenu}>
                              <TypedLabel text={link.label} index={i} />
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
              <li role="separator" className={styles.separator} />
              {signedIn ? (
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuItem}
                    disabled={loggingOut}
                    onClick={() => logOut(closeMenu)}
                  >
                    <TypedLabel
                      text={loggingOut ? "Logging out…" : "Logout"}
                      index={menu.length + SUBMENUS.length}
                    />
                  </button>
                </li>
              ) : (
                SIGNED_OUT_MENU.map((item, i) => (
                  <li key={item.id} role="none">
                    <Link
                      role="menuitem"
                      className={styles.menuItem}
                      href={item.href}
                      onClick={closeMenu}
                    >
                      <TypedLabel text={item.label} index={menu.length + SUBMENUS.length + i} />
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
