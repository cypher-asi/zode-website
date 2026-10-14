"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";
import { markSignedIn, readSignedInCookie } from "@/features/account/signedInCookie";
import { useAccountInitials, useLogout } from "@/features/account/useAccount";
import { COMPUTE_ACTIONS, ENGINEER_ACTION, RESOURCE_LINKS, TOOL_LINKS } from "@/lib/navigation";
import { BUY_COMPUTE, type HeaderAction } from "./headerRoutes";
import styles from "./PinnedHeader.module.css";

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

/**
 * The header's split button and avatar. The button's link (`primary`) slides
 * shut where a route leaves it out, leaving the chevron, and its label
 * crossfades as the button resizes when a route swaps it. The chevron opens
 * a menu of other actions, which closes whenever the route changes.
 */
export function ActionMenu({
  primary,
  portal,
  pathname,
}: {
  primary: HeaderAction | null;
  portal: boolean;
  pathname: string;
}): ReactElement {
  const anchorRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const growRef = useRef<HTMLSpanElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const submenuRowRefs = useRef<Partial<Record<SubmenuId, HTMLButtonElement | null>>>({});
  const flyoutRefs = useRef<Partial<Record<SubmenuId, HTMLUListElement | null>>>({});
  const submenuTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<SubmenuId | null>(null);
  const accountInitials = useAccountInitials();
  const signedIn = accountInitials !== null;
  const menu = portal ? PORTAL_ACTION_MENU : ACTION_MENU;
  const { logOut, pending: loggingOut } = useLogout();
  const menuId = useId();
  const flyoutIdPrefix = useId();

  /** The link last shown, kept while the button slides shut so its label doesn't blank first. */
  const [shown, setShown] = useState<HeaderAction>(primary ?? BUY_COMPUTE);
  /** Set once a route swaps the label, so it crossfades from then on but not on the first paint. */
  const [swapped, setSwapped] = useState(false);
  if (primary && primary !== shown) {
    setShown(primary);
    if (primary.label !== shown.label) setSwapped(true);
  }

  const [openAt, setOpenAt] = useState(pathname);
  if (openAt !== pathname) {
    setOpenAt(pathname);
    setOpen(false);
    setSubmenu(null);
  }
  useEffect(() => () => clearTimeout(submenuTimer.current), [pathname]);

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
      if (splitRef.current?.contains(target) || menuRef.current?.contains(target)) return;
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
   * Two widths, written as custom properties: the link's own as
   * `--primary-w` on its slot, which eases to it as the label changes, and
   * how much the button has to widen to match the menu below it as `--grow`
   * on the anchor. The button's resting width excludes the spacer, so it
   * reads the same mid-animation.
   */
  useEffect(() => {
    const anchor = anchorRef.current;
    const split = splitRef.current;
    const slot = slotRef.current;
    const link = primaryRef.current;
    const grow = growRef.current;
    const list = menuRef.current;
    if (!anchor || !split || !slot || !link || !grow || !list) return;

    const measure = () => {
      slot.style.setProperty("--primary-w", `${link.getBoundingClientRect().width}px`);
      const resting = split.getBoundingClientRect().width - grow.getBoundingClientRect().width;
      const extra = Math.max(0, list.getBoundingClientRect().width - resting);
      anchor.style.setProperty("--grow", `${extra}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(link);
    observer.observe(split);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

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

  return (
    <div className={styles.controls} data-open={open || undefined}>
      <div ref={anchorRef} className={styles.menuAnchor}>
        <div ref={splitRef} className={styles.split} data-bare={!primary || undefined}>
          <div ref={slotRef} className={styles.primarySlot} data-shown={primary ? true : undefined} inert={!primary}>
            <Link ref={primaryRef} className={styles.primary} href={shown.href} scroll={shown.scroll}>
              <span key={shown.label} className={styles.primaryLabel} data-swap={swapped || undefined}>
                {shown.label}
              </span>
            </Link>
          </div>
          <span ref={growRef} className={styles.grow} aria-hidden="true" />
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
      {/* Always rendered; CSS shows it and supplies the initials from the `<html>` flags. In the portal it opens your account settings. */}
      <Link
        className={styles.avatar}
        href={portal ? "/portal/settings" : "/portal"}
        aria-label={portal ? "Account" : "Your portal"}
      >
        <svg className={styles.avatarGlyph} viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="5.5" r="2.75" />
          <path d="M2.75 14c.6-2.9 2.7-4.5 5.25-4.5s4.65 1.6 5.25 4.5" />
        </svg>
      </Link>
    </div>
  );
}
