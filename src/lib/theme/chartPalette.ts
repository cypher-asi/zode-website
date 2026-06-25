/**
 * Shared chart palette. Every graph in the deck draws from this single set of
 * greens so categorical series stay on-brand with the accent (`#01d892`) while
 * remaining distinguishable from one another.
 *
 * The ramp deliberately walks across the green hue band — from a yellow-green
 * lime, through the brand spring green, into a blue-leaning teal — and varies
 * lightness so adjacent series read as distinct even for viewers with limited
 * color discrimination. Ordered so that the first two entries (used by most
 * two-series charts) have the strongest separation.
 */
export const GREEN_SERIES = [
  "#01d892", // 0 — brand spring green (primary)
  "#7cf0bd", // 1 — pale mint (light)
  "#16b8a6", // 2 — teal-green
  "#a3e635", // 3 — lime / chartreuse
  "#1f8f63", // 4 — deep emerald (dark)
  "#5fbf4c", // 5 — grass green
] as const;

export type GreenSeriesColor = (typeof GREEN_SERIES)[number];

/** Primary brand accent — the anchor the rest of the palette harmonizes with. */
export const ACCENT_GREEN = GREEN_SERIES[0];

/**
 * Pick a categorical color by index, wrapping around the palette so any number
 * of series resolves to a green.
 */
export function seriesColor(index: number): string {
  return GREEN_SERIES[index % GREEN_SERIES.length];
}
