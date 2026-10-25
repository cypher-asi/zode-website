"use client";

import {
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";
import { flushSync } from "react-dom";
import type { PolicyMap } from "./policyTypes";
import { ShareMenu } from "./ShareMenu";
import { PAGING_KEYS, SlideView, hasHead } from "./Slide";
import { DEMAND_DETAILS, SLIDES } from "./slides";
import styles from "./Deck.module.css";

const TOTAL = SLIDES.length;
/**
 * The slide whose section name shows on each slide. One without a name (the
 * cover and close, which have no head band) borrows its neighbour's (the
 * close the one before, the cover the one after), so the name fades out and
 * in rather than also changing size.
 */
const NAMED = SLIDES.map((slide, i) => {
  if (hasHead(slide)) return i;
  const before = SLIDES.slice(0, i).findLastIndex(hasHead);
  return before >= 0 ? before : SLIDES.findIndex(hasHead);
});
/** How long a slide that's leaving keeps its content, so it fades with the slide rather than before it. */
const LEAVE_MS = 450;
/** Wheel travel that turns one slide, and the pause after, so one fling doesn't skip several. */
const WHEEL_STEP = 60;
const WHEEL_LOCK_MS = 700;
/** Horizontal travel that counts as a swipe. */
const SWIPE_MIN = 48;
/** The controls rise when a mouse comes within this many pixels of the window's bottom. */
const REVEAL_PX = 120;
/** And stay this long after a touch, where there's no pointer to follow. */
const TOUCH_SHOW_MS = 3000;
/**
 * Portrait screens and landscape phones read the deck as one page, the slides
 * scrolling one after another; a 16:9 slide there would shrink its type out
 * of reach. Deck.module.css hides the stage under the same query until this
 * takes over from the server's render.
 */
const SCROLL_MEDIA = "(orientation: portrait), (max-height: 500px)";
/** In scroll mode, scrolling down this far past the last turn hides the controls, and back up as far brings them back. */
const BAR_SLOP = 8;
/** They stay up within this much of the top. */
const BAR_TOP = 80;
/** The slide crossing this line down the window is the current one. */
const CURRENT_LINE = "-40% 0px -59% 0px";
/** A slide's entrance plays once this far into the window... */
const SEEN_MARGIN = "0px 0px -15% 0px";
/** ...and its images load within a window's height of it. */
const NEAR_MARGIN = "100% 0px";

const pad = (n: number) => String(n).padStart(2, "0");
/** Browser capabilities don't change while the page is open, so there is nothing to subscribe to. */
const noSubscribe = () => () => {};
const subscribeScroll = (onChange: () => void) => {
  const query = window.matchMedia(SCROLL_MEDIA);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const clamp = (n: number) => Math.min(Math.max(n, 0), TOTAL - 1);
const EVERY_SLOT: ReadonlySet<number> = new Set(SLIDES.keys());
const NO_SLOTS: ReadonlySet<number> = new Set();
/** A slide and its neighbours, kept drawn so the usual step to either one starts without laying it out first. */
const around = (i: number): ReadonlySet<number> =>
  new Set([clamp(i - 1), i, clamp(i + 1)]);

/** `slots` with the observed slides added as they come into range and, unless `latch`, dropped as they leave it. */
function follow(
  slots: ReadonlySet<number>,
  entries: IntersectionObserverEntry[],
  latch: boolean,
): ReadonlySet<number> {
  const next = new Set(slots);
  for (const entry of entries) {
    const slot = Number((entry.target as HTMLElement).dataset.slot);
    if (entry.isIntersecting) next.add(slot);
    else if (!latch) next.delete(slot);
  }
  return next.size === slots.size && [...next].every((slot) => slots.has(slot))
    ? slots
    : next;
}

/** Whether a key press belongs to a control rather than the deck: text fields, menus, modals, and Space on buttons. */
function ownedByControl(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (
    target.closest(
      "input, textarea, select, [contenteditable=true], [role=menu]",
    )
  )
    return true;
  // A route modal (e.g. Invest) keeps every key; an open detail modal all but the paging keys, wherever its focus has gone.
  const detail = document.querySelector("dialog[data-deck-keys][open]");
  if (detail ? !PAGING_KEYS.has(event.key) : target.closest("dialog"))
    return true;
  return (
    event.key === " " && target.closest("button, a, [role=button]") !== null
  );
}

function ArrowIcon({ flip = false }: { flip?: boolean }): ReactElement {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 12 12"
      aria-hidden="true"
      data-flip={flip || undefined}
    >
      <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" />
    </svg>
  );
}

/**
 * The investor deck, filling the window: a 16:9 stage under the site header,
 * a control bar that rises from the bottom edge, an overview of every slide
 * and a share menu. The page's ground follows the slide's, so the slide has
 * no visible edge and the header reads its tone from `data-surface`. Every
 * slide stays mounted, inactive ones hidden and parked unrendered, so
 * printing (the PDF export) lays them all out one per page. On a portrait
 * screen or a landscape phone (`scroll`) the slides instead stand one after
 * another down the page, each reflowed to one column and carrying its own
 * tone for the header. Each plays its entrance as it scrolls in, and the
 * controls slip away while you read down. The overview is a list there.
 */
/** The cover's ground, standing in while the page reads which slide to open. */
export function DeckGround(): ReactElement {
  const { ground } = SLIDES[0];
  return (
    <main
      className={styles.root}
      data-ground={ground}
      data-surface={ground === "ink" ? "dark" : "light"}
    />
  );
}

export function Deck({
  initialSlide,
  policy,
}: {
  initialSlide: number;
  /** The policy slide's map, or null when the tracker couldn't be read. */
  policy: PolicyMap | null;
}): ReactElement {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLElement | null)[]>([]);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const wheel = useRef({ travel: 0, lockedUntil: 0 });
  const [index, setIndex] = useState(() => clamp(initialSlide));
  const [leaving, setLeaving] = useState<number | null>(null);
  // The slots drawn; every other one is parked. A transition needs a style to start from, and a parked slot's content
  // keeps the last one it had, so a slot opens and is styled at rest before it plays, and is put at rest before it parks.
  const [open, setOpen] = useState<ReadonlySet<number>>(() =>
    around(clamp(initialSlide)),
  );
  const [overview, setOverview] = useState(false);
  // Its thumbnails are whole slides, so they're drawn while the page is idle and kept, rather than on opening.
  const [overviewDrawn, setOverviewDrawn] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const canFullscreen = useSyncExternalStore(
    noSubscribe,
    () => document.fullscreenEnabled,
    () => false,
  );
  const scrollScreen = useSyncExternalStore(
    subscribeScroll,
    () => window.matchMedia(SCROLL_MEDIA).matches,
    () => false,
  );
  // A printed deck is 16:9 pages wherever it's printed from.
  const scroll = scrollScreen && !printing;
  // In scroll mode, the slides that have come into the window (latched), are in it, and are near it.
  const [seen, setSeen] = useState<ReadonlySet<number>>(NO_SLOTS);
  const [inView, setInView] = useState<ReadonlySet<number>>(NO_SLOTS);
  const [near, setNear] = useState<ReadonlySet<number>>(NO_SLOTS);
  const [barHidden, setBarHidden] = useState(false);
  const [nearBottom, setNearBottom] = useState(false);
  const [touched, setTouched] = useState(false);
  const slide = SLIDES[index];
  const controls = scroll
    ? !barHidden || overview || shareOpen
    : nearBottom || touched || overview || shareOpen;

  // Back on the stage, its slide and neighbours open again, wherever the page was scrolled to; while printing they all stay open.
  const [layout, setLayout] = useState(scroll);
  if (layout !== scroll) {
    setLayout(scroll);
    setBarHidden(false);
    if (!scroll && !printing) setOpen(around(index));
  }

  const go = useCallback(
    (target: number) => {
      const next = clamp(target);
      if (scroll) {
        // Smooth only to a neighbour: past slides not yet laid out, the target would move mid-flight.
        const smooth =
          Math.abs(next - index) <= 1 &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        slotRefs.current[next]?.scrollIntoView({
          block: "start",
          behavior: smooth ? "smooth" : "instant",
        });
        return;
      }
      if (next === index) return;
      if (!open.has(next)) {
        flushSync(() => setOpen((slots) => new Set(slots).add(next)));
        slotRefs.current[next]?.getBoundingClientRect();
      }
      setLeaving(index);
      setIndex(next);
    },
    [index, open, scroll],
  );

  // In scroll mode, Previous first goes back to the top of a slide read partway down.
  const back = () => {
    const slot = slotRefs.current[index];
    if (!scroll || !slot) return go(index - 1);
    const offset =
      slot.getBoundingClientRect().top -
      parseFloat(getComputedStyle(slot).scrollMarginTop);
    go(offset < -BAR_SLOP ? index : index - 1);
  };

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    // The whole page, so the pinned header (mounted above the deck) stays up while presenting.
    else void document.documentElement.requestFullscreen();
  }, []);

  useEffect(() => {
    if (leaving === null) return;
    const timer = window.setTimeout(() => {
      flushSync(() => setLeaving(null));
      stageRef.current?.getBoundingClientRect();
      setOpen(around(index));
    }, LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, index]);

  // One page grid for the whole deck: its rules follow the open slide's bands, so they glide from slide to slide.
  // Scrolling slides each draw their own.
  useEffect(() => {
    const grid = gridRef.current;
    const slots = slotRefs.current;
    const frame = slots[index]?.querySelector<HTMLElement>("[data-frame]");
    if (!grid || !frame || scroll) return;
    const head = frame.querySelector<HTMLElement>("[data-band=head]");
    const foot = frame.querySelector<HTMLElement>("[data-band=foot]");
    const name =
      slots[NAMED[index]]?.querySelector<HTMLElement>("[data-band=name]");
    const nameFoot = name?.closest<HTMLElement>("[data-band=foot]");
    // A slide without a head (the cover) folds the head rule into the top one; without a foot (the close) the foot rules go.
    grid.toggleAttribute("data-head", head !== null);
    grid.toggleAttribute("data-foot", foot !== null);
    grid.toggleAttribute(
      "data-name",
      frame.querySelector("[data-band=name]") !== null,
    );
    const place = () => {
      const top = head
        ? head.offsetTop
        : parseFloat(getComputedStyle(frame).paddingTop);
      grid.style.setProperty("--head-top", `${top}px`);
      grid.style.setProperty(
        "--head-bottom",
        `${head ? head.offsetTop + head.offsetHeight : top}px`,
      );
      grid.style.setProperty(
        "--foot-top",
        `${foot ? foot.offsetTop : frame.offsetHeight}px`,
      );
      grid.style.setProperty(
        "--foot-bottom",
        `${foot ? foot.offsetTop + foot.offsetHeight : frame.offsetHeight}px`,
      );
      if (nameFoot && name) {
        grid.style.setProperty(
          "--name-top",
          `${nameFoot.offsetTop + name.offsetTop}px`,
        );
        grid.style.setProperty("--name-width", `${name.offsetWidth}px`);
        grid.style.setProperty("--name-height", `${name.offsetHeight}px`);
      }
    };
    place();
    // Placed still the first time; after that every move animates.
    const ready = requestAnimationFrame(() =>
      grid.setAttribute("data-ready", ""),
    );
    const observer = new ResizeObserver(place);
    for (const band of [frame, head, foot, name])
      if (band) observer.observe(band);
    return () => {
      cancelAnimationFrame(ready);
      observer.disconnect();
    };
  }, [index, scroll]);

  // Entering scroll mode, the page opens at the current slide, before it paints.
  const scrolledTo = useRef(false);
  useLayoutEffect(() => {
    if (!scroll) {
      scrolledTo.current = false;
      return;
    }
    if (scrolledTo.current) return;
    scrolledTo.current = true;
    if (index > 0)
      slotRefs.current[index]?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
  }, [scroll, index]);

  // In scroll mode the slides report themselves: the one across the line is current, and each plays, runs and loads by its distance.
  useEffect(() => {
    if (!scroll) return;
    const slots = slotRefs.current.filter(
      (slot): slot is HTMLElement => slot !== null,
    );
    const track = (
      update: (entries: IntersectionObserverEntry[]) => void,
      rootMargin: string,
    ) => {
      const observer = new IntersectionObserver(update, { rootMargin });
      for (const slot of slots) observer.observe(slot);
      return observer;
    };
    const observers = [
      track((entries) => {
        const crossing = entries.findLast((entry) => entry.isIntersecting);
        if (crossing)
          setIndex(Number((crossing.target as HTMLElement).dataset.slot));
      }, CURRENT_LINE),
      track(
        (entries) => setSeen((slots) => follow(slots, entries, true)),
        SEEN_MARGIN,
      ),
      track(
        (entries) => setInView((slots) => follow(slots, entries, false)),
        "0px",
      ),
      track(
        (entries) => setNear((slots) => follow(slots, entries, false)),
        NEAR_MARGIN,
      ),
    ];
    return () => {
      for (const observer of observers) observer.disconnect();
    };
  }, [scroll]);

  // In scroll mode the controls slip away while you read down and come back as you scroll up, near the top, or at the end.
  useEffect(() => {
    if (!scroll) return;
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const atEnd =
        y + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (y < BAR_TOP || atEnd) setBarHidden(false);
      else if (y > last + BAR_SLOP) setBarHidden(true);
      else if (y < last - BAR_SLOP) setBarHidden(false);
      else return;
      last = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [scroll]);

  // The address bar holds the open slide, so reloading or copying it lands here.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (index === 0) url.searchParams.delete("slide");
    else url.searchParams.set("slide", String(index + 1));
    if (url.href !== window.location.href)
      window.history.replaceState(null, "", url);
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (event.key === "Escape") {
        if (shareOpen) setShareOpen(false);
        else if (overview) setOverview(false);
        return;
      }
      if (ownedByControl(event)) return;
      const key = event.key.toLowerCase();
      if (key === "g" || key === "o") {
        setOverview((open) => !open);
        setShareOpen(false);
        return;
      }
      if (key === "f" && canFullscreen && !scroll) {
        toggleFullscreen();
        return;
      }
      // A scrolling deck leaves the arrows, Space and paging keys to the page.
      if (overview || scroll) return;
      let step = 0;
      if (
        ["ArrowRight", "ArrowDown", "PageDown"].includes(event.key) ||
        (event.key === " " && !event.shiftKey)
      )
        step = 1;
      else if (
        ["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key) ||
        (event.key === " " && event.shiftKey)
      )
        step = -1;
      if (event.key === "Home") {
        event.preventDefault();
        go(0);
      } else if (event.key === "End") {
        event.preventDefault();
        go(TOTAL - 1);
      } else if (step) {
        event.preventDefault();
        go(index + step);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, overview, shareOpen, canFullscreen, scroll, go, toggleFullscreen]);

  // A trackpad or wheel turns slides one at a time; the overview, and a scrolling deck, scroll instead.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || overview || scroll) return;
    const onWheel = (event: WheelEvent) => {
      // A list in a slide that scrolls itself (the states slide's) keeps the wheel.
      if (
        event.ctrlKey ||
        (event.target as Element).closest("dialog, [data-deck-scroll]")
      )
        return;
      const state = wheel.current;
      const now = performance.now();
      if (now < state.lockedUntil) return;
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      state.travel =
        Math.sign(delta) === Math.sign(state.travel)
          ? state.travel + delta
          : delta;
      if (Math.abs(state.travel) < WHEEL_STEP) return;
      go(index + Math.sign(state.travel));
      state.travel = 0;
      state.lockedUntil = now + WHEEL_LOCK_MS;
    };
    root.addEventListener("wheel", onWheel, { passive: true });
    return () => root.removeEventListener("wheel", onWheel);
  }, [index, overview, scroll, go]);

  useEffect(() => {
    const onChange = () =>
      setFullscreen(document.fullscreenElement === document.documentElement);
    // Printing lays out every slide as shown, so their entrances must be settled before the browser paginates.
    // They stay open after, until the next slide's turn parks them at rest.
    const onBeforePrint = () =>
      flushSync(() => {
        setPrinting(true);
        setOpen(EVERY_SLOT);
      });
    const onAfterPrint = () => setPrinting(false);
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  // The controls follow a mouse to the bottom edge; a touch brings them up for a while.
  useEffect(() => {
    let timer = 0;
    let near = false;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const next = window.innerHeight - event.clientY < REVEAL_PX;
      if (next === near) return;
      near = next;
      setNearBottom(near);
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      setTouched(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTouched(false), TOUCH_SHOW_MS);
    };
    const onLeave = () => {
      near = false;
      setNearBottom(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // Laid out once, hidden, when the controls first rise and the Slides button comes in reach, so its first opening
  // reuses that layout rather than making its own. Not while the page settles, where it would stall an entrance.
  const overviewWarm = useRef(false);
  useEffect(() => {
    const overview = overviewRef.current;
    if (
      scroll ||
      !overviewDrawn ||
      !controls ||
      !overview ||
      overviewWarm.current
    )
      return;
    overview.setAttribute("data-warming", "");
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        overviewWarm.current = true;
        overview.removeAttribute("data-warming");
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      overview.removeAttribute("data-warming");
    };
  }, [scroll, overviewDrawn, controls]);

  // A scrolling deck lists the slides instead, so the thumbnails wait for the stage.
  useEffect(() => {
    if (scroll || overviewDrawn) return;
    const draw = () => startTransition(() => setOverviewDrawn(true));
    if (typeof requestIdleCallback === "function") {
      const idle = requestIdleCallback(draw, { timeout: 4000 });
      return () => cancelIdleCallback(idle);
    }
    const timer = window.setTimeout(draw, 1500);
    return () => window.clearTimeout(timer);
  }, [scroll, overviewDrawn]);

  // Opening the overview focuses the current slide's entry.
  useEffect(() => {
    if (!overview) return;
    const current = overviewRef.current?.querySelector<HTMLElement>(
      "[aria-current=true]",
    );
    current?.focus({ preventScroll: true });
    current?.scrollIntoView({ block: "nearest" });
  }, [overview]);

  const onPointerDown = (event: ReactPointerEvent) => {
    swipe.current =
      event.pointerType === "mouse" ||
      (event.target as Element).closest("dialog, [data-deck-scroll]")
        ? null
        : { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5)
      go(index + (dx < 0 ? 1 : -1));
  };

  const choose = (target: number) => {
    setOverview(false);
    go(target);
  };

  return (
    <main
      ref={rootRef}
      className={styles.root}
      data-ground={slide.ground}
      data-surface={slide.ground === "ink" ? "dark" : "light"}
      data-controls={controls || undefined}
      data-scroll={scroll || undefined}
      aria-roledescription="presentation"
      aria-label="ZODE investor deck"
    >
      {/* The page's one H1; each slide's title is an H2 under it. */}
      <h1 className={styles.srOnly}>ZODE investor presentation</h1>

      <div className={styles.viewport}>
        <div
          ref={stageRef}
          className={styles.stage}
          inert={overview}
          onPointerDown={scroll ? undefined : onPointerDown}
          onPointerUp={scroll ? undefined : onPointerUp}
          onPointerCancel={scroll ? undefined : () => (swipe.current = null)}
        >
          {SLIDES.map((entry, i) => {
            const current = i === index;
            const shown = scroll || current || printing;
            return (
              <Fragment key={entry.id}>
                {/* Beside the slot, not in it, so jumps and the current-slide line still find the slide itself. */}
                {scroll && i > 0 ? (
                  <div
                    className={styles.divider}
                    data-ground={entry.ground}
                    data-surface={entry.ground === "ink" ? "dark" : "light"}
                    aria-hidden="true"
                  >
                    <span className={styles.dividerNumber}>
                      {pad(i + 1)} / {pad(TOTAL)}
                    </span>
                    <span className={styles.dividerName}>{entry.section}</span>
                  </div>
                ) : null}
                <section
                  ref={(slot) => {
                    slotRefs.current[i] = slot;
                  }}
                  className={styles.slot}
                  data-slot={i}
                  data-state={
                    scroll
                      ? undefined
                      : current
                        ? "current"
                        : i < index
                          ? "before"
                          : "after"
                  }
                  data-parked={(!scroll && !open.has(i)) || undefined}
                  data-surface={
                    scroll
                      ? entry.ground === "ink"
                        ? "dark"
                        : "light"
                      : undefined
                  }
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${TOTAL}: ${entry.title}`}
                  aria-hidden={!shown}
                  inert={!shown}
                >
                  <SlideView
                    slide={entry}
                    index={i}
                    total={TOTAL}
                    active={
                      scroll
                        ? seen.has(i)
                        : current || i === leaving || printing
                    }
                    playing={scroll ? seen.has(i) && inView.has(i) : undefined}
                    near={
                      scroll
                        ? near.has(i)
                        : printing || Math.abs(i - index) <= 1
                    }
                    branded={printing}
                    grid={printing || scroll}
                    compact={scroll}
                    policy={policy}
                  />
                </section>
                {/* The demand slide's details open in a modal on screen; printed, they follow it as pages. */}
                {printing && entry.kind === "demand"
                  ? DEMAND_DETAILS.map((detail) => (
                      <section
                        key={detail.id}
                        className={styles.slot}
                        aria-hidden="true"
                        inert
                      >
                        <SlideView
                          slide={detail}
                          index={i}
                          total={TOTAL}
                          active
                          near
                          branded
                          numbered={false}
                          policy={policy}
                        />
                      </section>
                    ))
                  : null}
              </Fragment>
            );
          })}
        </div>
        {scroll ? null : (
          <div
            ref={gridRef}
            className={styles.grid}
            data-strong={index === 0 || undefined}
            aria-hidden="true"
          >
            <div className={styles.gridLines}>
              <span className={styles.rule} data-rule="top" />
              <span className={styles.rule} data-rule="head" />
              <span className={styles.rule} data-rule="foot" />
              <span className={styles.rule} data-rule="bottom" />
              <span className={styles.name}>
                <span
                  key={`${SLIDES[NAMED[index]].eyebrow}:${NAMED[index] === index ? "shown" : "borrowed"}`}
                  className={styles.nameLine}
                  style={
                    {
                      "--chars": SLIDES[NAMED[index]].eyebrow.length,
                    } as CSSProperties
                  }
                >
                  <span className={styles.nameText}>
                    {SLIDES[NAMED[index]].eyebrow}
                  </span>
                  <span className={styles.nameCursor} />
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      <nav className={styles.bar} aria-label="Deck controls">
        <div className={styles.barStart}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Previous slide"
            disabled={index === 0}
            onClick={back}
          >
            <ArrowIcon flip />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Next slide"
            disabled={index === TOTAL - 1}
            onClick={() => go(index + 1)}
          >
            <ArrowIcon />
          </button>
          <span className={styles.counter}>
            {pad(index + 1)} / {pad(TOTAL)}
          </span>
          <span className={styles.section}>{slide.section}</span>
        </div>

        <ol className={styles.progress}>
          {SLIDES.map((entry, i) => (
            <li key={entry.id}>
              <button
                type="button"
                className={styles.tick}
                data-state={
                  i === index ? "current" : i < index ? "past" : "future"
                }
                data-title={`${pad(i + 1)} ${entry.section}`}
                aria-label={`Slide ${i + 1}: ${entry.section}`}
                aria-current={i === index ? "step" : undefined}
                onClick={() => go(i)}
              />
            </li>
          ))}
        </ol>

        <div className={styles.barEnd}>
          <button
            type="button"
            className={styles.textButton}
            aria-pressed={overview}
            onClick={() => {
              setOverview((open) => !open);
              setShareOpen(false);
            }}
          >
            <svg className={styles.icon} viewBox="0 0 12 12" aria-hidden="true">
              <rect x="1.5" y="1.5" width="3.5" height="3.5" />
              <rect x="7" y="1.5" width="3.5" height="3.5" />
              <rect x="1.5" y="7" width="3.5" height="3.5" />
              <rect x="7" y="7" width="3.5" height="3.5" />
            </svg>
            Slides
          </button>
          <ShareMenu
            open={shareOpen}
            onOpenChange={setShareOpen}
            slideNumber={index + 1}
            slideTitle={slide.title}
            buttonClassName={styles.textButton}
            iconClassName={styles.icon}
          />
          {canFullscreen && !scroll ? (
            <button
              type="button"
              className={styles.textButton}
              aria-pressed={fullscreen}
              onClick={toggleFullscreen}
            >
              <svg
                className={styles.icon}
                viewBox="0 0 12 12"
                aria-hidden="true"
              >
                {fullscreen ? (
                  <path d="M4.5 1.5v3h-3M7.5 1.5v3h3M4.5 10.5v-3h-3M7.5 10.5v-3h3" />
                ) : (
                  <path d="M1.5 4.5v-3h3M10.5 4.5v-3h-3M1.5 7.5v3h3M10.5 7.5v3h-3" />
                )}
              </svg>
              {fullscreen ? "Exit" : "Present"}
            </button>
          ) : null}
        </div>
      </nav>

      {scroll ? (
        overview ? (
          <div
            ref={overviewRef}
            className={styles.overview}
            data-open=""
            role="dialog"
            aria-modal="true"
            aria-label="All slides"
          >
            <ol className={styles.toc}>
              {SLIDES.map((entry, i) => (
                <li key={entry.id} className={styles.tocItem}>
                  <button
                    type="button"
                    className={styles.tocRow}
                    aria-current={i === index}
                    onClick={() => choose(i)}
                  >
                    <span className={styles.tocNumber}>{pad(i + 1)}</span>
                    <span className={styles.tocText}>
                      <span className={styles.tocSection}>{entry.section}</span>
                      <span className={styles.tocTitle}>{entry.title}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : null
      ) : overview || overviewDrawn ? (
        <div
          ref={overviewRef}
          className={styles.overview}
          data-open={overview || undefined}
          inert={!overview}
          role="dialog"
          aria-modal="true"
          aria-label="All slides"
        >
          <ol className={styles.overviewGrid}>
            {SLIDES.map((entry, i) => (
              <li
                key={entry.id}
                className={styles.thumb}
                data-current={i === index || undefined}
              >
                <div className={styles.thumbFrame} inert aria-hidden="true">
                  <SlideView
                    slide={entry}
                    index={i}
                    total={TOTAL}
                    active
                    still
                    policy={policy}
                  />
                </div>
                <p className={styles.thumbLabel}>
                  <span>{pad(i + 1)}</span>
                  <span>{entry.section}</span>
                </p>
                <button
                  type="button"
                  className={styles.thumbButton}
                  aria-label={`Slide ${i + 1}: ${entry.title}`}
                  aria-current={i === index}
                  onClick={() => choose(i)}
                />
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {scroll ? null : (
        <p className={styles.srOnly} aria-live="polite">
          Slide {index + 1} of {TOTAL}: {slide.title}
        </p>
      )}
    </main>
  );
}
