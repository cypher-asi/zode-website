import { TIME_ZONE } from "./definitions";
import type { Bucket, Dimension } from "./filters";

/** How a figure reads: a count, a share or a length of time. */
export type Unit = "count" | "percent" | "duration" | "decimal";

const counts = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const decimals = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function formatValue(value: number | null, unit: Unit, { short = false } = {}): string {
  if (value === null || !Number.isFinite(value)) return "–";
  switch (unit) {
    case "percent":
      return `${(value * 100).toFixed(value >= 0.1 || value === 0 ? 0 : 1)}%`;
    case "duration":
      return duration(value);
    case "decimal":
      return decimals.format(value);
    default:
      return short && value >= 10_000 ? compact.format(value) : counts.format(Math.round(value));
  }
}

/** The change from `previous` to `current`: relative for counts, in points for shares. */
export function change(current: number, previous: number, unit: Unit): { text: string; direction: "up" | "down" | "flat" } {
  const diff = current - previous;
  const direction = Math.abs(diff) < 1e-9 ? "flat" : diff > 0 ? "up" : "down";
  if (unit === "percent") {
    const points = Math.abs(diff * 100);
    return { text: direction === "flat" ? "0 pts" : `${points.toFixed(points < 10 ? 1 : 0)} pts`, direction };
  }
  if (previous === 0) return { text: current === 0 ? "0%" : "New", direction };
  const pct = Math.abs(diff / previous) * 100;
  return { text: `${pct >= 100 ? Math.round(pct).toLocaleString("en-US") : pct.toFixed(pct < 10 ? 1 : 0)}%`, direction };
}

const regions = new Intl.DisplayNames(["en"], { type: "region" });
const languages = new Intl.DisplayNames(["en"], { type: "language" });

const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "";

export function countryName(code: string | null): string {
  if (!code) return "Unknown";
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

/** A country with its flag, e.g. "🇺🇸 United States". */
export function countryLabel(code: string | null): string {
  return code ? `${flag(code)} ${countryName(code)}`.trim() : "Unknown";
}

/** How a dimension's raw value reads in a report; `null` is shown as what its absence means. */
export function dimensionLabel(dim: Dimension, value: string | null): string {
  if (value === null || value === "") {
    if (dim === "referrer" || dim === "channel") return "Direct / none";
    if (dim.startsWith("utm_")) return "(not set)";
    return "Unknown";
  }
  switch (dim) {
    case "country":
      return countryLabel(value);
    case "region": {
      const [country, ...rest] = value.split("-");
      return `${rest.join("-")}, ${countryName(country)}`;
    }
    case "language":
      try {
        return languages.of(value) ?? value;
      } catch {
        return value;
      }
    case "area":
      return value === "portal" ? "Portal" : value === "account" ? "Sign-in & invites" : "Site";
    default:
      return value;
  }
}

// Buckets are already wall-clock times in the reports' zone, written as if UTC.
const hourFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: TIME_ZONE });

/** A moment in the reports' zone, e.g. "3:04:05 PM". */
export const timeOfDay = (date: Date): string => timeFormat.format(date);

/** A chart bucket's axis label and its longer tooltip title. */
export function bucketLabels(bucket: string, unit: Bucket): { tick: string; title: string } {
  const date = new Date(`${bucket}:00Z`);
  if (unit === "hour") return { tick: hourFormat.format(date), title: `${dayFormat.format(date)}, ${hourFormat.format(date)}` };
  if (unit === "week") return { tick: dayFormat.format(date), title: `Week of ${dayFormat.format(date)}` };
  return { tick: dayFormat.format(date), title: fullDay.format(date) };
}

const periodDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** A period as a readable range, e.g. "Sep 14 – Oct 13, 2026". */
export function periodLabel(start: string, end: string): string {
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  return start === end ? periodDay.format(from) : periodDay.formatRange(from, to);
}
