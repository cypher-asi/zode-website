import type { CSSProperties, KeyboardEvent, ReactElement } from "react";
import { GRID_LABELS, STATUS_LABELS, STATUS_ORDER, type PolicyMap, type PolicyState } from "../policyTypes";
import { US_GRID, US_NAMES, US_TILES } from "./usTiles";
import styles from "./charts.module.css";

const TILE = 56;
const GAP = 5;
const STEP = TILE + GAP;
const W = US_GRID.columns * STEP - GAP;
const H = US_GRID.rows * STEP - GAP;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function title(state: string, policy: PolicyState | undefined): string {
  if (!policy) return state;
  const lines = [
    policy.status ? `${state} · ${STATUS_LABELS[policy.status]}` : state,
    ...policy.actions.map((action) => `${action.title}: ${action.label}`),
  ];
  if (policy.localCount) lines.push(`${plural(policy.localCount, "local pause")} in effect`);
  if (policy.grid) lines.push(`${GRID_LABELS[policy.grid.gate]}: ${policy.grid.title}`);
  return lines.join("\n");
}

/** A tile's name as a button: the state, then what the map shows of it. */
function label(state: string, policy: PolicyState): string {
  return [
    US_NAMES[state] ?? state,
    policy.status ? STATUS_LABELS[policy.status] : null,
    policy.localCount ? `${plural(policy.localCount, "local pause")} in effect` : null,
    policy.grid ? GRID_LABELS[policy.grid.gate] : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function describe(policy: PolicyMap | null): string {
  if (!policy) return "US states. The data center policy tracker is unavailable.";
  const states = Object.values(policy.states);
  const count = (test: (state: PolicyState) => boolean) => states.filter(test).length;
  const statuses = STATUS_ORDER.map(
    (status) => `${STATUS_LABELS[status].toLowerCase()}: ${plural(count((state) => state.status === status), "state")}`,
  );
  const local = states.reduce((sum, state) => sum + state.localCount, 0);
  return [
    `US data center policy by state. ${statuses.join("; ")}.`,
    `${plural(local, "local pause")} in effect across ${plural(count((state) => state.localCount > 0), "state")}.`,
    `${GRID_LABELS.paused}: ${plural(count((state) => state.grid?.gate === "paused"), "state")};`,
    `${GRID_LABELS.signoff.toLowerCase()}: ${plural(count((state) => state.grid?.gate === "signoff"), "state")}.`,
  ].join(" ");
}

/**
 * The policy tracker on a tile map: each state filled by its strongest
 * statewide action, its local pauses in effect counted under its code, and a
 * corner mark for its grid gate (solid where hookups are paused or capped, a
 * ring where large loads need the state's sign-off). Each tile's title
 * carries the detail. `compact` sets the type larger, for the deck's scroll mode on a phone.
 * With `onChoose`, each tracked state is a toggle button for the panel
 * `controls` names: `chosen` is pressed and outlined, and with `lit` set the
 * states outside it fade.
 */
export function StateTileMap({
  active,
  compact = false,
  policy,
  chosen = null,
  lit = null,
  controls,
  onChoose,
}: {
  active: boolean;
  compact?: boolean;
  policy: PolicyMap | null;
  chosen?: string | null;
  lit?: ReadonlySet<string> | null;
  controls?: string;
  onChoose?: (state: string) => void;
}): ReactElement {
  const mark = compact ? 5.5 : 4;
  const interactive = Boolean(policy && onChoose);
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      data-active={active || undefined}
      data-compact={compact || undefined}
      data-filtered={lit ? "" : undefined}
      role={interactive ? "group" : "img"}
      aria-label={describe(policy)}
    >
      {Object.entries(US_TILES).map(([state, [col, row]]) => {
        const entry = policy?.states[state];
        const tx = col * STEP;
        const ty = row * STEP;
        const local = entry?.localCount ?? 0;
        const button =
          entry && onChoose
            ? {
                role: "button",
                tabIndex: 0,
                "aria-label": label(state, entry),
                "aria-pressed": chosen === state,
                "aria-controls": controls,
                onClick: () => onChoose(state),
                onKeyDown: (event: KeyboardEvent) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onChoose(state);
                },
              }
            : { "aria-hidden": interactive || undefined };
        return (
          <g
            key={state}
            className={styles.tile}
            data-status={entry?.status}
            data-shown={chosen === state || undefined}
            data-lit={lit?.has(state) || undefined}
            style={{ "--d": (col + row) / 2 } as CSSProperties}
            {...button}
          >
            <title>{title(state, entry)}</title>
            <rect className={styles.tileRect} x={tx} y={ty} width={TILE} height={TILE} />
            <text
              className={styles.tileLabel}
              x={tx + TILE / 2}
              y={ty + (local ? (compact ? 21 : 24) : TILE / 2)}
              dy="0.35em"
              textAnchor="middle"
            >
              {state}
            </text>
            {local ? (
              <text
                className={styles.tileCount}
                x={tx + TILE / 2}
                y={ty + (compact ? 43 : 41)}
                dy="0.35em"
                textAnchor="middle"
              >
                {local}
              </text>
            ) : null}
            {entry?.grid ? (
              <circle
                className={styles.gridMark}
                data-gate={entry.grid.gate}
                cx={tx + TILE - 4 - mark}
                cy={ty + 4 + mark}
                r={mark}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
