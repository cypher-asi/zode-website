const DAY_MS = 86_400_000;

/**
 * Annualized IRR of dated cash flows, as spreadsheet XIRR computes it:
 * discounting on actual days over 365 from the first date. Newton's method
 * from `guess`, falling back to bisection when it fails to converge.
 * Returns null when the flows don't change sign or no root is found.
 */
export function xirr(flows: readonly number[], dates: readonly number[], guess = 0.1): number | null {
  if (!flows.some((v) => v < 0) || !flows.some((v) => v > 0)) return null;
  const years = dates.map((d) => (d - dates[0]) / DAY_MS / 365);

  const npv = (rate: number) => flows.reduce((sum, v, i) => sum + v / (1 + rate) ** years[i], 0);
  const slope = (rate: number) =>
    flows.reduce((sum, v, i) => sum - (years[i] * v) / (1 + rate) ** (years[i] + 1), 0);

  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const value = npv(rate);
    if (Math.abs(value) < 1e-7) return rate;
    const d = slope(rate);
    if (!Number.isFinite(d) || d === 0) break;
    const next = rate - value / d;
    if (!Number.isFinite(next) || next <= -1) break;
    if (Math.abs(next - rate) < 1e-12) return next;
    rate = next;
  }

  let lo = -0.9999;
  let hi = 100;
  let fLo = npv(lo);
  if (Math.sign(fLo) === Math.sign(npv(hi))) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7 || hi - lo < 1e-12) return mid;
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}
