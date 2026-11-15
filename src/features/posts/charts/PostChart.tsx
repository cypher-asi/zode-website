"use client";

import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { AGENT_KERNELS, B300_INDEX, COMPUTE_POSITION, CREDIT_REPRICING, ROADMAP, type Source } from "./data";
import styles from "./PostChart.module.css";

/*
 * Charts a post embeds with a fenced block in its Markdown:
 *
 *   ```chart
 *   compute-position
 *   ```
 *
 * Drawn in HTML and CSS rather than a scaled SVG, so the type stays at the
 * article's size from a phone to the full column. Every mark has a tooltip:
 * hover it with a mouse, tap it on a touch screen, or tab to it and (on the
 * line chart) move along it with the arrow keys.
 */

/** What a tooltip says: a title, label/value rows, and an optional line of context. */
interface Tip {
  title: string;
  rows: (readonly [string, string])[];
  note?: string;
}

/** Where a tooltip points, in client coordinates: a point on top of the mark, and the mark's bottom edge. */
interface Anchor {
  x: number;
  top: number;
  bottom: number;
}

interface Shown {
  key: string;
  x: number;
  y: number;
  below: boolean;
  side: "start" | "center" | "end";
  tip: Tip;
}

interface Tips {
  /** The tooltip's element id, for the active mark's `aria-describedby`. */
  id: string;
  /** Key of the mark whose tooltip is showing, unique within its figure. */
  active: string | null;
  show: (key: string, anchor: Anchor, tip: Tip) => void;
  /** Hides the tooltip, or only the given mark's when a key is passed. */
  hide: (key?: string) => void;
}

const TipContext = createContext<Tips>({ id: "", active: null, show: () => {}, hide: () => {} });

/** Room a tooltip needs above its mark before it flips below it. */
const ROOM_ABOVE = 110;

function Figure({
  title,
  subtitle,
  sources,
  children,
}: {
  title: string;
  subtitle?: string;
  sources: Source[];
  children: ReactNode;
}): ReactElement {
  const figure = useRef<HTMLElement>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const id = useId();
  const open = shown !== null;

  // A tap outside the figure closes a tooltip opened by touch.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: globalThis.PointerEvent) => {
      if (!figure.current?.contains(event.target as Node)) setShown(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const tips: Tips = {
    id,
    active: shown?.key ?? null,
    show(key, anchor, tip) {
      const box = figure.current?.getBoundingClientRect();
      if (!box) return;
      const x = anchor.x - box.left;
      const below = anchor.top - box.top < ROOM_ABOVE;
      const side = x > box.width * 0.62 ? "end" : x < box.width * 0.38 ? "start" : "center";
      setShown({ key, x, y: (below ? anchor.bottom : anchor.top) - box.top, below, side, tip });
    },
    hide(key) {
      setShown((current) => (key === undefined || current?.key === key ? null : current));
    },
  };

  return (
    <TipContext.Provider value={tips}>
      <figure ref={figure} className={styles.figure}>
        <div className={styles.head}>
          <p className={styles.title}>{title}</p>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {children}
        {sources.length ? (
          <figcaption className={styles.sources}>
            Sources:{" "}
            {sources.map((source, i) => (
              <Fragment key={source.href}>
                {i ? "; " : ""}
                <a href={source.href} target="_blank" rel="noreferrer noopener">
                  {source.label}
                </a>
              </Fragment>
            ))}
          </figcaption>
        ) : null}
        {shown ? (
          <div
            id={id}
            role="tooltip"
            className={styles.tip}
            data-side={shown.side}
            data-below={shown.below || undefined}
            style={{ left: shown.x, top: shown.y }}
          >
            <p className={styles.tipTitle}>{shown.tip.title}</p>
            {shown.tip.rows.map(([label, value]) => (
              <p key={label} className={styles.tipRow}>
                <span>{label}</span>
                <span>{value}</span>
              </p>
            ))}
            {shown.tip.note ? <p className={styles.tipNote}>{shown.tip.note}</p> : null}
          </div>
        ) : null}
      </figure>
    </TipContext.Provider>
  );
}

/**
 * Props that give a mark its tooltip. The tooltip points at the mark's
 * `[data-anchor]` child: its end for "end", its middle otherwise.
 */
function useTipTarget(): (key: string, tip: Tip) => Record<string, unknown> {
  const tips = useContext(TipContext);
  return (key, tip) => {
    const show = (target: HTMLElement) => {
      const anchor = target.querySelector<HTMLElement>("[data-anchor]") ?? target;
      const box = anchor.getBoundingClientRect();
      const x = anchor.dataset.anchor === "end" ? box.right : box.left + box.width / 2;
      tips.show(key, { x, top: box.top, bottom: box.bottom }, tip);
    };
    const active = tips.active === key;
    return {
      tabIndex: 0,
      "data-active": active || undefined,
      "aria-describedby": active ? tips.id : undefined,
      onPointerEnter: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse") show(event.currentTarget);
      },
      onPointerLeave: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse") tips.hide(key);
      },
      // Touch and pen have no hover, so a tap toggles the tooltip.
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse") return;
        if (active) tips.hide(key);
        else show(event.currentTarget);
      },
      onFocus: (event: FocusEvent<HTMLElement>) => {
        if (event.currentTarget.matches(":focus-visible")) show(event.currentTarget);
      },
      onBlur: () => tips.hide(key),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape") tips.hide(key);
      },
    };
  };
}

interface Bar {
  label: string;
  detail?: string;
  value: number;
  shown: string;
  accent?: boolean;
  tip: Tip;
}

/** Horizontal bars from zero to `max`, with an optional marker line across them. */
function Bars({ rows, max, marker }: { rows: Bar[]; max: number; marker?: { at: number; label: string } }): ReactElement {
  const { active } = useContext(TipContext);
  const target = useTipTarget();
  const pct = (n: number) => `${Math.min(Math.max(n / max, 0), 1) * 100}%`;
  return (
    <ul
      className={styles.bars}
      data-has-active={rows.some((row) => row.label === active) || undefined}
      style={marker ? ({ "--marker": pct(marker.at) } as CSSProperties) : undefined}
    >
      {rows.map((row) => (
        <li key={row.label} className={styles.row} {...target(row.label, row.tip)}>
          <span className={styles.rowLabel}>
            {row.label}
            {row.detail ? <span className={styles.rowDetail}>{row.detail}</span> : null}
          </span>
          <span className={styles.track} data-marker={marker ? "" : undefined}>
            <span
              className={styles.bar}
              data-anchor="end"
              data-accent={row.accent || undefined}
              style={{ width: pct(row.value) }}
            />
          </span>
          <span className={styles.rowValue}>{row.shown}</span>
        </li>
      ))}
      {marker ? (
        <li className={styles.markerRow} aria-hidden="true">
          <span />
          <span className={styles.markerLabel}>{marker.label}</span>
          <span />
        </li>
      ) : null}
    </ul>
  );
}

const percent = (n: number) => `${Math.round(n * 100)}%`;
/** Billions of USD, e.g. "$38.7B" or "$1.40T". */
const usd = (billions: number) => (billions >= 1000 ? `$${(billions / 1000).toFixed(2)}T` : `$${+billions.toFixed(1)}B`);
const signed = (n: number, text: string) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${text}`;

function ComputePosition(): ReactElement {
  const rows = (side: "long" | "short"): Bar[] =>
    COMPUTE_POSITION[side].map((c) => ({
      label: c.name,
      detail: c.note,
      value: c.contracted / c.value,
      shown: percent(c.contracted / c.value),
      accent: side === "long",
      tip: {
        title: `${c.name}: ${side === "long" ? "bought forward" : "sold forward"}`,
        rows: [
          [side === "long" ? "Compute committed" : "Contracts sold", usd(c.contracted)],
          [side === "long" ? "Valuation" : "Market cap", usd(c.value)],
          ["Share of value", percent(c.contracted / c.value)],
        ],
        note:
          side === "long"
            ? "Keeps whatever the contracted hours turn out to be worth."
            : "Has sold the hours at a fixed rate and carries the GPUs and debt.",
      },
    }));
  return (
    <Figure
      title="Compute contracted forward, as a share of what each company is worth"
      subtitle="The labs have bought compute forward; the neoclouds have sold it forward at fixed rates."
      sources={COMPUTE_POSITION.sources}
    >
      <p className={styles.group}>Bought forward: long compute</p>
      <Bars rows={rows("long")} max={5} />
      <p className={styles.group}>Sold forward: short compute</p>
      <Bars rows={rows("short")} max={5} />
    </Figure>
  );
}

function CreditRepricing(): ReactElement {
  return (
    <Figure
      title="The debt behind the short side is repricing"
      subtitle="Cents below par. Investment-grade paper from the long side still prices at par."
      sources={CREDIT_REPRICING.sources}
    >
      <Bars
        max={20}
        rows={CREDIT_REPRICING.bonds.map((bond) => {
          const rows: [string, string][] = [
            ["Price", `${bond.below ? "under " : ""}${+bond.price.toFixed(3)}c`],
            ["Below par", `${bond.below ? "over " : ""}${+(100 - bond.price).toFixed(2)}c`],
          ];
          if (bond.yieldPct) rows.push(["Yield", `${bond.yieldPct.toFixed(2)}%`]);
          return {
            label: bond.name,
            detail: bond.yieldPct ? `${bond.detail}, ${bond.yieldPct.toFixed(2)}% yield` : bond.detail,
            value: 100 - bond.price,
            shown: bond.price >= 99.99 ? "par" : `${bond.below ? "under " : ""}${+bond.price.toFixed(1)}c`,
            accent: bond.name.startsWith("CoreWeave"),
            tip: { title: bond.name, rows, note: bond.detail },
          };
        })}
      />
    </Figure>
  );
}

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function B300Index(): ReactElement {
  const tips = useContext(TipContext);
  const plot = useRef<HTMLDivElement>(null);
  const readings = B300_INDEX.readings;
  const [lo, hi] = [6.5, 8];
  const W = 600;
  const H = 200;
  const x = (i: number) => (i / (readings.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const top = (v: number) => `${((hi - v) / (hi - lo)) * 100}%`;
  const left = (i: number) => `${(i / (readings.length - 1)) * 100}%`;
  const points = readings.map(([, v], i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const [first, last] = [readings[0], readings[readings.length - 1]];
  const change = last[1] / first[1] - 1;
  const date = (iso: string) => monthDay.format(new Date(`${iso}T00:00:00Z`));

  const active = tips.active === null ? null : Number(tips.active);

  function showAt(i: number) {
    const box = plot.current?.getBoundingClientRect();
    if (!box) return;
    const [day, price] = readings[i];
    const rows: [string, string][] = [["Price", `$${price.toFixed(2)} / GPU-hr`]];
    if (i > 0) {
      const delta = price - readings[i - 1][1];
      rows.push(["Day change", signed(delta, `$${Math.abs(delta).toFixed(2)}`)]);
    }
    const since = price / first[1] - 1;
    if (i > 0) rows.push([`Since ${date(first[0])}`, signed(since, `${Math.abs(since * 100).toFixed(1)}%`)]);
    const pointY = box.top + ((hi - price) / (hi - lo)) * box.height;
    tips.show(
      String(i),
      { x: box.left + (i / (readings.length - 1)) * box.width, top: pointY, bottom: pointY },
      { title: fullDate.format(new Date(`${day}T00:00:00Z`)), rows },
    );
  }

  function indexAt(clientX: number): number | null {
    const box = plot.current?.getBoundingClientRect();
    if (!box || !box.width) return null;
    const ratio = Math.min(Math.max((clientX - box.left) / box.width, 0), 1);
    return Math.round(ratio * (readings.length - 1));
  }

  function onPointer(event: PointerEvent<HTMLDivElement>) {
    // Touch shows the reading under a tap; mouse and pen follow the pointer.
    if (event.type === "pointermove" && event.pointerType === "touch") return;
    const i = indexAt(event.clientX);
    if (i !== null && i !== active) showAt(i);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = active ?? readings.length - 1;
    const next =
      event.key === "ArrowLeft"
        ? Math.max(current - 1, 0)
        : event.key === "ArrowRight"
          ? Math.min(current + 1, readings.length - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? readings.length - 1
              : null;
    if (event.key === "Escape") tips.hide();
    if (next === null) return;
    event.preventDefault();
    showAt(next);
  }

  return (
    <Figure
      title="Meanwhile, the asset keeps getting more valuable"
      subtitle={`B300 rental price, USD per GPU-hour: up ${percent(change)} in a month.`}
      sources={B300_INDEX.sources}
    >
      <div
        ref={plot}
        className={styles.plot}
        tabIndex={0}
        role="img"
        aria-label={`B300 rental index rose from $${first[1].toFixed(2)} on ${date(first[0])} to $${last[1].toFixed(2)} on ${date(last[0])}. Use the arrow keys to read each day.`}
        aria-describedby={active === null ? undefined : tips.id}
        data-active={active === null ? undefined : ""}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") tips.hide();
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) showAt(active ?? readings.length - 1);
        }}
        onBlur={() => tips.hide()}
        onKeyDown={onKeyDown}
      >
        {[7, 7.5].map((v) => (
          <span key={v} className={styles.gridLine} style={{ top: top(v) }}>
            <span className={styles.gridLabel}>${v.toFixed(2)}</span>
          </span>
        ))}
        {active !== null ? <span className={styles.cursor} style={{ left: left(active) }} /> : null}
        <svg className={styles.line} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline points={points} />
        </svg>
        <span className={styles.point} style={{ left: "0%", top: top(first[1]) }} />
        <span className={styles.point} data-accent="" style={{ left: "100%", top: top(last[1]) }} />
        {active !== null ? (
          <span
            className={styles.point}
            data-hover=""
            style={{ left: left(active), top: top(readings[active][1]) }}
          />
        ) : null}
        <span className={styles.pointLabel} style={{ left: "0%", top: top(first[1]) }}>
          ${first[1].toFixed(2)}
        </span>
        <span className={styles.pointLabel} data-end="" style={{ left: "100%", top: top(last[1]) }}>
          ${last[1].toFixed(2)}
        </span>
      </div>
      <p className={styles.axis}>
        <span>{date(first[0])}</span>
        <span>{date(last[0])}</span>
      </p>
    </Figure>
  );
}

function AgentKernels(): ReactElement {
  return (
    <Figure
      title="Kernels written by AI agents, against the best human or vendor baseline"
      subtitle="Speed relative to the baseline each was measured against."
      sources={AGENT_KERNELS.sources}
    >
      <Bars
        max={2}
        marker={{ at: 1, label: "Baseline" }}
        rows={AGENT_KERNELS.results.map((r, i) => ({
          label: r.name,
          detail: r.detail,
          value: r.speedup,
          shown: `${r.speedup.toFixed(2)}×`,
          accent: i === 0,
          tip: {
            title: r.name,
            rows: [
              ["Speed vs baseline", `${r.speedup.toFixed(2)}×`],
              ["Faster by", `${Math.round((r.speedup - 1) * 100)}%`],
            ],
            note: r.detail,
          },
        }))}
      />
    </Figure>
  );
}

function Roadmap(): ReactElement {
  const { active } = useContext(TipContext);
  const target = useTipTarget();
  const height = (mw: number) => `${((Math.log10(mw) + 1) / (Math.log10(1000) + 1)) * 100}%`;
  return (
    <Figure
      title="What we have to prove, in megawatts"
      subtitle="Each stage funds and de-risks the next. Log scale."
      sources={[]}
    >
      <ol className={styles.steps} data-has-active={active !== null || undefined}>
        {ROADMAP.map((step, i) => {
          const letter = String.fromCharCode(97 + i);
          const rows: [string, string][] = [["Capacity", step.label]];
          if (i > 0) rows.push(["Step up", `${+(step.mw / ROADMAP[i - 1].mw).toFixed(1)}× stage ${String.fromCharCode(96 + i)}`]);
          if (i > 1) rows.push(["From the first MW", `${step.mw / ROADMAP[0].mw}×`]);
          return (
            <li
              key={step.label}
              className={styles.step}
              {...target(step.label, { title: `${letter}. ${step.stage}`, rows, note: step.detail })}
            >
              <span className={styles.stepCol}>
                <span
                  className={styles.stepBar}
                  data-anchor="center"
                  data-accent={i === 0 || undefined}
                  style={{ height: height(step.mw) }}
                >
                  <span className={styles.stepValue}>{step.label}</span>
                </span>
              </span>
              <span className={styles.stepStage}>
                {letter}. {step.stage}
              </span>
              <span className={styles.stepDetail}>{step.detail}</span>
            </li>
          );
        })}
      </ol>
    </Figure>
  );
}

const CHARTS: Record<string, () => ReactElement> = {
  "compute-position": ComputePosition,
  "credit-repricing": CreditRepricing,
  "b300-index": B300Index,
  "agent-kernels": AgentKernels,
  roadmap: Roadmap,
};

/** The chart a post names, or nothing for a name this build doesn't know. */
export const isChart = (name: string): boolean => Object.hasOwn(CHARTS, name);

export function PostChart({ name }: { name: string }): ReactElement | null {
  const Chart = Object.hasOwn(CHARTS, name) ? CHARTS[name] : undefined;
  return Chart ? <Chart /> : null;
}
