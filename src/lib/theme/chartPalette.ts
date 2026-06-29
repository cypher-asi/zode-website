/**
 * Shared chart palette. Every graph in the deck draws from this single set of
 * tans so categorical series stay on-brand with the accent (`#ffd6a0`) while
 * remaining distinguishable from one another.
 *
 * The ramp is a warm, monochromatic cluster anchored on the brand tan accent —
 * from a pale cream, through the accent itself, into a deep bronze. Hue stays
 * within the tan/amber band (~30–38°) while lightness and saturation vary so
 * adjacent series read as distinct even for viewers with limited color
 * discrimination. Ordered so that the first two entries (used by most
 * two-series charts) have the strongest separation.
 */
export const TAN_SERIES = [
  "#ffd6a0", // 0 — brand tan accent (primary)
  "#ffe8c9", // 1 — pale cream (light)
  "#f4be7c", // 2 — warm amber
  "#e3a155", // 3 — honey / gold
  "#9e6526", // 4 — deep bronze (dark)
  "#c6843c", // 5 — toffee
] as const;

export type TanSeriesColor = (typeof TAN_SERIES)[number];

/** Primary brand accent — the anchor the rest of the palette harmonizes with. */
export const ACCENT_TAN = TAN_SERIES[0];

/**
 * Pick a categorical color by index, wrapping around the palette so any number
 * of series resolves to a tan.
 */
export function seriesColor(index: number): string {
  return TAN_SERIES[index % TAN_SERIES.length];
}
