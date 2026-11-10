import Image from "next/image";
import Link from "next/link";
import {
  Fragment,
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { NorthAmericaFlags } from "@/components/ui/NorthAmericaFlags";
import { OverlayScrollbar } from "@/components/ui/OverlayScrollbar";
import {
  CabinArt,
  VIEW as CABIN_VIEW,
} from "@/features/zode-drawings/CabinArt";
import { Principles } from "@/features/home/principles/Principles";
import { StackFigure } from "@/features/home/stack/FullStack";
import { VIEW as STACK_VIEW } from "@/features/home/stack/StackArt";
import { MacroArt } from "./art/MacroArt";
import { MemeTV } from "./art/MemeTV";
import { SiteMap } from "./art/SiteMap";
import { UnitIcon } from "./art/UnitIcon";
import { DEMAND_GAP, DemandChart } from "./charts/DemandChart";
import { ShortfallByYear, ShortfallChart } from "./charts/ShortfallChart";
import { StateTileMap } from "./charts/StateTileMap";
import { TokenChart } from "./charts/TokenChart";
import { DISCLAIMER, LEGAL_LEGEND, RAISE_NOTE } from "./disclaimer";
import type { Contributions } from "./github";
import { useLocalPauses } from "./localPauses";
import { BLOCKED, NEWS } from "./news";
import { PolicyPanel, type PolicyChoice } from "./PolicyPanel";
import {
  LEGEND,
  LEGEND_LABELS,
  type PolicyKey,
  type PolicyMap,
  type PolicyState,
} from "./policyTypes";
import {
  AS_OF,
  SOURCES,
  sourceUrl,
  type Source,
  type SourceId,
} from "./research";
import {
  DEMAND_DETAILS,
  RAISE_DETAILS,
  SLIDES,
  type ContractSide,
  type Logo,
  type SaleModeId,
  type Slide,
  type Stat,
} from "./slides";
import styles from "./Slide.module.css";

type Of<K extends Slide["kind"]> = Extract<Slide, { kind: K }>;

const noop = () => {};

/** Staggers a block's entrance after the slide becomes active. */
const rise = (d: number) => ({
  className: styles.rise,
  style: { "--d": d } as CSSProperties,
});

function cite(source: Source): string {
  return `${source.publisher}${source.via ? ` (${source.via})` : ""}, ${source.date}`;
}

/** An inline citation, linked to its source when the source has a page. */
function Cited({
  id,
  children,
}: {
  id: SourceId;
  children: ReactNode;
}): ReactElement {
  const url = sourceUrl(id);
  return url ? (
    <a
      className={styles.cited}
      href={url}
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
    </a>
  ) : (
    <>{children}</>
  );
}

function SourceLine({ ids }: { ids: readonly SourceId[] }): ReactElement {
  return (
    <p className={styles.sources}>
      {ids.map((id, i) => {
        const source: Source = SOURCES[id];
        return (
          <span key={id}>
            {i ? "; " : null}
            {source.url ? (
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {cite(source)}
              </a>
            ) : (
              cite(source)
            )}
          </span>
        );
      })}
      .
    </p>
  );
}

function StatBlock({
  stat,
  highlight = false,
  size = "md",
}: {
  stat: Stat;
  highlight?: boolean;
  size?: "md" | "lg" | "xl";
}): ReactElement {
  return (
    <div className={styles.stat} data-size={size}>
      <span
        className={styles.statValue}
        data-highlight={highlight || undefined}
      >
        {stat.value}
      </span>
      <span className={styles.statLabel}>{stat.label}</span>
    </div>
  );
}

/**
 * The cover's securities legend in fine print, and the full disclaimer
 * behind it: a button opens it in a panel over the cover's image, which its
 * close, Escape, the button again or turning the slide shuts, back on the
 * button. Printed, it takes the image's place, so the PDF's first page carries it
 * whole. Nothing around the panel may take a transform (`.rise`), or it would
 * position against that instead of the frame.
 */
function CoverDisclaimer({ active }: { active: boolean }): ReactElement {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(active);
  if (shown !== active) {
    setShown(active);
    if (!active) setOpen(false);
  }
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() =>
      buttonRef.current?.focus({ preventScroll: true }),
    );
  };
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setOpen(false);
      requestAnimationFrame(() =>
        buttonRef.current?.focus({ preventScroll: true }),
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={styles.disclaimer}>
      <p
        {...rise(3)}
        className={`${styles.rise} ${styles.fine} ${styles.legalLegend}`}
      >
        {LEGAL_LEGEND}
      </p>
      <button
        ref={buttonRef}
        type="button"
        {...rise(3.5)}
        className={`${styles.rise} ${styles.sourcesToggle} ${styles.disclaimerToggle}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? close() : setOpen(true))}
      >
        Important legal information
      </button>
      <section
        ref={panelRef}
        id={id}
        className={styles.disclaimerPanel}
        data-open={open || undefined}
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        data-deck-scroll=""
      >
        <header className={styles.disclaimerHead}>
          <h3 id={`${id}-title`} className={styles.label}>
            Important legal information
          </h3>
          <button
            type="button"
            className={styles.disclaimerClose}
            onClick={close}
            aria-label="Close"
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </header>
        <div className={styles.disclaimerFrame}>
          <div id={`${id}-list`} className={styles.disclaimerList}>
            {DISCLAIMER.map((section) => (
              <section
                key={section.heading}
                className={styles.disclaimerSection}
              >
                <h4 className={styles.disclaimerHeading}>{section.heading}</h4>
                <p className={styles.disclaimerBody}>{section.body}</p>
              </section>
            ))}
          </div>
          <OverlayScrollbar targetId={`${id}-list`} showOnHover />
        </div>
      </section>
    </div>
  );
}

function Cover({
  slide,
  active,
}: {
  slide: Of<"cover">;
  active: boolean;
}): ReactElement {
  return (
    <div className={styles.cover}>
      <div className={styles.coverText}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the SVG wordmark scales with the slide */}
        <img
          className={styles.printMark}
          src="/brand/zode-wordmark-white.svg"
          alt="ZODE"
        />
        <div className={styles.coverTitleBlock}>
          <h2
            {...rise(1)}
            className={`${styles.rise} ${styles.display} ${styles.coverTitle}`}
          >
            {slide.title}
          </h2>
          <p {...rise(2)} className={`${styles.rise} ${styles.coverLede}`}>
            {slide.lede}
          </p>
        </div>
        <CoverDisclaimer active={active} />
      </div>
      <div className={styles.coverImage} data-media data-surface="light">
        <Image
          src={slide.image}
          alt="A ZODE in a calm, daylit setting"
          fill
          sizes="(max-width: 700px) 100vw, (max-width: 900px) 50vw, 40vw"
          loading="eager"
        />
      </div>
    </div>
  );
}

/**
 * The macro slide, two thirds and one: on the left a quadrant of figure
 * cards, as the home page's features, a drawing (or the token chart) each,
 * captioned in the fewest words; on the right the statement, then the supply
 * chain from capital to offtake as rows, its bottleneck blinking red.
 */
function Stats({
  slide,
  active,
  playing,
  compact,
}: {
  slide: Of<"stats">;
  active: boolean;
  playing: boolean;
  compact: boolean;
}): ReactElement {
  return (
    <div className={styles.macro}>
      <div className={styles.macroLead}>
        <ul className={styles.macroCards}>
          {[
            ...slide.stats.map((stat) => ({
              key: stat.art,
              value: stat.value,
              label: stat.label,
              art: true,
              figure: <MacroArt id={stat.art} playing={playing} />,
            })),
            {
              key: "tokens",
              value: "",
              label: slide.trend,
              art: false,
              figure: <TokenChart active={active} compact={compact} />,
            },
          ].map((card, i) => (
            <li
              key={card.key}
              {...rise(2 + i * 0.5)}
              className={`${styles.rise} ${styles.macroCard}`}
            >
              <div
                className={styles.macroFigure}
                data-art={card.art || undefined}
              >
                {card.figure}
              </div>
              <p className={styles.macroCaption}>
                {card.value ? (
                  <span className={styles.macroValue}>{card.value}</span>
                ) : null}{" "}
                {card.label}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.macroChain}>
        <h3
          {...rise(2.5)}
          className={`${styles.rise} ${styles.h3} ${styles.macroStatement}`}
        >
          {slide.statement}
        </h3>
        <p {...rise(3)} className={`${styles.rise} ${styles.label}`}>
          Supply chain
        </p>
        <ol className={styles.chain}>
          {slide.chain.map((step, i) => (
            <li
              key={step.label}
              {...rise(3.5 + i * 0.4)}
              className={`${styles.rise} ${styles.chainStep}`}
              data-hard={step.hard || undefined}
            >
              <span className={styles.label}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className={styles.chainFigure}>
                <MacroArt id={step.art} hard={step.hard} playing={playing} />
              </div>
              <span className={styles.chainText}>
                <span className={styles.chainLabel}>{step.label}</span>
                {step.hard ? (
                  <span className={styles.chainNote}>Bottleneck</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** The modal's fade out; keep in step with `detail-out` in Slide.module.css. */
const DETAIL_EXIT_MS = 220;
/** On a phone, a swipe up or down this far steps to the next or previous detail, as Down and Up do. */
const DETAIL_SWIPE = 48;

/** The deck's paging keys, which a detail modal (`data-deck-keys`) leaves to the deck (Deck.tsx). */
export const PAGING_KEYS: ReadonlySet<string> = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  " ",
  "Home",
  "End",
]);

/**
 * A detail slide in its modal. It renders inactive and turns active two
 * frames on, once its resting state is painted, so its entrances play as on
 * the stage. Keyed by slide, so stepping to another detail plays them again.
 */
function DetailSlide({
  slide,
  compact,
  policy,
}: {
  slide: Slide;
  compact: boolean;
  policy: PolicyMap | null;
}): ReactElement {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <SlideView
      slide={slide}
      index={0}
      total={0}
      active={entered}
      near
      numbered={false}
      compact={compact}
      policy={policy}
    />
  );
}

/**
 * One of the demand slide's detail slides, drawn whole in a full-screen modal
 * over the deck, its close in the band across the top. It's portalled to the
 * body, so the stage's insets and the side column's styles don't reach it.
 * It fades in, and the close or Escape fades it out, focus going back to the
 * button that opened it. On the stage Up and Down step through the details
 * (`onStep`), and the deck's other paging keys pass through to turn the
 * slide, which shuts it (`data-deck-keys`, Deck.tsx). On a phone
 * (`compact`) a swipe up or down steps too.
 */
function DetailModal({
  slide,
  compact,
  policy,
  onStep,
  onClose,
}: {
  slide: Slide;
  compact: boolean;
  policy: PolicyMap | null;
  onStep: (delta: number) => void;
  onClose: () => void;
}): ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [closing, setClosing] = useState(false);
  // Not closed on unmount: that queues a close event, which would shut it again as it reopens. Unmounting takes it off the top layer.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    dialog.scrollTop = 0;
  }, []);
  useEffect(() => {
    if (!closing) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(
      () => ref.current?.close(),
      reduced ? 0 : DETAIL_EXIT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [closing]);
  // Up and Down are taken in the window's capture, wherever focus sits, so the deck sees them handled. Any other paging
  // key the deck handles turns the slide under the modal, which holds its content a while as it leaves, so the modal
  // fades out with it rather than after.
  useEffect(() => {
    const onStepKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (event.key !== "ArrowDown" && event.key !== "ArrowUp")
      )
        return;
      event.preventDefault();
      onStep(event.key === "ArrowDown" ? 1 : -1);
    };
    const onTurnKey = (event: KeyboardEvent) => {
      if (
        !event.defaultPrevented ||
        !PAGING_KEYS.has(event.key) ||
        event.key === "ArrowDown" ||
        event.key === "ArrowUp"
      )
        return;
      // Space on a control is the control's, as the deck leaves it (ownedByControl).
      const target = event.target as Element | null;
      if (event.key === " " && target?.closest("button, a, [role=button]"))
        return;
      setClosing(true);
    };
    window.addEventListener("keydown", onStepKey, true);
    window.addEventListener("keydown", onTurnKey);
    return () => {
      window.removeEventListener("keydown", onStepKey, true);
      window.removeEventListener("keydown", onTurnKey);
    };
  }, [onStep]);
  const dismiss = () => setClosing(true);

  return createPortal(
    <dialog
      ref={ref}
      className={styles.detailDialog}
      data-compact={compact || undefined}
      data-surface={slide.ground === "ink" ? "dark" : "light"}
      data-closing={closing || undefined}
      data-deck-keys=""
      aria-label={slide.title}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClose={onClose}
      onPointerDown={(event) => {
        swipe.current =
          compact &&
          !(event.target as Element).closest("[data-deck-scroll]")
            ? { x: event.clientX, y: event.clientY }
            : null;
      }}
      onPointerUp={(event) => {
        const start = swipe.current;
        swipe.current = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dy) > DETAIL_SWIPE && Math.abs(dy) > Math.abs(dx) * 1.5)
          onStep(dy < 0 ? 1 : -1);
      }}
      onPointerCancel={() => (swipe.current = null)}
    >
      <div className={styles.detailBox}>
        <div className={styles.detailStage}>
          <DetailSlide
            key={slide.id}
            slide={slide}
            compact={compact}
            policy={policy}
          />
        </div>
        <button
          ref={closeRef}
          type="button"
          className={styles.detailClose}
          onClick={dismiss}
          aria-label="Close"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" />
          </svg>
        </button>
      </div>
    </dialog>,
    document.body,
  );
}

/**
 * The demand chart, and beside it a button for each of the slides behind the
 * gap (`DEMAND_DETAILS`), each opening its slide in a modal, where Up and
 * Down step to its neighbours, stopping at the ends. Turning the slide shuts it.
 */
function Demand({
  active,
  compact,
  policy,
}: {
  active: boolean;
  compact: boolean;
  policy: PolicyMap | null;
}): ReactElement {
  const [detail, setDetail] = useState<Slide | null>(null);
  const [shown, setShown] = useState(active);
  if (shown !== active) {
    setShown(active);
    if (!active) setDetail(null);
  }
  const step = (delta: number) =>
    setDetail((open) => {
      if (!open) return open;
      const at = DEMAND_DETAILS.findIndex((item) => item.id === open.id);
      const next = Math.min(
        Math.max(at + delta, 0),
        DEMAND_DETAILS.length - 1,
      );
      return DEMAND_DETAILS[next];
    });
  return (
    <div className={styles.chartBody} data-split="details">
      <figure {...rise(2)} className={`${styles.rise} ${styles.figure}`}>
        <DemandChart active={active} compact={compact} />
        <figcaption className={styles.legend}>
          <span className={styles.key} data-key="line">
            Forecast US data center capacity,{" "}
            <Cited id="bnef">BNEF base case</Cited>
          </span>
          <span className={styles.key} data-key="dashed">
            Installed base growing at the grid&rsquo;s record 10 GW a year
            (illustrative, ZODE)
          </span>
          <span className={styles.key} data-key="gap">
            {compact ? `The gap: ${DEMAND_GAP} GW by 2035` : "The gap"}
          </span>
        </figcaption>
      </figure>
      <aside className={styles.side}>
        <h3 {...rise(3)} className={`${styles.rise} ${styles.label}`}>
          Behind the gap
        </h3>
        <ul className={styles.detailList}>
          {DEMAND_DETAILS.map((item, i) => (
            <li key={item.id} {...rise(4 + i * 0.5)}>
              <button
                type="button"
                className={styles.detailButton}
                aria-haspopup="dialog"
                onClick={() => setDetail(item)}
              >
                <span className={styles.label}>{pad(i + 1)}</span>
                <span className={styles.detailText}>
                  <span className={styles.detailTitle}>
                    {item.title.replace(/\.$/, "")}
                  </span>
                  <span className={styles.detailSummary}>{item.summary}</span>
                </span>
                <svg
                  className={styles.detailIcon}
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                >
                  <path d="M6 1v10M1 6h10" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {detail ? (
        <DetailModal
          slide={detail}
          compact={compact}
          policy={policy}
          onStep={step}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}

function Shortfall({
  active,
  compact,
}: {
  active: boolean;
  compact: boolean;
}): ReactElement {
  return (
    <div className={styles.chartBody} data-split="wide">
      <figure {...rise(2)} className={`${styles.rise} ${styles.figure}`}>
        <ShortfallChart active={active} compact={compact} />
        <figcaption className={styles.caption}>
          US data center power, 2026–2028, GW. Fixes are probability-weighted;
          midpoint case.
        </figcaption>
      </figure>
      <figure {...rise(3)} className={`${styles.rise} ${styles.figure}`}>
        <ShortfallByYear active={active} compact={compact} />
        <figcaption className={styles.caption}>
          Cumulative net gap, GW. *2029 extends the forecast.
        </figcaption>
      </figure>
    </div>
  );
}

type CitedStat = Stat & { source: string; cite: SourceId };

function policyStats(policy: PolicyMap): CitedStat[] {
  const stats: CitedStat[] = [
    {
      value: String(policy.lawmakerStates),
      label: "States whose lawmakers moved to pause data centers",
      source: "ZODE, from NCSL and state legislatures",
      cite: "ncsl",
    },
  ];
  const { ercotQueueGw: queue, ercotPeakGw: peak } = policy;
  if (queue != null) {
    stats.push({
      value: `${queue} GW`,
      label: peak
        ? `Large loads queued on ERCOT, ${(queue / peak).toFixed(1)}× its record peak`
        : "Large loads queued on ERCOT",
      source: "ERCOT",
      cite: "ercot",
    });
  }
  return stats;
}

const isGate = (key: PolicyKey) => key === "paused" || key === "signoff";

/** Which states hold a measure under a legend entry. */
function holding(state: PolicyState, key: PolicyKey): boolean {
  if (key === "local") return state.localCount > 0;
  if (isGate(key)) return state.grid?.gate === key;
  return state.actions.some((action) => action.status === key);
}

/**
 * The policy map and its legend. A tracked state's tile or a legend entry
 * opens its measures in a panel over the side column (PolicyPanel), which
 * leaves what it covers inert; the same again, its close, Escape or a click
 * on the map's empty ground shuts it, back on what opened it. Turning the
 * slide shuts it too. The lists' local pauses load as the slide comes `near`.
 */
function States({
  active,
  near,
  compact,
  policy,
}: {
  active: boolean;
  near: boolean;
  compact: boolean;
  policy: PolicyMap | null;
}): ReactElement {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [choice, setChoice] = useState<PolicyChoice | null>(null);
  const pauses = useLocalPauses(policy !== null && (near || choice !== null));
  const [shown, setShown] = useState(active);
  if (shown !== active) {
    setShown(active);
    if (!active) setChoice(null);
  }
  const states: PolicyState[] = policy ? Object.values(policy.states) : [];
  const count = (test: (state: PolicyState) => boolean) =>
    states.filter(test).length;
  const rows = LEGEND.map((key) => ({
    key,
    label: LEGEND_LABELS[key],
    n:
      key === "local"
        ? states.reduce((sum, state) => sum + state.localCount, 0)
        : count((state) =>
            isGate(key) ? state.grid?.gate === key : state.status === key,
          ),
  }));
  const lit =
    policy && choice?.key
      ? new Set(
          Object.keys(policy.states).filter((state) =>
            holding(policy.states[state], choice.key),
          ),
        )
      : null;

  const toggle = (next: PolicyChoice) =>
    setChoice((open) =>
      open?.state === next.state && open?.key === next.key ? null : next,
    );
  const covered = Boolean(choice);
  // The opener may sit under the panel, inert until it shuts, so it's focused a frame later.
  const close = () => {
    const opener = rootRef.current?.querySelector<HTMLElement>(
      "[aria-pressed=true]",
    );
    setChoice(null);
    requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
  };
  useEffect(() => {
    if (!choice) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      const opener = rootRef.current?.querySelector<HTMLElement>(
        "[aria-pressed=true]",
      );
      setChoice(null);
      requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choice]);

  return (
    <div ref={rootRef} className={styles.chartBody} data-split="map">
      <figure
        {...rise(2)}
        className={`${styles.rise} ${styles.figure} ${styles.map}`}
        onClick={(event) => {
          if (choice && !(event.target as Element).closest("[role=button]"))
            close();
        }}
      >
        <StateTileMap
          active={active}
          compact={compact}
          policy={policy}
          chosen={choice?.state ?? null}
          lit={lit}
          controls={panelId}
          onChoose={(state) => toggle({ state })}
        />
      </figure>
      <aside className={styles.side} data-open={choice ? "" : undefined}>
        {policy ? (
          <>
            <ul
              {...rise(3)}
              className={`${styles.rise} ${styles.statusList}`}
              inert={covered}
            >
              {rows.map((row) => (
                <li key={row.key}>
                  <button
                    type="button"
                    className={styles.status}
                    data-status={row.key}
                    aria-pressed={choice?.key === row.key}
                    aria-controls={panelId}
                    disabled={!row.n}
                    onClick={() => toggle({ key: row.key })}
                  >
                    <span className={styles.swatch} aria-hidden="true">
                      {row.key === "local" ? "12" : null}
                    </span>
                    <span>{row.label}</span>
                    <span className={styles.count}>{row.n}</span>
                  </button>
                </li>
              ))}
            </ul>
            {choice ? (
              <PolicyPanel
                id={panelId}
                policy={policy}
                pauses={pauses}
                choice={choice}
                onClose={close}
              />
            ) : null}
            <div
              {...rise(4)}
              className={`${styles.rise} ${styles.policyStats}`}
              inert={covered}
            >
              {policyStats(policy).map((item) => (
                <div key={item.label}>
                  <StatBlock stat={item} />
                  <span className={styles.statSource}>
                    <Cited id={item.cite}>{item.source}</Cited>
                  </span>
                </div>
              ))}
            </div>
            <p
              {...rise(6)}
              className={`${styles.rise} ${styles.fine}`}
              inert={covered}
            >
              Both statewide pauses are executive: New York&rsquo;s at 50 MW,
              Texas&rsquo;s at 75 MW for grid hookups.
              {compact ? " Tap" : " Click"} a state or a status for its
              measures, each linked to its source. As of {policy.asOf}.
            </p>
          </>
        ) : (
          <p {...rise(3)} className={`${styles.rise} ${styles.fine}`}>
            The policy tracker can&rsquo;t be read right now, so the map shows
            the states alone.
          </p>
        )}
      </aside>
    </div>
  );
}

function News({ playing }: { playing: boolean }): ReactElement {
  return (
    <div className={styles.newsBody}>
      <div className={styles.newsLead}>
        <div {...rise(2)}>
          <StatBlock stat={BLOCKED} highlight size="xl" />
          <span className={styles.statSource}>
            {BLOCKED.detail} ·{" "}
            <Cited id="dataCenterWatch">Data Center Watch</Cited>
          </span>
        </div>
        <div {...rise(3)} className={`${styles.rise} ${styles.newsTV}`}>
          <MemeTV playing={playing} />
        </div>
      </div>
      <ul className={styles.newsGrid}>
        {NEWS.map((item, i) => (
          <li key={item.url} {...rise(3 + i * 0.5)}>
            <a
              className={styles.newsCard}
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span className={styles.newsPlace}>{item.place}</span>
              <h3 className={styles.h3}>{item.title}</h3>
              <span className={styles.newsSummary}>{item.summary}</span>
              <span className={styles.newsMeta}>
                {item.outlet} · {item.date}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Problem and solution as two columns of cards: down the left each problem
 * as a drawing, its name and one figure; down the right ZODE's answer on the
 * same row, an arrow in the empty column between. The problem that blocks
 * projects outright is drawn in red.
 */
function ProblemSolution({
  slide,
  playing,
}: {
  slide: Of<"problemSolution">;
  playing: boolean;
}): ReactElement {
  return (
    <div className={styles.problemSolution}>
      <div {...rise(1.5)} className={`${styles.rise} ${styles.psHead}`}>
        <p className={styles.label}>{slide.columns[0]}</p>
        <span />
        <p className={styles.label}>{slide.columns[1]}</p>
      </div>
      {slide.rows.map(({ art, hard, problem, solution }, i) => (
        <div key={problem.title} className={styles.psRow}>
          <div
            {...rise(2 + i)}
            className={`${styles.rise} ${styles.psProblem}`}
            data-hard={hard || undefined}
          >
            <div className={styles.psFigure}>
              <MacroArt
                id={art}
                hard={hard}
                light={slide.ground !== "ink"}
                playing={playing}
              />
            </div>
            <div className={styles.psText}>
              <h3 className={styles.h3}>{problem.title}</h3>
              <p className={styles.psStat}>
                <span className={styles.psStatValue}>{problem.stat.value}</span>
                <span className={styles.statLabel}>
                  <Cited id={problem.stat.cite}>{problem.stat.label}</Cited>
                </span>
              </p>
            </div>
          </div>
          <svg
            {...rise(2.25 + i)}
            className={`${styles.rise} ${styles.psArrow}`}
            viewBox="0 0 40 14"
            aria-hidden="true"
          >
            <path d="M1 7H39M32 1l7 6-7 6" />
          </svg>
          <div
            {...rise(2.5 + i)}
            className={`${styles.rise} ${styles.psSolution}`}
          >
            <h3 className={styles.h3}>{solution.title}</h3>
            <p className={styles.body}>{solution.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The problems, two halves split by a page-grid rule as the macro slide:
 * building on the left, community on the right. Each half is a grid of
 * figure cards, as the macro slide's quadrant: its biggest problem as one
 * large card across the top, titled, and the rest captioned in a row below.
 */
function Problems({
  slide,
  playing,
}: {
  slide: Of<"problems">;
  playing: boolean;
}): ReactElement {
  return (
    <div className={styles.problems}>
      {slide.groups.map((group, g) => (
        <section key={group.label} className={styles.problemGroup}>
          <h3 {...rise(1.5 + g)} className={`${styles.rise} ${styles.label}`}>
            {group.label}
          </h3>
          <ul className={styles.problemCards}>
            <li
              {...rise(2 + g)}
              className={`${styles.rise} ${styles.problemCard}`}
              data-lead=""
              data-hard={group.lead.hard || undefined}
            >
              <div className={styles.problemFigure}>
                <MacroArt
                  id={group.lead.art}
                  hard={group.lead.hard}
                  playing={playing}
                />
              </div>
              <div className={styles.problemLead}>
                <p className={`${styles.h3} ${styles.problemTitle}`}>
                  {group.lead.title}
                </p>
                <p className={styles.body}>{group.lead.body}</p>
              </div>
            </li>
            {group.rest.map((card, i) => (
              <li
                key={card.title}
                {...rise(2.5 + g + i * 0.4)}
                className={`${styles.rise} ${styles.problemCard}`}
                data-hard={card.hard || undefined}
              >
                <div className={styles.problemFigure}>
                  <MacroArt id={card.art} hard={card.hard} playing={playing} />
                </div>
                <p className={styles.problemCaption}>{card.title}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Solution({
  slide,
  active,
}: {
  slide: Of<"solution">;
  active: boolean;
}): ReactElement {
  return (
    <div className={styles.solution}>
      <div className={styles.cabinRow}>
        <figure
          className={styles.cabin}
          data-shown={active || undefined}
          style={{ "--ratio": CABIN_VIEW.w / CABIN_VIEW.h } as CSSProperties}
        >
          <div className={styles.cabinArt}>
            <CabinArt pod="compute" active={null} onActive={noop} />
          </div>
          <figcaption className={styles.figLabel}>
            FIG. 01 — ZODE, compute pod
          </figcaption>
        </figure>
        <ul className={styles.facts}>
          {slide.facts.map((fact, i) => (
            <li
              key={fact.label}
              {...rise(3 + i)}
              className={`${styles.rise} ${styles.fact}`}
            >
              <span className={styles.factValue}>{fact.value}</span>
              <span className={styles.factLabel}>{fact.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <NorthAmericaFlags className={styles.solutionFlags} />
    </div>
  );
}

function DesignPrinciples({ active }: { active: boolean }): ReactElement {
  return (
    <div className={styles.designPrinciples}>
      <Principles
        shown={active}
        headingLevel={3}
        className={styles.principles}
      />
    </div>
  );
}

function Stack({
  slide,
  active,
}: {
  slide: Of<"stack">;
  active: boolean;
}): ReactElement {
  return (
    <div
      className={styles.stack}
      style={{ "--ratio": STACK_VIEW.w / STACK_VIEW.h } as CSSProperties}
    >
      <div {...rise(2)} className={`${styles.rise} ${styles.lede}`}>
        {slide.lede.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <StackFigure
        exploded={active}
        side
        className={styles.stackFigure}
      />
    </div>
  );
}

/**
 * Numbered cards as the design principles slide's, a drawing over each phase.
 * Under the phases an ink band, the compute held unsold, draws out to the
 * milestone; past it the last card sells, its channels ranked by price with
 * the highest set on ink.
 */
function Timeline({
  slide,
  playing,
}: {
  slide: Of<"timeline">;
  playing: boolean;
}): ReactElement {
  const { phases, sale } = slide;
  const channels = sale.channels.length;
  return (
    <div className={styles.statsBody}>
      <div className={styles.timeline}>
        {phases.map((phase, i) => (
          <section
            key={phase.title}
            {...rise(2 + i)}
            className={`${styles.rise} ${styles.phase}`}
          >
            <span className={styles.phaseIndex}>{pad(i + 1)}</span>
            <div className={styles.phaseFigure}>
              <MacroArt
                id={phase.art}
                light={slide.ground !== "ink"}
                playing={playing}
              />
            </div>
            <h3 className={`${styles.h3} ${styles.phaseTitle}`}>{phase.title}</h3>
            <p className={styles.body}>{phase.body}</p>
          </section>
        ))}
        <div className={styles.position}>
          <span
            {...rise(2 + phases.length)}
            className={`${styles.rise} ${styles.positionLabel}`}
          >
            {slide.position}
          </span>
        </div>
        <p
          {...rise(3 + phases.length)}
          className={`${styles.rise} ${styles.milestone}`}
        >
          <strong>{slide.milestone.label}</strong> {slide.milestone.detail}
        </p>
        <section
          {...rise(3.5 + phases.length)}
          className={`${styles.rise} ${styles.phase}`}
          data-sale
        >
          <span className={styles.phaseIndex}>{pad(phases.length + 1)}</span>
          <ol className={styles.channels} aria-label="Highest price first">
            {sale.channels.map((channel, i) => (
              <li
                key={channel.title}
                className={styles.channel}
                data-ink={i === 0 || undefined}
              >
                <span className={styles.channelTitle}>{channel.title}</span>
                <span
                  className={styles.planBar}
                  style={{ "--share": (channels - i) / channels } as CSSProperties}
                />
                <span className={styles.channelBody}>{channel.body}</span>
              </li>
            ))}
          </ol>
          <h3 className={`${styles.h3} ${styles.phaseTitle}`}>{sale.title}</h3>
          <p className={styles.body}>{sale.body}</p>
        </section>
      </div>
      <p
        {...rise(5 + phases.length)}
        className={`${styles.rise} ${styles.statement}`}
      >
        {slide.statement.map((line, i) => (
          <Fragment key={line}>
            {i ? " " : null}
            <span className={styles.statementLine}>{line}</span>
          </Fragment>
        ))}
      </p>
    </div>
  );
}

/**
 * The cluster, two halves split by a page-grid rule as the problems slide:
 * its figures as mini-cards on the left, each an isometric icon in a square
 * cell ruled off from its value and label, the revenue set on ink, under a
 * toggle that switches the price figures between the ways the output is
 * sold; on the right the cluster builder's render of it, with the builder and
 * the compute model a new tab away. The render loads once the slide is `near`,
 * as a lazy image in a parked slide never comes into view to load.
 */
function Unit({
  slide,
  playing,
  near,
}: {
  slide: Of<"unit">;
  playing: boolean;
  near: boolean;
}): ReactElement {
  const [mode, setMode] = useState<SaleModeId>(slide.modes[0].id);
  return (
    <div className={styles.unit}>
      <div className={styles.unitSide}>
        <div
          {...rise(2)}
          className={`${styles.rise} ${styles.modes}`}
          role="group"
          aria-label="Figures by how the compute is sold"
        >
          {slide.modes.map((m) => (
            <button
              key={m.id}
              type="button"
              className={styles.mode}
              aria-pressed={m.id === mode}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <ul className={styles.unitCards}>
          {slide.specs.map((spec, i) => {
            const ink = i === slide.highlight;
            const stat = "byMode" in spec ? spec.byMode[mode] : spec;
            return (
              <li
                key={spec.icon}
                {...rise(2 + i * 0.4)}
                className={`${styles.rise} ${styles.unitCard}`}
                data-ink={ink || undefined}
              >
                <div className={styles.unitFigure}>
                  <UnitIcon id={spec.icon} light={!ink} playing={playing} />
                </div>
                <div className={styles.unitText}>
                  <span className={styles.unitValue}>{stat.value}</span>
                  <span className={styles.statLabel}>{stat.label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <figure {...rise(3)} className={`${styles.rise} ${styles.render}`}>
        <div className={styles.renderImage} data-media>
          <Image
            src={slide.image}
            alt="The cluster builder's render of 2,048 B300 GPUs racked in 39 cabinets across four rows"
            fill
            sizes="(max-width: 700px) 100vw, 45vw"
            loading={near ? "eager" : "lazy"}
          />
        </div>
        <figcaption className={styles.renderCaption}>
          <span className={styles.figLabel}>
            FIG. 02 — Cluster builder, 256 nodes · 2,048 B300
          </span>
          <span className={styles.renderLinks}>
            {slide.links.map((link) => (
              <a
                key={link.href}
                className={styles.renderLink}
                href={link.href}
                target="_blank"
                rel="noopener"
              >
                {link.label}
                <ArrowOut />
              </a>
            ))}
          </span>
        </figcaption>
      </figure>
    </div>
  );
}

/** Square slide units every logo covers, its height found from its aspect, so long and compact marks weigh the same. */
const LOGO_AREA = 7;

function LogoMark({
  logo,
  size = 1,
}: {
  logo: Logo;
  /** Scales the mark's area, for one set larger than the logos around it. */
  size?: number;
}): ReactElement {
  const height =
    Math.sqrt((LOGO_AREA * size) / logo.aspect) * (logo.scale ?? 1);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the SVG logos scale with the slide
    <img
      src={logo.src}
      alt={logo.name}
      style={
        {
          "--h": height,
          "--shift": 0.5 - (logo.center ?? 0.5),
        } as CSSProperties
      }
    />
  );
}

/** An arrow up and out of its box, marking a link that opens in a new tab. */
function ArrowOut(): ReactElement {
  return (
    <svg className={styles.renderArrow} viewBox="0 0 10 10" aria-hidden="true">
      <path d="M1.5 8.5 8.5 1.5M3 1.5h5.5V7" />
    </svg>
  );
}

/** An isometric cube's top, left and right faces in a 26 × 30 box. */
const CUBE_FACES = [
  { face: "top", points: "13,0 26,7.5 13,15 0,7.5" },
  { face: "left", points: "0,7.5 13,15 13,30 0,22.5" },
  { face: "right", points: "13,15 26,7.5 26,22.5 13,30" },
] as const;

function Cube(): ReactElement {
  return (
    <svg viewBox="0 0 26 30">
      {CUBE_FACES.map(({ face, points }) => (
        <polygon key={face} data-face={face} points={points} />
      ))}
    </svg>
  );
}

/** A contract value as clusters: one cube per cluster's worth, the last filled to the remainder. */
function ComputeBlocks({
  usd,
  unit,
}: {
  usd: number;
  unit: number;
}): ReactElement {
  const count = usd / unit;
  const full = Math.floor(count);
  const part = count - full;
  return (
    <div className={styles.blocks}>
      <ul className={styles.blockGrid} aria-hidden="true">
        {Array.from({ length: full }, (_, i) => (
          <li key={i} className={styles.block}>
            <Cube />
          </li>
        ))}
        {part > 0.005 ? (
          <li
            className={styles.block}
            data-part
            style={{ "--fill": part } as CSSProperties}
          >
            <Cube />
            <Cube />
          </li>
        ) : null}
      </ul>
      <span className={styles.blockCount}>{count.toFixed(1)} × 4 MW</span>
    </div>
  );
}

function ContractTerms({
  side,
  delay,
}: {
  side: ContractSide;
  delay: number;
}): ReactElement {
  return (
    <section className={styles.contractSide}>
      <h3
        {...rise(delay)}
        className={`${styles.rise} ${styles.figLabel} ${styles.contractTitle}`}
      >
        {side.title}
      </h3>
      <dl className={styles.details}>
        {side.rows.map((row, i) => (
          <div
            key={row.label}
            {...rise(delay + 0.5 + i * 0.4)}
            className={`${styles.rise} ${styles.detail}`}
          >
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * The signed total in a large card and the LOIs in a mini-card under it,
 * each drawn as blocks of one 4 MW cluster's contract value so the two read
 * against each other; the demand side's terms and the supply side's costs
 * on the right; the customers by stage across the foot of the body.
 */
function Traction({ slide }: { slide: Of<"traction"> }): ReactElement {
  return (
    <div className={styles.traction}>
      <div className={styles.split}>
        <div className={styles.contractCards}>
          <div {...rise(2)} className={`${styles.rise} ${styles.contractCard}`}>
            <StatBlock stat={slide.contracted} highlight size="xl" />
            <ComputeBlocks usd={slide.contracted.usd} unit={slide.block.usd} />
          </div>
          <div
            {...rise(2.5)}
            className={`${styles.rise} ${styles.contractCard}`}
            data-size="mini"
          >
            <StatBlock stat={slide.loi} />
            <ComputeBlocks usd={slide.loi.usd} unit={slide.block.usd} />
          </div>
          <p {...rise(3)} className={`${styles.rise} ${styles.fine}`}>
            {slide.block.note}
          </p>
        </div>
        <div className={styles.contractSides}>
          <ContractTerms side={slide.demand} delay={3} />
          <ContractTerms side={slide.supply} delay={5.5} />
        </div>
      </div>
      <div className={styles.customers}>
        {slide.customers.map((group, i) => (
          <div
            key={group.label}
            {...rise(7 + i * 0.5)}
            className={`${styles.rise} ${styles.customerGroup}`}
          >
            <span className={styles.figLabel}>{group.label}</span>
            <ul className={styles.logos}>
              {group.logos.map((logo) => (
                <li key={logo.name}>
                  <LogoMark logo={logo} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The sites as mini-cards down the left, as the unit slide's, grouped under
 * how soon they close: a line map of each city filling a square cell, ruled
 * off from its name, path, status and facility MW, the total under them. On the right the capacity contracted beyond
 * them, then the plan by year, its bars to a linear scale of the largest
 * year's MW; the last year is set on ink.
 */
/** A dollar figure or range, e.g. "$18.8M" or "$50–75M"; split out with its capture so it alternates with the text. */
const FIGURE = /(\$[\d.]+(?:–[\d.]+)?[MB])/;

function Pipeline({ slide }: { slide: Of<"pipeline"> }): ReactElement {
  const steps = slide.plan.length;
  const largest = Math.max(...slide.plan.map((row) => row.mw ?? 0));
  const share = (mw?: number) => (mw === undefined ? 1 : mw / largest);
  return (
    <div className={styles.split} data-split="sites">
      <div className={styles.sites}>
        {slide.groups.map((group, g) => {
          const before = slide.groups
            .slice(0, g)
            .reduce((n, prev) => n + prev.sites.length, 0);
          return (
            <section key={group.label} className={styles.siteGroup}>
              <h3
                {...rise(2 + before * 0.4)}
                className={`${styles.rise} ${styles.siteGroupHead}`}
              >
                {group.label}
                <span>{group.mw} MW</span>
              </h3>
              <ul className={styles.siteCards}>
                {group.sites.map((site, i) => (
                  <li
                    key={`${site.map}-${site.mw}`}
                    {...rise(2 + (before + i) * 0.4)}
                    className={`${styles.rise} ${styles.siteCard}`}
                  >
                    <div className={styles.siteMap}>
                      <SiteMap id={site.map} />
                    </div>
                    <div className={styles.siteText}>
                      <span className={styles.siteName}>{site.site}</span>
                      <span className={styles.statLabel}>
                        {site.path} · {site.status}
                      </span>
                    </div>
                    <span className={styles.siteMw}>
                      {site.mw}
                      <span className={styles.siteUnit}> MW</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <p {...rise(4.5)} className={`${styles.rise} ${styles.siteFoot}`}>
          <span className={styles.siteTotal}>
            Total <span>{slide.total} facility MW</span>
          </span>
        </p>
      </div>
      <div className={styles.pipelineSide}>
        <section {...rise(3)} className={styles.rise}>
          <h3 className={styles.label}>Contracted capacity</h3>
          <div className={styles.capacity}>
            {slide.capacity.map((stat) => (
              <StatBlock key={stat.label} stat={stat} />
            ))}
          </div>
        </section>
        <section className={styles.planSection}>
          <h3 {...rise(4)} className={`${styles.rise} ${styles.label}`}>
            Master Plan · Contracted MW
          </h3>
          <ol className={styles.plan}>
            {slide.plan.map((row, i) => (
              <li
                key={row.year}
                {...rise(4.5 + i * 0.4)}
                className={`${styles.rise} ${styles.planRow}`}
                data-ink={i === steps - 1 || undefined}
              >
                <span className={styles.planYear}>{row.year}</span>
                <span
                  className={styles.planBar}
                  style={{ "--share": share(row.mw) } as CSSProperties}
                />
                <span className={styles.planValue}>{row.value}</span>
              </li>
            ))}
          </ol>
        </section>
        <div
          {...rise(4.5 + steps * 0.4)}
          className={`${styles.rise} ${styles.planNote}`}
        >
          <p className={styles.planStatement}>
            {slide.planNote.map((line) => (
              <span key={line} className={styles.statementLine}>
                {line
                  .split(FIGURE)
                  .map((part, i) =>
                    i % 2 ? <strong key={i}>{part}</strong> : part,
                  )}
              </span>
            ))}
          </p>
          <p className={styles.fine}>{slide.planBasis}</p>
        </div>
      </div>
    </div>
  );
}

function CompareCell({ stat }: { stat: Stat }): ReactElement {
  return (
    <div className={styles.compareCell}>
      <span className={styles.compareValue}>{stat.value}</span>
      <span className={styles.statLabel}>{stat.label}</span>
    </div>
  );
}

/**
 * The comparison as one panel of cells joined by hairlines, as the unit
 * slide's cards: a row per axis, its name, then the traditional developer's
 * answer and ZODE's, ZODE's column set on ink as the unit slide's
 * highlighted card, and the highlighted axis on the paper grey.
 * The rows fade in one by one, their lines too.
 */
function Comparison({ slide }: { slide: Of<"comparison"> }): ReactElement {
  const [lead, ...rest] = slide.note.split(/(?<=\.) /);
  return (
    <div className={styles.compareBody}>
      <table className={styles.compare}>
        <thead>
          <tr {...rise(1.5)}>
            <td />
            <th scope="col">{slide.columns[0]}</th>
            <th scope="col" data-us>
              {/* eslint-disable-next-line @next/next/no-img-element -- the SVG wordmark scales with the slide */}
              <img
                className={styles.compareMark}
                src="/brand/zode-wordmark-white.svg"
                alt={slide.columns[1]}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {slide.rows.map((row, i) => (
            <tr
              key={row.label}
              {...rise(2 + i * 0.35)}
              data-highlight={i === slide.highlight || undefined}
            >
              <th scope="row">{row.label}</th>
              <td>
                <CompareCell stat={row.them} />
              </td>
              <td data-us>
                <CompareCell stat={row.us} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p
        {...rise(2 + slide.rows.length * 0.35)}
        className={`${styles.rise} ${styles.fine}`}
      >
        {lead} <span className={styles.noteRest}>{rest.join(" ")}</span>
      </p>
    </div>
  );
}

/**
 * One MW's stack as rows of equal height, read top to bottom: the compute
 * revenue on ink, then the costs it pays for. Each row is headed by its icon
 * and title, its two halves side by side, each as wide as its share (how the
 * revenue is earned, or how the cost is funded), and its total at the right.
 * The costs' sum closes the stack, the basis in fine print under it.
 */
function Finance({
  slide,
  playing,
}: {
  slide: Of<"finance">;
  playing: boolean;
}): ReactElement {
  const firstCost = slide.rows.findIndex((row) => row.kind === "cost");
  return (
    <div className={styles.finance}>
      <h3 {...rise(1.5)} className={`${styles.rise} ${styles.label}`}>
        {slide.basis}
      </h3>
      <ol className={styles.financeStack} aria-label="Capital stack">
        {slide.rows.map((row, i) => (
          <Fragment key={row.title}>
            {i === firstCost ? (
              <li
                aria-hidden
                {...rise(2 + i * 0.4)}
                className={`${styles.rise} ${styles.financeJoin}`}
              >
                Pays for
              </li>
            ) : null}
            <li
              {...rise(2 + i * 0.4)}
              className={`${styles.rise} ${styles.financeRow}`}
              data-kind={row.kind}
            >
              <div className={styles.financeHead}>
                <div className={styles.financeFigure}>
                  <UnitIcon
                    id={row.icon}
                    light={row.kind === "cost"}
                    playing={playing}
                  />
                </div>
                <div className={styles.financeHeading}>
                  <h4 className={styles.dealTitle}>{row.title}</h4>
                  <span className={styles.statLabel}>{row.purpose}</span>
                </div>
              </div>
              <ol className={styles.financeParts}>
                {row.parts.map((part) => (
                  <li
                    key={part.label}
                    className={styles.financePart}
                    data-part={part.label.toLowerCase()}
                    style={{ "--share": part.share } as CSSProperties}
                  >
                    <span className={styles.financeTag}>
                      {part.label} · {Math.round(part.share * 100)}%
                    </span>
                    <span className={styles.financeValue}>{part.value}</span>
                    <span className={styles.financeDetail}>{part.detail}</span>
                  </li>
                ))}
              </ol>
              <p className={styles.financeTotal}>
                <span className={styles.financeValue}>{row.total}</span>
                <span className={styles.financeTag}>
                  {row.kind === "revenue" ? "Per year" : "Cost"}
                </span>
              </p>
            </li>
          </Fragment>
        ))}
      </ol>
      <div
        {...rise(2 + slide.rows.length * 0.4 + 0.4)}
        className={`${styles.rise} ${styles.financeSum}`}
      >
        <span className={styles.label}>{slide.total.label}</span>
        <span className={styles.financeDetail}>{slide.total.detail}</span>
        <span className={styles.financeValue}>{slide.total.value}</span>
      </div>
      <p
        {...rise(2 + slide.rows.length * 0.4 + 0.8)}
        className={`${styles.rise} ${styles.fine}`}
      >
        {slide.note}
      </p>
    </div>
  );
}

/**
 * The two raises, one SPV a side. Each side opens its model summary in the
 * same modal as the demand slide's details, and Up and Down step between
 * them. Turning the slide shuts it.
 */
function Raise({
  slide,
  playing,
  active,
  compact,
  policy,
}: {
  slide: Of<"raise">;
  playing: boolean;
  active: boolean;
  compact: boolean;
  policy: PolicyMap | null;
}): ReactElement {
  const [detail, setDetail] = useState<Slide | null>(null);
  const [shown, setShown] = useState(active);
  if (shown !== active) {
    setShown(active);
    if (!active) setDetail(null);
  }
  const step = (delta: number) =>
    setDetail((open) => {
      if (!open) return open;
      const at = RAISE_DETAILS.findIndex((item) => item.id === open.id);
      const next = Math.min(
        Math.max(at + delta, 0),
        RAISE_DETAILS.length - 1,
      );
      return RAISE_DETAILS[next];
    });
  return (
    <div className={styles.raise}>
      <ul className={styles.raiseDeals}>
        {slide.deals.map((deal, i) => (
          <li key={deal.id} {...rise(2 + i * 0.4)}>
            <button
              type="button"
              className={styles.raiseDeal}
              aria-haspopup="dialog"
              onClick={() =>
                setDetail(
                  RAISE_DETAILS.find((item) => item.id === deal.id) ?? null,
                )
              }
            >
              <span className={styles.dealHead}>
                <span className={styles.dealFigure}>
                  <UnitIcon id={deal.icon} light playing={playing} />
                </span>
                <span className={styles.dealHeading}>
                  <span className={styles.raiseTitle}>
                    <span className={styles.dealTitle}>{deal.title}</span>
                    <span className={styles.raiseOpen}>
                      Summary
                      <svg
                        className={styles.raisePlus}
                        viewBox="0 0 12 12"
                        aria-hidden="true"
                      >
                        <path d="M6 1v10M1 6h10" />
                      </svg>
                    </span>
                  </span>
                  <span className={styles.raiseOverview}>{deal.overview}</span>
                </span>
              </span>
              <span className={styles.raiseFleet}>
                {deal.fleet.map((stat) => (
                  <span key={stat.label} className={styles.stat}>
                    <span className={styles.statValue}>{stat.value}</span>
                    <span className={styles.statLabel}>{stat.label}</span>
                  </span>
                ))}
              </span>
              <span className={styles.dealStack} role="list" aria-label="Capital stack">
                {deal.layers.map((layer) => (
                  <span
                    key={layer.label}
                    className={`${styles.dealLayer} ${styles.raiseLayer}`}
                    role="listitem"
                    data-kind={layer.kind}
                  >
                    <span className={styles.raiseLayerText}>
                      <span className={styles.dealLayerLabel}>
                        {layer.label}
                      </span>
                      {layer.terms.length > 0 ? (
                        <span className={styles.dealLayerTerms}>
                          {layer.terms.map((term) => (
                            <span key={term}>{term}</span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                    <span className={`${styles.raiseCell} ${styles.raiseValue}`}>
                      {layer.value}
                    </span>
                    <span className={`${styles.raiseCell} ${styles.raiseReturns}`}>
                      {layer.returns}
                    </span>
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <RaiseDisclaimer note={slide.note} />
      {detail ? (
        <DetailModal
          slide={detail}
          compact={compact}
          policy={policy}
          onStep={step}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * The raise's basis and securities legend behind one label, opened as the
 * foot's sources are. Set out in full on paper.
 */
function RaiseDisclaimer({ note }: { note: string }): ReactElement {
  const id = useId();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div
      ref={ref}
      {...rise(3.2)}
      className={`${styles.rise} ${styles.raiseDisclaimer}`}
      data-open={open || undefined}
    >
      <button
        type="button"
        className={styles.sourcesToggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        Disclaimer
      </button>
      <div id={id} className={styles.raisePanel}>
        <div className={styles.raisePanelBox}>
          <p className={styles.fine}>{note}</p>
          <p className={styles.fine}>{RAISE_NOTE}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * One SPV's model: its sites, capital stack and the stored case range.
 * Opened from the raise slide, and printed after it.
 */
function ModelSummary({ slide }: { slide: Of<"model"> }): ReactElement {
  const { cases, aside } = slide;
  return (
    <div className={styles.model}>
      <div {...rise(1.4)} className={`${styles.rise} ${styles.modelGrid}`}>
        <section className={`${styles.modelCell} ${styles.modelSites}`}>
          <div className={styles.modelHead}>
            <h3 className={styles.label}>Sites</h3>
            <p {...rise(2.6)} className={`${styles.rise} ${styles.fine}`}>
              {slide.sitesNote}
            </p>
          </div>
          <ul>
            {slide.sites.map((site, i) => (
              <li key={site.name} {...rise(1.8 + i * 0.15)} className={styles.rise}>
                <span className={styles.modelSiteName}>{site.name}</span>
                <span className={styles.modelSiteFigure}>{site.figure}</span>
                <span className={styles.modelSiteDetail}>{site.detail}</span>
              </li>
            ))}
          </ul>
          {slide.facts.length > 0 ? (
            <dl {...rise(2.6)} className={`${styles.rise} ${styles.modelFacts}`}>
              {slide.facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
        <section className={`${styles.modelCell} ${styles.modelCapital}`}>
          <h3 className={`${styles.label} ${styles.modelHead}`}>Capital</h3>
          <ol
            {...rise(2)}
            className={`${styles.rise} ${styles.dealStack}`}
            aria-label="Capital stack"
          >
            {slide.layers.map((layer) => (
              <li
                key={layer.label}
                className={styles.dealLayer}
                data-kind={layer.kind}
              >
                <span className={styles.raiseLayerText}>
                  <span className={styles.dealLayerLabel}>{layer.label}</span>
                  {layer.terms.length > 0 ? (
                    <span className={styles.dealLayerTerms}>
                      {layer.terms.map((term) => (
                        <span key={term}>{term}</span>
                      ))}
                    </span>
                  ) : null}
                </span>
                <span className={styles.raiseValue}>{layer.value}</span>
              </li>
            ))}
          </ol>
          {slide.stackNote ? (
            <p {...rise(2.4)} className={`${styles.rise} ${styles.fine} ${styles.modelNote}`}>
              {slide.stackNote}
            </p>
          ) : null}
        </section>
        <section className={`${styles.modelCell} ${styles.modelWide}`}>
          <table className={styles.modelCases}>
            <colgroup>
              <col className={styles.modelGroupCol} />
              <col className={styles.modelRowCol} />
              {cases.columns.map((column) => (
                <col key={column} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" colSpan={2}>
                  {cases.label}
                </th>
                {cases.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            {cases.groups.map((group, g) => (
              <tbody key={group.label} {...rise(3 + g * 0.3)} className={styles.rise}>
                {group.rows.map((row, i) => (
                  <tr key={row.label}>
                    {i === 0 ? (
                      <th scope="rowgroup" rowSpan={group.rows.length}>
                        {group.label}
                      </th>
                    ) : null}
                    <th scope="row">{row.label}</th>
                    {row.cells.map((cell, c) => (
                      <td key={cases.columns[c]}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </section>
        {aside ? (
          <section className={`${styles.modelCell} ${styles.modelWide}`}>
            <h3 className={`${styles.label} ${styles.modelHead}`}>{aside.label}</h3>
            <dl {...rise(3.6)} className={`${styles.rise} ${styles.modelAside}`}>
              {aside.rows.map((row) => (
                <div key={row.label}>
                  <dd>{row.value}</dd>
                  <dt>{row.label}</dt>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>
      <p {...rise(3.8)} className={`${styles.rise} ${styles.fine}`}>
        {slide.note}
      </p>
    </div>
  );
}

/** Each network's mark, drawn on a 24-unit square. */
const SOCIAL_MARKS: Record<
  Of<"team">["founder"]["social"][number]["network"],
  string
> = {
  linkedin:
    "M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 4.89v6.25ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z",
};

/** Text that opens its site in a new tab, or plain text without one. */
function OutLink({
  href,
  children,
}: {
  href?: string;
  children: ReactNode;
}): ReactNode {
  if (!href) return children;
  return (
    <a
      className={styles.ventureLink}
      href={href}
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
    </a>
  );
}

const DAY_MS = 86_400_000;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
/** A day's square and the gap after it, in the graph's own units. */
const CELL = 8;
const PITCH = 10;

/**
 * A year of GitHub contributions as GitHub lays them out, a column per week
 * and a row per weekday, shaded in the slide's ink instead of green; each
 * month named over the week it starts in.
 */
function ContributionGraph({ data }: { data: Contributions }): ReactElement {
  const from = Date.parse(`${data.from}T00:00:00Z`);
  const weeks = Math.ceil(data.levels.length / 7);
  const monthOf = (week: number) =>
    new Date(from + week * 7 * DAY_MS).getUTCMonth();
  const months = Array.from({ length: weeks }, (_, w) => w).filter(
    (w) => w === 0 || monthOf(w) !== monthOf(w - 1),
  );
  const total = data.total.toLocaleString("en-US");
  return (
    <figure
      className={styles.contrib}
      style={{ "--weeks": weeks } as CSSProperties}
    >
      <figcaption className={styles.contribHead}>
        <span className={styles.label}>
          {total} GitHub contributions in the last year
        </span>
        <span className={styles.contribKey} aria-hidden="true">
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <i key={level} data-level={level} />
          ))}
          More
        </span>
      </figcaption>
      <div className={styles.contribMonths} aria-hidden="true">
        {months.map((w) => (
          <span key={w} style={{ gridColumnStart: w + 1 }}>
            {MONTHS[monthOf(w)]}
          </span>
        ))}
      </div>
      <svg
        className={styles.contribDays}
        viewBox={`0 0 ${weeks * PITCH - (PITCH - CELL)} ${7 * PITCH - (PITCH - CELL)}`}
        role="img"
        aria-label={`${total} GitHub contributions in the last year`}
      >
        {Array.from(data.levels, (level, day) => (
          <rect
            key={day}
            x={Math.floor(day / 7) * PITCH}
            y={(day % 7) * PITCH}
            width={CELL}
            height={CELL}
            data-level={level}
          />
        ))}
      </svg>
    </figure>
  );
}

/**
 * The founder in the left third, the ventures ruled under the name as main
 * quests, each company's years beside it and its outcome under its role; in
 * the right two thirds a column per area, its key partner over the
 * team and advisors from it.
 */
function Team({ slide }: { slide: Of<"team"> }): ReactElement {
  const { founder, network } = slide;
  return (
    <div className={styles.split} data-split="team">
      <div className={styles.founder}>
        <div {...rise(2)} className={styles.rise}>
          <div className={styles.founderRole}>
            <p className={styles.label}>{founder.role}</p>
            <ul className={styles.social}>
              {founder.social.map((link) => (
                <li key={link.network}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`${founder.name} on ${link.label}`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d={SOCIAL_MARKS[link.network]} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <h3 className={`${styles.h3} ${styles.person}`}>{founder.name}</h3>
        </div>
        <section className={styles.quests}>
          <h4 {...rise(2.6)} className={`${styles.rise} ${styles.figLabel}`}>
            {founder.main.title}
          </h4>
          <ul className={styles.ventures}>
            {founder.main.ventures.map((venture, i) => (
              <li
                key={venture.company}
                {...rise(3 + i * 0.4)}
                className={`${styles.rise} ${styles.venture}`}
              >
                <span className={styles.ventureName}>
                  <OutLink href={venture.href}>{venture.company}</OutLink>
                </span>
                <span className={styles.years}>{venture.years}</span>
                <p className={styles.ventureRole}>{venture.role}</p>
                {venture.outcome && (
                  <p
                    className={`${styles.ventureText} ${styles.ventureOutcome}`}
                  >
                    {venture.outcome}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
        {founder.contributions && (
          <div {...rise(4.6)} className={styles.rise}>
            <ContributionGraph data={founder.contributions} />
          </div>
        )}
      </div>
      <section className={styles.network}>
        {network.areas.map((area, i) => (
          <div
            key={area.label}
            {...rise(3.5 + i * 0.4)}
            className={`${styles.rise} ${styles.networkArea}`}
          >
            <h3 className={styles.networkLabel}>{area.label}</h3>
            <div className={styles.partner}>
              <span className={styles.label}>{network.partnerLabel}</span>
              <div className={`${styles.logos} ${styles.partnerMark}`}>
                <LogoMark logo={area.partner} size={1.6} />
              </div>
            </div>
            <span className={`${styles.label} ${styles.networkTitle}`}>
              {network.title}
            </span>
            <ul className={styles.logos}>
              {area.logos.map((logo) => (
                <li key={logo.name}>
                  <LogoMark logo={logo} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

function Close({ slide }: { slide: Of<"close"> }): ReactElement {
  return (
    <div className={styles.close}>
      <h2
        {...rise(1)}
        className={`${styles.rise} ${styles.display} ${styles.closeTitle}`}
      >
        {slide.title}
      </h2>
      <p {...rise(2)} className={`${styles.rise} ${styles.coverLede}`}>
        {slide.lede}
      </p>
      <div {...rise(3)} className={`${styles.rise} ${styles.actions}`}>
        <Link
          className={styles.primary}
          href="/talk-to-an-engineer"
          scroll={false}
        >
          Talk to an engineer
        </Link>
        <Link className={styles.secondary} href="/buy-compute">
          Buy compute
        </Link>
      </div>
      <p {...rise(4)} className={`${styles.rise} ${styles.meta}`}>
        <a href="mailto:hello@zode.org">{slide.contact}</a>
      </p>
    </div>
  );
}

type SourceGroup = "Demand and supply" | "Policy" | "Cost and valuation";

/** Every source's heading on the sources slide, which lists it once a slide cites it. */
const SOURCE_GROUP: Readonly<Record<SourceId, SourceGroup>> = {
  bnef: "Demand and supply",
  utilityDive: "Demand and supply",
  epri: "Demand and supply",
  morganStanley: "Demand and supply",
  cbre: "Demand and supply",
  jll: "Demand and supply",
  capex: "Demand and supply",
  zodePricing: "Demand and supply",
  googleTokens: "Demand and supply",
  goldmanTokens: "Demand and supply",
  ncsl: "Policy",
  newYork: "Policy",
  texas: "Policy",
  oregon: "Policy",
  ercot: "Policy",
  eei: "Policy",
  moratoriumNation: "Policy",
  dataCenterWatch: "Policy",
  heatmap: "Policy",
  transformers: "Policy",
  cushmanCost: "Cost and valuation",
  evPerMw: "Cost and valuation",
};

const CITED = new Set(
  [...SLIDES, ...DEMAND_DETAILS].flatMap((slide) => slide.sources ?? []),
);

/** A group's cited sources, in the order SOURCE_GROUP lists them. */
const citedIn = (group: SourceGroup): SourceId[] =>
  (Object.keys(SOURCE_GROUP) as SourceId[]).filter(
    (id) => CITED.has(id) && SOURCE_GROUP[id] === group,
  );

function Citations({ ids }: { ids: readonly SourceId[] }): ReactElement {
  return (
    <ol className={styles.citations}>
      {ids.map((id) => {
        const source: Source = SOURCES[id];
        return (
          <li key={id}>
            <span className={styles.citePublisher}>{source.publisher}</span>{" "}
            {source.url ? (
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.title}
              </a>
            ) : (
              source.title
            )}
            , {source.date}
            {source.via ? ` (${source.via})` : null}.
          </li>
        );
      })}
    </ol>
  );
}

function Sources(): ReactElement {
  return (
    <div className={styles.sourcesBody}>
      <div {...rise(2)} className={styles.rise}>
        <h3 className={styles.label}>Demand and supply</h3>
        <Citations ids={citedIn("Demand and supply")} />
      </div>
      <div {...rise(3)} className={styles.rise}>
        <h3 className={styles.label}>Policy</h3>
        <Citations ids={citedIn("Policy")} />
        <p className={styles.fine}>
          As of {AS_OF}. Each state and local measure on the policy map links to
          its own source. The dashed grid line on the demand chart is
          ZODE&rsquo;s illustration, not a third-party forecast. Pipeline,
          contract and financing figures are ZODE&rsquo;s own and preliminary
          where noted.
        </p>
      </div>
      <div {...rise(4)} className={styles.rise}>
        <h3 className={styles.label}>News</h3>
        <ol className={styles.citations}>
          {NEWS.map((item) => (
            <li key={item.url}>
              <span className={styles.citePublisher}>{item.outlet}</span>{" "}
              <a href={item.url} target="_blank" rel="noreferrer noopener">
                {item.headline}
              </a>
              , {item.date}.
            </li>
          ))}
        </ol>
        <h3 className={`${styles.label} ${styles.citationsNext}`}>
          Cost and valuation
        </h3>
        <Citations ids={citedIn("Cost and valuation")} />
      </div>
    </div>
  );
}

function Body({
  slide,
  active,
  playing,
  near,
  compact,
  policy,
}: {
  slide: Slide;
  active: boolean;
  playing: boolean;
  near: boolean;
  compact: boolean;
  policy: PolicyMap | null;
}): ReactNode {
  switch (slide.kind) {
    case "cover":
      return <Cover slide={slide} active={active} />;
    case "stats":
      return (
        <Stats
          slide={slide}
          active={active}
          playing={playing}
          compact={compact}
        />
      );
    case "demand":
      return <Demand active={active} compact={compact} policy={policy} />;
    case "shortfall":
      return <Shortfall active={active} compact={compact} />;
    case "states":
      return (
        <States active={active} near={near} compact={compact} policy={policy} />
      );
    case "news":
      return <News playing={playing} />;
    case "problemSolution":
      return <ProblemSolution slide={slide} playing={playing} />;
    case "problems":
      return <Problems slide={slide} playing={playing} />;
    case "solution":
      return <Solution slide={slide} active={active} />;
    case "principles":
      return <DesignPrinciples active={active} />;
    case "stack":
      return <Stack slide={slide} active={active} />;
    case "timeline":
      return <Timeline slide={slide} playing={playing} />;
    case "unit":
      return <Unit slide={slide} playing={playing} near={near} />;
    case "traction":
      return <Traction slide={slide} />;
    case "pipeline":
      return <Pipeline slide={slide} />;
    case "comparison":
      return <Comparison slide={slide} />;
    case "finance":
      return <Finance slide={slide} playing={playing} />;
    case "raise":
      return (
        <Raise
          slide={slide}
          playing={playing}
          active={active}
          compact={compact}
          policy={policy}
        />
      );
    case "model":
      return <ModelSummary slide={slide} />;
    case "team":
      return <Team slide={slide} />;
    case "close":
      return <Close slide={slide} />;
    case "sources":
      return <Sources />;
  }
}

/** Slides that lay out their own title, without the head band. */
const NO_HEAD = new Set<Slide["kind"]>(["cover", "close"]);
/** And the close runs full bleed with the rails alone; the cover keeps its foot band for the company line. */
const NO_FOOT = new Set<Slide["kind"]>(["close"]);

export const hasHead = (slide: Slide): boolean => !NO_HEAD.has(slide.kind);

/**
 * A slide's sources, folded behind a label at the foot: hovering or focusing
 * it opens them above, and a click pins them open where there's no hover.
 * Printed, they set out in the foot in full.
 */
function FootSources({ ids }: { ids: readonly SourceId[] }): ReactElement {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.footSources} data-open={open || undefined}>
      <button
        type="button"
        className={styles.sourcesToggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        Sources
      </button>
      <div id={id} className={styles.sourcesPanel}>
        <SourceLine ids={ids} />
      </div>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A phone page is laid out this many pixels wide, then scaled to the screen, up to `MAX_FIT` on a tablet. */
const PHONE_W = 390;
const MAX_FIT = 1.6;

/**
 * Scales a phone page (`compact`) to fit its slide, every page as wide as
 * the screen (`--fit-wide`), so the rails hold still from page to page.
 * Where its bands would then run past the header band or the foot (the
 * frame's padding), it shrinks to their height (`--fit`) and is laid out
 * wider by as much, so it still spans the screen. A band marked
 * `data-deck-scroll` takes what room is left and scrolls, so it isn't
 * counted. Slide.module.css scales by both. A parked slide has no layout, so
 * it's measured as it opens.
 */
function useFit(on: boolean) {
  const slideRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const slide = slideRef.current;
    const fit = fitRef.current;
    const frame = fit?.parentElement;
    if (!on || !slide || !fit || !frame) return;
    const bands = () => [...fit.children] as HTMLElement[];
    // Sizes as last laid out, so the observer passes over the resize the widening itself makes.
    const sizes = () =>
      [slide.clientWidth, slide.clientHeight]
        .concat(bands().map((band) => band.offsetHeight))
        .join();
    const height = () =>
      bands().reduce(
        (sum, band) =>
          band.hasAttribute("data-deck-scroll") ? sum : sum + band.offsetHeight,
        0,
      );
    const lay = (scale: number, wide: number) => {
      slide.style.setProperty("--fit", scale.toFixed(4));
      if (scale < wide)
        fit.style.width = `${((PHONE_W * wide) / scale).toFixed(2)}px`;
      else fit.style.removeProperty("width");
    };
    let laidOut = "";
    const measure = () => {
      if (sizes() === laidOut) return;
      const wide = Math.min(slide.clientWidth / PHONE_W, MAX_FIT);
      if (!wide) return;
      slide.style.setProperty("--fit-wide", wide.toFixed(4));
      lay(wide, wide);
      const { paddingTop, paddingBottom } = getComputedStyle(frame);
      const room =
        slide.clientHeight - parseFloat(paddingTop) - parseFloat(paddingBottom);
      let tall = height();
      if (!tall) return;
      let scale = Math.min(wide, room / tall);
      // A page's drawings and some type grow with its width, so widening can leave it taller; it shrinks again until it fits.
      for (let pass = 0; scale < wide; pass++) {
        lay(scale, wide);
        tall = height();
        if (tall * scale <= room + 0.5 || pass === 5) break;
        scale *= room / (tall * scale);
      }
      laidOut = sizes();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slide);
    for (const band of fit.children) observer.observe(band);
    return () => {
      observer.disconnect();
      fit.style.removeProperty("width");
      slide.style.removeProperty("--fit");
      slide.style.removeProperty("--fit-wide");
    };
  }, [on]);
  return { slideRef, fitRef };
}

/**
 * One 16:9 slide. Everything is sized in container units of the stage, so a
 * slide reads the same full-screen, in the overview and on a printed page.
 * Content slides share one page grid: a head band with the title, the body,
 * and a foot band with the section name, sources and page number.
 * `grid` draws the rails and rules on the slide itself; the stage turns it
 * off and draws one shared grid over every slide instead, finding the bands
 * by `data-band`. `active` plays its entrance; with `still` too it shows
 * settled instead, its entrances at their end and nothing looping, as a
 * thumbnail. `playing` runs its looping drawings, by default while it's
 * active and not still. `near` loads its images ahead, for the open slide
 * and its neighbours. `branded` adds the wordmark to its foot for print,
 * where the site header isn't on the page. `compact` makes it a phone page:
 * one column at the site's mobile type sizes, laid out `PHONE_W` wide and
 * scaled to fit the screen (`useFit`). `policy` is the policy tracker's map
 * for the states slide.
 * `numbered` sets the page number in its foot; a slide off the sequence (the
 * demand slide's details) goes without. Memoized, so turning a slide redraws
 * only the slides whose state changed.
 */
export const SlideView = memo(function SlideView({
  slide,
  index,
  total,
  active,
  still = false,
  playing = active && !still,
  near = false,
  branded = false,
  grid = true,
  compact = false,
  numbered = true,
  policy,
}: {
  slide: Slide;
  index: number;
  total: number;
  active: boolean;
  still?: boolean;
  playing?: boolean;
  near?: boolean;
  branded?: boolean;
  grid?: boolean;
  compact?: boolean;
  numbered?: boolean;
  policy: PolicyMap | null;
}): ReactElement {
  const head = hasHead(slide);
  const foot = !NO_FOOT.has(slide.kind);
  const dark = slide.ground === "ink";
  const { slideRef, fitRef } = useFit(compact);
  const mark = branded ? (
    // eslint-disable-next-line @next/next/no-img-element -- the SVG wordmark scales with the slide
    <img
      className={styles.footMark}
      src={
        dark
          ? "/brand/zode-wordmark-white.svg"
          : "/brand/zode-wordmark-black.svg"
      }
      alt="ZODE"
    />
  ) : null;
  const bands = (
    <>
      {head ? (
        <header className={styles.head} data-band="head">
          <h2 {...rise(1)} className={`${styles.rise} ${styles.title}`}>
            {slide.title}
          </h2>
        </header>
      ) : null}
      <div
        className={styles.main}
        data-deck-scroll={(compact && slide.kind === "sources") || undefined}
      >
        <Body
          slide={slide}
          active={active}
          playing={playing}
          near={near}
          compact={compact}
          policy={policy}
        />
      </div>
      {!foot ? (
        mark && <footer className={styles.foot}>{mark}</footer>
      ) : (
        <footer className={styles.foot} data-band="foot">
          {head ? (
            <span className={styles.sectionName} data-band="name">
              {slide.eyebrow}
            </span>
          ) : null}
          {slide.kind === "cover" ? (
            <p className={styles.footLabel}>
              {slide.meta} · {slide.eyebrow}
            </p>
          ) : null}
          <div className={styles.footEnd}>
            {slide.sources ? <FootSources ids={slide.sources} /> : null}
            {numbered ? (
              <span className={styles.number}>
                {pad(index + 1)} / {pad(total)}
              </span>
            ) : null}
            {slide.kind === "cover" ? null : mark}
          </div>
        </footer>
      )}
    </>
  );
  return (
    <div
      ref={slideRef}
      className={styles.slide}
      data-ground={slide.ground}
      data-kind={slide.kind}
      data-active={active || undefined}
      data-still={still || undefined}
      data-compact={compact || undefined}
    >
      <div
        className={styles.frame}
        data-frame=""
        data-grid={grid || undefined}
        data-head={head || undefined}
        data-foot={foot || undefined}
      >
        {compact ? (
          <div ref={fitRef} className={styles.fit}>
            {bands}
          </div>
        ) : (
          bands
        )}
      </div>
    </div>
  );
});
