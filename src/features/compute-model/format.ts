import type { Format } from "./model/inputs";

const MINUS = "\u2212";

const sign = (n: number) => (n < 0 ? MINUS : "");

/** $1.2B, $21.4M, $904K or $850. */
export function usdShort(n: number, digits = 1): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign(n)}$${(a / 1e9).toFixed(digits)}B`;
  if (a >= 1e6) return `${sign(n)}$${(a / 1e6).toFixed(digits)}M`;
  if (a >= 1e3) return `${sign(n)}$${(a / 1e3).toFixed(a >= 1e5 ? 0 : digits)}K`;
  return `${sign(n)}$${a.toFixed(0)}`;
}

/** Whole dollars with separators. */
export const usd = (n: number) => `${sign(n)}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

/** Millions with two decimals, for tables already labelled in USD millions. */
export const millions = (n: number) => {
  const m = n / 1e6;
  return Math.abs(m) < 0.005 ? "–" : `${sign(m)}${Math.abs(m).toFixed(2)}`;
};

/** Percent with up to `digits` decimals, trailing zeros dropped. */
export function pct(n: number, digits = 2): string {
  const v = Number((n * 100).toFixed(digits));
  return `${sign(v)}${Math.abs(v)}%`;
}

export const multiple = (n: number, digits = 2) => `${n.toFixed(digits)}x`;

/** Shows null metrics (no IRR, no debt service) as n.a. */
export const orNa = (n: number | null, f: (n: number) => string) => (n === null ? "n.a." : f(n));

export function formatValue(format: Format, n: number): string {
  switch (format) {
    case "usd":
      return n >= 1e6 ? usdShort(n, 2) : usd(n);
    case "pct":
      return pct(n);
    case "x":
      return multiple(n);
    case "months":
      return `${n} mo`;
    case "count":
      return n.toLocaleString("en-US");
    case "gpuHour":
      return `$${n.toFixed(2)} / GPU-hr`;
    case "kwh":
      return `$${n.toFixed(3)} / kWh`;
    case "kw":
      return `${Number(n.toFixed(3))} kW`;
    case "kwMonth":
      return `$${n} / kW-mo`;
    case "days":
      return `${n} days`;
  }
}

/** The editable number for a value: percents as percent points, everything else raw. */
export const toEditable = (format: Format, n: number) =>
  format === "pct" ? String(Number((n * 100).toFixed(4))) : String(n);

export const fromEditable = (format: Format, text: string) => {
  const n = Number(text.replace(/[$,%\s]/g, ""));
  if (!Number.isFinite(n)) return null;
  return format === "pct" ? n / 100 : n;
};
