/** Simulation clock as "Day 4 · 13:30"; day 1 starts at hour zero. */
export function clockLabel(hours: number): string {
  const day = Math.floor(hours / 24) + 1;
  const minutes = Math.floor((hours % 24) * 60);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `Day ${day} · ${hh}:${mm}`;
}

const one = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export const number = (n: number): string => one.format(n);

/** Hours as hours under two days, days beyond. */
export function duration(hours: number): string {
  return hours < 48 ? `${one.format(hours)} h` : `${one.format(hours / 24)} d`;
}

export const percent = (share: number): string => `${Math.round(share * 100)}%`;

export const podName = (id: number): string => `CP-${String(id).padStart(4, "0")}`;
