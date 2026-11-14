export function fmt(n: number | null | undefined, dp = 0): string {
  if (n == null || Number.isNaN(n)) return "-";
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/** Format a number with up to `dp` decimals, dropping trailing zeros (e.g. 991.4, 2,258, 44.45). */
export function fmtN(n: number | null | undefined, dp = 2): string {
  if (n == null || Number.isNaN(n)) return "-";
  return n.toLocaleString("en-US", { maximumFractionDigits: dp });
}

export function usd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "-";
  return "$" + fmt(Math.round(n));
}

export function dimsText(d: { w: number | null; d: number | null; h: number | null } | null | undefined): string {
  if (!d) return "-";
  return [d.w, d.d, d.h]
    .filter((v) => v != null)
    .map((v) => fmtN(v, 2))
    .join(" x ");
}

export type Vars = Record<string, string | number>;

/** Replace `{key}` tokens with values from `vars`; unknown tokens are left as-is. */
export function tpl(text: string, vars: Vars): string {
  return text.replace(/\{([\w.]+)\}/g, (m, key: string) => {
    const v = vars[key];
    if (v == null) return m;
    return typeof v === "number" ? fmtN(v, 2) : v;
  });
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
