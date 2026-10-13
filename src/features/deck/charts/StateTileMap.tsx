import { useId, type CSSProperties, type ReactElement } from "react";
import { COUNTY_PAUSES, STATE_ACTIONS, STATUS_LABELS } from "../research";
import { US_GRID, US_TILES } from "./usTiles";
import styles from "./charts.module.css";

const TILE = 56;
const GAP = 5;
const STEP = TILE + GAP;
const W = US_GRID.columns * STEP - GAP;
const H = US_GRID.rows * STEP - GAP;

/**
 * Statewide data center moratorium actions on a tile map, with a dot where a
 * county has paused approvals. Each tile's title carries the bill or order.
 * `compact` sets the labels larger, for a phone's story card.
 */
export function StateTileMap({ active, compact = false }: { active: boolean; compact?: boolean }): ReactElement {
  const hatch = useId();
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      data-active={active || undefined}
      data-compact={compact || undefined}
      role="img"
      aria-label="US states with data center moratorium actions in 2026: in effect in New York; an executive pause in Oregon; bills introduced in Delaware, Georgia, Michigan, New Jersey, Pennsylvania, South Carolina, Vermont and Virginia; failed or vetoed in Maine, Minnesota, New Hampshire, Oklahoma, South Dakota and Wisconsin."
    >
      <defs>
        <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line className={styles.hatchLine} x1="0" y1="0" x2="0" y2="5" />
        </pattern>
      </defs>
      {Object.entries(US_TILES).map(([state, [col, row]]) => {
        const action = STATE_ACTIONS[state];
        const tx = col * STEP;
        const ty = row * STEP;
        return (
          <g
            key={state}
            className={styles.tile}
            data-status={action?.status}
            style={{ "--d": (col + row) / 2 } as CSSProperties}
          >
            <title>{action ? `${state} · ${STATUS_LABELS[action.status]}: ${action.note}` : state}</title>
            <rect
              className={styles.tileRect}
              x={tx}
              y={ty}
              width={TILE}
              height={TILE}
              style={action?.status === "introduced" ? { fill: `url(#${hatch})` } : undefined}
            />
            <text className={styles.tileLabel} x={tx + TILE / 2} y={ty + TILE / 2} dy="0.35em" textAnchor="middle">
              {state}
            </text>
            {COUNTY_PAUSES.includes(state) ? (
              <circle className={styles.county} cx={tx + TILE - 9} cy={ty + 9} r={4} />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
