/** How a compute deal is paid. The database checks the same (`compute_contracts_structure_check`). */
export const DEAL_STRUCTURES = ["Take-or-pay", "Take-or-pay or revenue share"] as const;

export type DealStructure = (typeof DEAL_STRUCTURES)[number];

export const isDealStructure = (value: unknown): value is DealStructure => DEAL_STRUCTURES.includes(value as DealStructure);

/** The average month that GPU-hour contracts bill, 8,760 hours a year over 12. */
export const HOURS_PER_MONTH = 730;

/** The monthly commitment at the contract rate: every GPU for every hour of an average month. */
export const monthlyCommitment = (gpuCount: number | null, gpuHourUsd: number | null): number | null =>
  gpuCount == null || gpuHourUsd == null ? null : gpuCount * gpuHourUsd * HOURS_PER_MONTH;

/** The total contract value at the rate over the initial term, as the order forms state it. */
export const contractValue = (gpuCount: number | null, gpuHourUsd: number | null, termMonths: number | null): number | null => {
  const monthly = monthlyCommitment(gpuCount, gpuHourUsd);
  return monthly == null || termMonths == null ? null : Math.round(monthly * termMonths * 100) / 100;
};
