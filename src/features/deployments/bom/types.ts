/*
 * A deployment's bill of materials: vendor quotes copied in line by line,
 * each line filling cluster-builder slots for one phase. Shared by the
 * deployment page, the BOM editor and the cluster builder, so none of them
 * total a quote differently.
 */

export type ItemStatus = "use" | "excluded";

export interface Quote {
  id: string;
  vendor: string;
  reference: string | null;
  /** `YYYY-MM-DD`. */
  quotedOn: string | null;
  validUntil: string | null;
  /** The total the quote states, to check its lines against. */
  quotedTotalUsd: number | null;
  dataRoomFileId: string | null;
  dataRoomFileName: string | null;
  notes: string | null;
}

export interface BomFill {
  slotId: string;
  /** Slot units each of the line's quantity covers. */
  unitsPerItem: number;
}

export interface BomItem {
  id: string;
  phaseId: string | null;
  quoteId: string | null;
  /** The heading the line sits under on its quote. */
  quoteSection: string;
  partNumber: string | null;
  description: string;
  quantity: number;
  /** The quote's own quantity, when the phase takes a different one. */
  quotedQuantity: number | null;
  /** Null when the line is priced inside another, like a server's CPUs. */
  unitUsd: number | null;
  status: ItemStatus;
  excludedReason: string | null;
  leadTime: string | null;
  notes: string | null;
  fills: BomFill[];
}

export interface Bom {
  quotes: Quote[];
  /** In quote order, then as each quote lists them. */
  items: BomItem[];
}

export const EMPTY_BOM: Bom = { quotes: [], items: [] };

const cents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** e.g. "$53,038.31", for unit prices. */
export const formatCents = (value: number): string => cents.format(value);

/** What the line comes to at `quantity`; a line priced inside another comes to nothing. */
export const lineUsd = (item: Pick<BomItem, "quantity" | "unitUsd">, quantity = item.quantity): number =>
  item.unitUsd === null ? 0 : quantity * item.unitUsd;

/** The quote's lines at its own quantities, excluded ones too, against what it states. */
export function quoteTotals(quote: Quote, items: readonly BomItem[]): { quotedUsd: number; bomUsd: number; matches: boolean } {
  const lines = items.filter((item) => item.quoteId === quote.id);
  const quotedUsd = lines.reduce((sum, item) => sum + lineUsd(item, item.quotedQuantity ?? item.quantity), 0);
  const bomUsd = lines.filter((item) => item.status === "use").reduce((sum, item) => sum + lineUsd(item), 0);
  return {
    quotedUsd,
    bomUsd,
    matches: quote.quotedTotalUsd === null || Math.abs(quotedUsd - quote.quotedTotalUsd) < 1,
  };
}

/** The quote's sections in the order it lists them, each with its lines. */
export function quoteSections(quoteId: string, items: readonly BomItem[]): { title: string; items: BomItem[] }[] {
  const sections = new Map<string, BomItem[]>();
  for (const item of items) {
    if (item.quoteId !== quoteId) continue;
    sections.set(item.quoteSection, [...(sections.get(item.quoteSection) ?? []), item]);
  }
  return [...sections].map(([title, lines]) => ({ title, items: lines }));
}
