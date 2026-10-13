"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { ShareMenu } from "./ShareMenu";
import { SlideView, hasHead } from "./Slide";
import { SLIDES } from "./slides";
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
/** On a phone, a touch that barely moves and lifts quickly on a card's outer edge turns the slide, as a story does. */
const TAP_SLOP = 10;
const TAP_MS = 400;
const TAP_EDGE = 0.28;
/** Portrait phones get story cards: each slide reflowed to the screen, scrolling where it runs long. */
const COMPACT_MEDIA = "(max-width: 700px) and (orientation: portrait)";

const pad = (n: number) => String(n).padStart(2, "0");
/** Browser capabilities don't change while the page is open, so there is nothing to subscribe to. */
const noSubscribe = () => () => {};
const subscribeCompact = (onChange: () => void) => {
  const query = window.matchMedia(COMPACT_MEDIA);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const clamp = (n: number) => Math.min(Math.max(n, 0), TOTAL - 1);

/** Whether a key press belongs to a control rather than the deck: text fields, menus, and Space on buttons. */
function ownedByControl(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (target.closest("input, textarea, select, [contenteditable=true], [role=menu]")) return true;
  return event.key === " " && target.closest("button, a") !== null;
}

function ArrowIcon({ flip = false }: { flip?: boolean }): ReactElement {
  return (
    <svg className={styles.icon} viewBox="0 0 12 12" aria-hidden="true" data-flip={flip || undefined}>
      <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" />
    </svg>
  );
}

/**
 * The investor deck, filling the window: a 16:9 stage under the site header,
 * a control bar that rises from the bottom edge, an overview of every slide
 * and a share menu. The page's ground follows the slide's, so the slide has
 * no visible edge and the header reads its tone from `data-surface`. Every
 * slide stays mounted, inactive ones hidden, so printing (the PDF export)
 * lays them all out one per page. On a portrait phone (`compact`) each slide
 * is a story card instead: reflowed to the screen, scrolling inside itself,
 * drawing its own grid, turned by a swipe or a tap on its edge, with the
 * controls always up.
 */
/** The cover's ground and the header, standing in while the page reads which slide to open. */
export function DeckGround({ header }: { header: ReactNode }): ReactElement {
  const { ground } = SLIDES[0];
  return (
    <main className={styles.root} data-ground={ground} data-surface={ground === "ink" ? "dark" : "light"}>
      <div className={styles.header}>{header}</div>
    </main>
  );
}

export function Deck({ initialSlide, header }: { initialSlide: number; header: ReactNode }): ReactElement {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const wheel = useRef({ travel: 0, lockedUntil: 0 });
  const [index, setIndex] = useState(() => clamp(initialSlide));
  const [leaving, setLeaving] = useState<number | null>(null);
  const [overview, setOverview] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const canFullscreen = useSyncExternalStore(
    noSubscribe,
    () => document.fullscreenEnabled,
    () => false,
  );
  const phone = useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(COMPACT_MEDIA).matches,
    () => false,
  );
  // A printed deck is 16:9 pages wherever it's printed from.
  const compact = phone && !printing;
  const [nearBottom, setNearBottom] = useState(false);
  const [touched, setTouched] = useState(false);
  const [moved, setMoved] = useState(false);
  const slide = SLIDES[index];
  const controls = compact || nearBottom || touched || overview || shareOpen;

  const go = useCallback(
    (target: number) => {
      const next = clamp(target);
      if (next === index) return;
      setLeaving(index);
      setIndex(next);
      setMoved(true);
    },
    [index],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen();
  }, []);

  useEffect(() => {
    if (leaving === null) return;
    const timer = window.setTimeout(() => setLeaving(null), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  // One page grid for the whole deck: its rules follow the open slide's bands, so they glide from slide to slide.
  // Story cards scroll, so there each slide draws its own.
  useEffect(() => {
    const grid = gridRef.current;
    const slots = stageRef.current?.children;
    const frame = slots?.[index]?.querySelector<HTMLElement>("[data-frame]");
    if (!grid || !frame || compact) return;
    const head = frame.querySelector<HTMLElement>("[data-band=head]");
    const foot = frame.querySelector<HTMLElement>("[data-band=foot]");
    const name = slots?.[NAMED[index]]?.querySelector<HTMLElement>("[data-band=name]");
    const nameFoot = name?.closest<HTMLElement>("[data-band=foot]");
    // A slide without a head (the cover) folds the head rule into the top one; without a foot (the close) the foot rules go.
    grid.toggleAttribute("data-head", head !== null);
    grid.toggleAttribute("data-foot", foot !== null);
    grid.toggleAttribute("data-name", frame.querySelector("[data-band=name]") !== null);
    const place = () => {
      const top = head ? head.offsetTop : parseFloat(getComputedStyle(frame).paddingTop);
      grid.style.setProperty("--head-top", `${top}px`);
      grid.style.setProperty("--head-bottom", `${head ? head.offsetTop + head.offsetHeight : top}px`);
      grid.style.setProperty("--foot-top", `${foot ? foot.offsetTop : frame.offsetHeight}px`);
      grid.style.setProperty("--foot-bottom", `${foot ? foot.offsetTop + foot.offsetHeight : frame.offsetHeight}px`);
      if (nameFoot && name) {
        grid.style.setProperty("--name-top", `${nameFoot.offsetTop + name.offsetTop}px`);
        grid.style.setProperty("--name-width", `${name.offsetWidth}px`);
        grid.style.setProperty("--name-height", `${name.offsetHeight}px`);
      }
    };
    place();
    // Placed still the first time; after that every move animates.
    const ready = requestAnimationFrame(() => grid.setAttribute("data-ready", ""));
    const observer = new ResizeObserver(place);
    for (const band of [frame, head, foot, name]) if (band) observer.observe(band);
    return () => {
      cancelAnimationFrame(ready);
      observer.disconnect();
    };
  }, [index, compact]);

  // A story card opens at its top, before it paints, wherever it was left.
  useLayoutEffect(() => {
    const frame = stageRef.current?.children[index]?.querySelector<HTMLElement>("[data-frame]");
    if (frame) frame.scrollTop = 0;
  }, [index]);

  // The address bar holds the open slide, so reloading or copying it lands here.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (index === 0) url.searchParams.delete("slide");
    else url.searchParams.set("slide", String(index + 1));
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
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
      if (key === "f" && canFullscreen) {
        toggleFullscreen();
        return;
      }
      if (overview) return;
      let step = 0;
      if (["ArrowRight", "ArrowDown", "PageDown"].includes(event.key) || (event.key === " " && !event.shiftKey)) step = 1;
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key) || (event.key === " " && event.shiftKey)) step = -1;
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
  }, [index, overview, shareOpen, canFullscreen, go, toggleFullscreen]);

  // A trackpad or wheel turns slides one at a time; the overview scrolls instead.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || overview) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const state = wheel.current;
      const now = performance.now();
      if (now < state.lockedUntil) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      state.travel = Math.sign(delta) === Math.sign(state.travel) ? state.travel + delta : delta;
      if (Math.abs(state.travel) < WHEEL_STEP) return;
      go(index + Math.sign(state.travel));
      state.travel = 0;
      state.lockedUntil = now + WHEEL_LOCK_MS;
    };
    root.addEventListener("wheel", onWheel, { passive: true });
    return () => root.removeEventListener("wheel", onWheel);
  }, [index, overview, go]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    // Printing lays out every slide as shown, so their entrances must be settled before the browser paginates.
    const onBeforePrint = () => flushSync(() => setPrinting(true));
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
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") setNearBottom(window.innerHeight - event.clientY < REVEAL_PX);
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      setTouched(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTouched(false), TOUCH_SHOW_MS);
    };
    const onLeave = () => setNearBottom(false);
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

  // Opening the overview focuses the current slide's thumbnail.
  useEffect(() => {
    if (!overview) return;
    const current = overviewRef.current?.querySelector<HTMLElement>("[aria-current=true]");
    current?.focus({ preventScroll: true });
    current?.scrollIntoView({ block: "nearest" });
  }, [overview]);

  const onPointerDown = (event: ReactPointerEvent) => {
    swipe.current =
      event.pointerType === "mouse" ? null : { x: event.clientX, y: event.clientY, t: event.timeStamp };
  };

  // A vertical drag scrolls the card, and the browser cancels the pointer, so only horizontal swipes and taps get here.
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(index + (dx < 0 ? 1 : -1));
      return;
    }
    if (!compact || Math.hypot(dx, dy) > TAP_SLOP || event.timeStamp - start.t > TAP_MS) return;
    if ((event.target as Element).closest("a, button, input, select, textarea, label")) return;
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const at = (event.clientX - left) / width;
    if (at < TAP_EDGE) go(index - 1);
    else if (at > 1 - TAP_EDGE) go(index + 1);
  };

  const choose = (target: number) => {
    go(target);
    setOverview(false);
  };

  return (
    <main
      ref={rootRef}
      className={styles.root}
      data-ground={slide.ground}
      data-surface={slide.ground === "ink" ? "dark" : "light"}
      data-controls={controls || undefined}
      data-compact={compact || undefined}
      aria-roledescription="presentation"
      aria-label="ZODE investor deck"
    >
      <div className={styles.header}>
        {header}
      </div>
      {/* The page's one H1; each slide's title is an H2 under it. */}
      <h1 className={styles.srOnly}>ZODE investor presentation</h1>

      <div className={styles.viewport}>
        <div
          ref={stageRef}
          className={styles.stage}
          inert={overview}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipe.current = null)}
        >
          {SLIDES.map((entry, i) => {
            const current = i === index;
            return (
              <section
                key={entry.id}
                className={styles.slot}
                data-state={current ? "current" : i < index ? "before" : "after"}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${TOTAL}: ${entry.title}`}
                aria-hidden={!current && !printing}
                inert={!current && !printing}
              >
                <SlideView
                  slide={entry}
                  index={i}
                  total={TOTAL}
                  active={current || i === leaving || printing}
                  branded={printing}
                  grid={printing || compact}
                  compact={compact}
                />
              </section>
            );
          })}
        </div>
        <div ref={gridRef} className={styles.grid} data-strong={index === 0 || undefined} aria-hidden="true">
          <div className={styles.gridLines}>
            <span className={styles.rule} data-rule="top" />
            <span className={styles.rule} data-rule="head" />
            <span className={styles.rule} data-rule="foot" />
            <span className={styles.rule} data-rule="bottom" />
            <span className={styles.name}>
              <span
                key={`${SLIDES[NAMED[index]].eyebrow}:${NAMED[index] === index ? "shown" : "borrowed"}`}
                className={styles.nameLine}
                style={{ "--chars": SLIDES[NAMED[index]].eyebrow.length } as CSSProperties}
              >
                <span className={styles.nameText}>{SLIDES[NAMED[index]].eyebrow}</span>
                <span className={styles.nameCursor} />
              </span>
            </span>
          </div>
        </div>
      </div>

      <nav className={styles.bar} aria-label="Deck controls">
        <div className={styles.barStart}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Previous slide"
            disabled={index === 0}
            onClick={() => go(index - 1)}
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
          {compact && !moved ? (
            <span className={styles.hint}>
              Swipe <ArrowIcon />
            </span>
          ) : (
            <span className={styles.section}>{slide.section}</span>
          )}
        </div>

        <ol className={styles.progress}>
          {SLIDES.map((entry, i) => (
            <li key={entry.id}>
              <button
                type="button"
                className={styles.tick}
                data-state={i === index ? "current" : i < index ? "past" : "future"}
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
          {canFullscreen && !compact ? (
            <button
              type="button"
              className={styles.textButton}
              aria-pressed={fullscreen}
              onClick={toggleFullscreen}
            >
              <svg className={styles.icon} viewBox="0 0 12 12" aria-hidden="true">
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

      {overview ? (
        <div ref={overviewRef} className={styles.overview} role="dialog" aria-modal="true" aria-label="All slides">
          <ol className={styles.overviewGrid}>
            {SLIDES.map((entry, i) => (
              <li key={entry.id} className={styles.thumb} data-current={i === index || undefined}>
                <div className={styles.thumbFrame} inert aria-hidden="true">
                  <SlideView slide={entry} index={i} total={TOTAL} active />
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

      <p className={styles.srOnly} aria-live="polite">
        Slide {index + 1} of {TOTAL}: {slide.title}
      </p>
    </main>
  );
}
