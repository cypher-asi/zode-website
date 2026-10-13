import { useId, type CSSProperties, type ReactElement } from "react";
import { SHORTFALL } from "../research";
import styles from "./charts.module.css";

const Y_MAX = 100;

/**
 * The slide's wide bridge, and a taller one for a phone's story card, where
 * the type is set larger against the viewBox and the notes under each bar
 * give way to the caption.
 */
const LAYOUTS = {
  wide: { W: 860, H: 480, pad: { top: 44, right: 8, bottom: 72, left: 8 }, labelY: 26 },
  compact: { W: 520, H: 520, pad: { top: 52, right: 4, bottom: 72, left: 4 }, labelY: 34 },
} as const;

/** SVG text doesn't wrap; notes and labels break onto lines this many characters long to stay inside their slot. */
const NOTE_CHARS = 16;
const LABEL_CHARS = 6;

function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + word.length + 1 <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** Each bar's base and top in GW: totals stand on zero, steps hang from the running total. */
const BARS = (() => {
  let level = 0;
  return SHORTFALL.steps.map((step) => {
    if (step.kind === "total") {
      level = step.value;
      return { ...step, from: 0, to: step.value };
    }
    const from = level + step.value;
    const bar = { ...step, from, to: level };
    level = from;
    return bar;
  });
})();

/** Morgan Stanley's 2026–2028 bridge from demand to the net power gap, in GW. */
export function ShortfallChart({ active, compact = false }: { active: boolean; compact?: boolean }): ReactElement {
  const { W, H, pad: PAD, labelY } = LAYOUTS[compact ? "compact" : "wide"];
  const SLOT = (W - PAD.left - PAD.right) / SHORTFALL.steps.length;
  const BAR = SLOT * 0.56;
  const y = (gw: number) => H - PAD.bottom - (gw / Y_MAX) * (H - PAD.top - PAD.bottom);
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      data-active={active || undefined}
      data-compact={compact || undefined}
      role="img"
      aria-label="97 GW of 2026–2028 demand, less 21 GW under construction and 19 GW of grid capacity, leaves a 57 GW gross gap; less 24 GW of time-to-power fixes, a 33 GW net gap."
    >
      <line className={styles.baseline} x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />
      {BARS.map((bar, i) => {
        const cx = PAD.left + SLOT * (i + 0.5);
        const next = BARS[i + 1];
        const level = bar.kind === "total" ? bar.to : bar.from;
        return (
          <g key={bar.id} className={styles.bar} style={{ "--d": i } as CSSProperties}>
            {next ? (
              <line
                className={styles.connector}
                x1={cx + BAR / 2}
                x2={cx + SLOT - BAR / 2}
                y1={y(level)}
                y2={y(level)}
              />
            ) : null}
            <rect
              className={styles.barRect}
              data-kind={bar.id === "net" ? "net" : bar.kind}
              x={cx - BAR / 2}
              width={BAR}
              y={y(bar.to)}
              height={y(bar.from) - y(bar.to)}
            />
            <text className={styles.barValue} x={cx} y={y(bar.to)} dy="-0.7em" textAnchor="middle">
              {bar.kind === "step" ? `−${Math.abs(bar.value)}` : bar.value}
              <tspan className={styles.unit}> GW</tspan>
            </text>
            <text className={styles.barLabel} x={cx} y={H - PAD.bottom + labelY} textAnchor="middle">
              {compact
                ? wrap(bar.short, LABEL_CHARS).map((line, n) => (
                    <tspan key={line} x={cx} dy={n ? "1.15em" : 0}>
                      {line}
                    </tspan>
                  ))
                : bar.label}
            </text>
            {compact ? null : (
              <text className={styles.barNote} x={cx} y={H - PAD.bottom + 46} textAnchor="middle">
                {wrap(bar.note, NOTE_CHARS).map((line, n) => (
                  <tspan key={line} x={cx} dy={n ? "1.3em" : 0}>
                    {line}
                  </tspan>
                ))}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const YMAX = 80;
/** A narrow column beside the bridge on the slide; full width and shorter on a story card. */
const YEAR_LAYOUTS = {
  wide: { W: 300, H: 480, pad: { top: 44, right: 8, bottom: 72, left: 8 } },
  compact: { W: 520, H: 340, pad: { top: 52, right: 4, bottom: 52, left: 4 } },
} as const;

/** The cumulative net gap by year; 2029, an extension of the forecast, is hatched. */
export function ShortfallByYear({ active, compact = false }: { active: boolean; compact?: boolean }): ReactElement {
  const hatch = useId();
  const { W: YW, H: YH, pad: YPAD } = YEAR_LAYOUTS[compact ? "compact" : "wide"];
  const YSLOT = (YW - YPAD.left - YPAD.right) / SHORTFALL.byYear.length;
  const ybar = (gw: number) => YH - YPAD.bottom - (gw / YMAX) * (YH - YPAD.top - YPAD.bottom);
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${YW} ${YH}`}
      data-active={active || undefined}
      data-compact={compact || undefined}
      role="img"
      aria-label="Cumulative net gap: 5 GW in 2026, 12 GW in 2027, 33 GW in 2028 and 72 GW in 2029."
    >
      <defs>
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line className={styles.hatchLine} x1="0" y1="0" x2="0" y2="6" />
        </pattern>
      </defs>
      <line className={styles.baseline} x1={YPAD.left} x2={YW - YPAD.right} y1={ybar(0)} y2={ybar(0)} />
      {SHORTFALL.byYear.map((entry, i) => {
        const cx = YPAD.left + YSLOT * (i + 0.5);
        const w = YSLOT * 0.5;
        const extended = "extended" in entry;
        return (
          <g key={entry.year} className={styles.bar} style={{ "--d": i + 3 } as CSSProperties}>
            <rect
              className={styles.yearRect}
              data-extended={extended || undefined}
              style={extended ? { fill: `url(#${hatch})` } : undefined}
              x={cx - w / 2}
              width={w}
              y={ybar(entry.gw)}
              height={ybar(0) - ybar(entry.gw)}
            />
            <text className={styles.barValue} x={cx} y={ybar(entry.gw)} dy="-0.7em" textAnchor="middle">
              {entry.gw}
            </text>
            <text className={styles.barLabel} x={cx} y={YH - YPAD.bottom + 26} textAnchor="middle">
              {extended ? `${entry.year}*` : entry.year}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
