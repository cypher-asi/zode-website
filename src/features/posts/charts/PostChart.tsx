import { Fragment, type CSSProperties, type ReactElement, type ReactNode } from "react";
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
 * article's size from a phone to the full column.
 */

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
  return (
    <figure className={styles.figure}>
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
    </figure>
  );
}

interface Bar {
  label: string;
  detail?: string;
  value: number;
  shown: string;
  accent?: boolean;
}

/** Horizontal bars from zero to `max`, with an optional marker line across them. */
function Bars({ rows, max, marker }: { rows: Bar[]; max: number; marker?: { at: number; label: string } }): ReactElement {
  const pct = (n: number) => `${Math.min(Math.max(n / max, 0), 1) * 100}%`;
  return (
    <ul className={styles.bars} style={marker ? ({ "--marker": pct(marker.at) } as CSSProperties) : undefined}>
      {rows.map((row) => (
        <li key={row.label} className={styles.row}>
          <span className={styles.rowLabel}>
            {row.label}
            {row.detail ? <span className={styles.rowDetail}>{row.detail}</span> : null}
          </span>
          <span className={styles.track} data-marker={marker ? "" : undefined}>
            <span className={styles.bar} data-accent={row.accent || undefined} style={{ width: pct(row.value) }} />
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

function ComputePosition(): ReactElement {
  const rows = (side: "long" | "short"): Bar[] =>
    COMPUTE_POSITION[side].map((c) => ({
      label: c.name,
      detail: c.note,
      value: c.contracted / c.value,
      shown: percent(c.contracted / c.value),
      accent: side === "long",
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
          return {
            label: bond.name,
            detail: bond.yieldPct ? `${bond.detail}, ${bond.yieldPct.toFixed(2)}% yield` : bond.detail,
            value: 100 - bond.price,
            shown: bond.price >= 99.99 ? "par" : `${bond.below ? "under " : ""}${+bond.price.toFixed(1)}c`,
            accent: bond.name.startsWith("CoreWeave"),
          };
        })}
      />
    </Figure>
  );
}

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function B300Index(): ReactElement {
  const readings = B300_INDEX.readings;
  const [lo, hi] = [6.5, 8];
  const W = 600;
  const H = 200;
  const x = (i: number) => (i / (readings.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const top = (v: number) => `${((hi - v) / (hi - lo)) * 100}%`;
  const points = readings.map(([, v], i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const [first, last] = [readings[0], readings[readings.length - 1]];
  const change = last[1] / first[1] - 1;
  const date = (iso: string) => monthDay.format(new Date(`${iso}T00:00:00Z`));
  return (
    <Figure
      title="Meanwhile, the asset keeps getting more valuable"
      subtitle={`B300 rental price, USD per GPU-hour: up ${percent(change)} in a month.`}
      sources={B300_INDEX.sources}
    >
      <div
        className={styles.plot}
        role="img"
        aria-label={`B300 rental index rose from $${first[1].toFixed(2)} on ${date(first[0])} to $${last[1].toFixed(2)} on ${date(last[0])}.`}
      >
        {[7, 7.5].map((v) => (
          <span key={v} className={styles.gridLine} style={{ top: top(v) }}>
            <span className={styles.gridLabel}>${v.toFixed(2)}</span>
          </span>
        ))}
        <svg className={styles.line} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline points={points} />
        </svg>
        <span className={styles.point} style={{ left: "0%", top: top(first[1]) }} />
        <span className={styles.point} data-accent="" style={{ left: "100%", top: top(last[1]) }} />
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
        }))}
      />
    </Figure>
  );
}

function Roadmap(): ReactElement {
  const height = (mw: number) => `${((Math.log10(mw) + 1) / (Math.log10(1000) + 1)) * 100}%`;
  return (
    <Figure
      title="What we have to prove, in megawatts"
      subtitle="Each stage funds and de-risks the next. Log scale."
      sources={[]}
    >
      <ol className={styles.steps}>
        {ROADMAP.map((step, i) => (
          <li key={step.label} className={styles.step}>
            <span className={styles.stepCol}>
              <span
                className={styles.stepBar}
                data-accent={i === 0 || undefined}
                style={{ height: height(step.mw) }}
              >
                <span className={styles.stepValue}>{step.label}</span>
              </span>
            </span>
            <span className={styles.stepStage}>
              {String.fromCharCode(97 + i)}. {step.stage}
            </span>
            <span className={styles.stepDetail}>{step.detail}</span>
          </li>
        ))}
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
export function PostChart({ name }: { name: string }): ReactElement | null {
  const Chart = Object.hasOwn(CHARTS, name) ? CHARTS[name] : undefined;
  return Chart ? <Chart /> : null;
}
