/** Figures and dates as the Deployments app and its PDF print them. */

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const rate = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const count = new Intl.NumberFormat("en-US");
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const longDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

export const formatUsd = (value: number): string => usd.format(value);
export const formatRate = (value: number): string => `${rate.format(value)} /GPU-hr`;
/** A price per GPU-hour without its unit, e.g. "$4.50". */
export const formatPrice = (value: number): string => rate.format(value);
const compact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
/** e.g. "$403.7M". */
export const formatUsdShort = (value: number): string => compact.format(value);
export const formatPct = (value: number): string => `${decimal.format(value)}%`;

/** Figures that may differ, e.g. phases' prices: the one when they agree, "From" the lowest when not, null when there are none. */
export function formatAcross(values: readonly (number | null)[], format: (value: number) => string): string | null {
  const set = [...new Set(values.filter((value): value is number => value !== null))].sort((a, b) => a - b);
  return set.length ? `${set.length > 1 ? "From " : ""}${format(set[0])}` : null;
}
export const formatCount = (value: number): string => count.format(value);
export const formatMw = (value: number): string => `${decimal.format(value)} MW`;
export const formatTb = (value: number): string => `${count.format(value)} TB`;

/** e.g. "$1,200,000 (10% of contract)", or just the percent while there's no contract value. */
export const formatDeposit = (usd: number | null, pct: number | null): string | null => {
  const share = pct === null ? null : `${decimal.format(pct)}% of contract`;
  if (usd === null) return share;
  return share ? `${formatUsd(usd)} (${share})` : formatUsd(usd);
};

export const plural = (value: number, word: string): string =>
  `${count.format(value)} ${word}${value === 1 ? "" : "s"}`;

export const formatLeaseYears = (years: number): string =>
  `${decimal.format(years)} year${years === 1 ? "" : "s"} of lease`;

export const formatTerm = (months: number): string =>
  months % 12 === 0 ? plural(months / 12, "year") : plural(months, "month");

/** Noon UTC, so a `YYYY-MM-DD` reads as the same day in every timezone. */
export const dayOf = (iso: string): Date => new Date(`${iso}T12:00:00Z`);

export const formatDay = (iso: string): string => longDate.format(dayOf(iso));
export const formatMonthYear = (date: Date): string => monthYear.format(date);
export const formatMonth = (date: Date): string => month.format(date);

/** Today as `YYYY-MM-DD`, in UTC. */
export const todayIso = (): string => new Date().toISOString().slice(0, 10);
