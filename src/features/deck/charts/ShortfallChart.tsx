import { useId, type CSSProperties, type ReactElement } from "react";
import { SHORTFALL } from "../research";
import styles from "./charts.module.css";

const W = 860;
const H = 480;
const PAD = { top: 44, right: 8, bottom: 72, left: 8 };
const Y_MAX = 100;
const SLOT = (W - PAD.left - PAD.right) / SHORTFALL.steps.length;
const BAR = SLOT * 0.56;

/** SVG text doesn't wrap; notes break onto lines this many characters long to stay inside their slot. */
const NOTE_CHARS = 16;

const y = (gw: number) => H - PAD.bottom - (gw / Y_MAX) * (H - PAD.top - PAD.bottom);

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
export function ShortfallChart({ active }: { active: boolean }): ReactElement {
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      data-active={active || undefined}
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
            <text className={styles.barLabel} x={cx} y={H - PAD.bottom + 26} textAnchor="middle">
              {bar.label}
            </text>
            <text className={styles.barNote} x={cx} y={H - PAD.bottom + 46} textAnchor="middle">
              {wrap(bar.note, NOTE_CHARS).map((line, n) => (
                <tspan key={line} x={cx} dy={n ? "1.3em" : 0}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const YW = 300;
const YH = 480;
const YPAD = { top: 44, right: 8, bottom: 72, left: 8 };
const YMAX = 80;
const YSLOT = (YW - YPAD.left - YPAD.right) / SHORTFALL.byYear.length;
const ybar = (gw: number) => YH - YPAD.bottom - (gw / YMAX) * (YH - YPAD.top - YPAD.bottom);

/** The cumulative net gap by year; 2029, an extension of the forecast, is hatched. */
export function ShortfallByYear({ active }: { active: boolean }): ReactElement {
  const hatch = useId();
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${YW} ${YH}`}
      data-active={active || undefined}
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
