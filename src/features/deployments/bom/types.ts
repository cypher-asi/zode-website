/*
 * A deployment's bill of materials. Vendor quotes are price lists to pick
 * from; the BOM is its own line items, each filling a cluster-builder slot of
 * one phase at the quantity the phase needs. Shared by the deployment page,
 * the BOM editor and the cluster builder, so none of them cost a line
 * differently.
 */

/** The file a quote came as. */
export interface QuoteFile {
  name: string;
  sizeBytes: number;
  contentType: string;
  createdAt: string;
  /** Uploaded on the Quotes tab, or linked from the deployment's data room. */
  source: "upload" | "data-room";
}

export interface Quote {
  id: string;
  vendor: string;
  reference: string | null;
  /** `YYYY-MM-DD`. */
  quotedOn: string | null;
  validUntil: string | null;
  /** The total the quote states. */
  quotedTotalUsd: number | null;
  /** A data room file linked as the quote's; an uploaded file takes its place. */
  dataRoomFileId: string | null;
  file: QuoteFile | null;
  notes: string | null;
}

/** Same-origin, team-only URL of a quote's file; `?download=1` sends it as an attachment. */
export const quoteFileUrl = (deploymentId: string, quoteId: string): string =>
  `/api/deployments/${deploymentId}/quotes/${quoteId}/file`;

/** One item a quote prices, as the vendor lists it. */
export interface QuoteItem {
  id: string;
  quoteId: string;
  /** The heading it sits under on its quote. */
  section: string;
  partNumber: string | null;
  manufacturer: string | null;
  description: string;
  /** How many the quote prices. */
  quantity: number | null;
  /** Null when it's priced inside another item, like a server's CPUs. */
  unitUsd: number | null;
  leadTime: string | null;
  notes: string | null;
  /** The item's page on the web, like its maker's product page; an http(s) URL. */
  url: string | null;
}

/** One line of a phase's BOM. Its item details are copied from the quote item it was picked from, then its own. */
export interface BomLine {
  id: string;
  phaseId: string;
  /** Null for a cost no slot stands for. */
  slotId: string | null;
  quoteItemId: string | null;
  partNumber: string | null;
  manufacturer: string | null;
  description: string;
  quantity: number;
  /** Null when it's priced inside another line. */
  unitUsd: number | null;
  notes: string | null;
  url: string | null;
}

export interface Bom {
  quotes: Quote[];
  /** In quote order, then as each quote lists them. */
  items: QuoteItem[];
  lines: BomLine[];
}

export const EMPTY_BOM: Bom = { quotes: [], items: [], lines: [] };

const cents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** e.g. "$53,038.31", for unit prices. */
export const formatCents = (value: number): string => cents.format(value);

/** What a line or item comes to at `quantity`; one priced inside another comes to nothing. */
export const lineUsd = (line: { quantity: number | null; unitUsd: number | null }): number =>
  line.unitUsd === null || line.quantity === null ? 0 : line.quantity * line.unitUsd;

/** What the quote's items come to at its own quantities. */
export const quoteItemsUsd = (quoteId: string, items: readonly QuoteItem[]): number =>
  items.filter((item) => item.quoteId === quoteId).reduce((sum, item) => sum + lineUsd(item), 0);

/** The quote's sections in the order it lists them, each with its items. */
export function quoteSections(quoteId: string, items: readonly QuoteItem[]): { title: string; items: QuoteItem[] }[] {
  const sections = new Map<string, QuoteItem[]>();
  for (const item of items) {
    if (item.quoteId !== quoteId) continue;
    sections.set(item.section, [...(sections.get(item.section) ?? []), item]);
  }
  return [...sections].map(([title, rows]) => ({ title, items: rows }));
}

/** The vendor each quote item came from, by item id. */
export const vendorsByItem = (bom: Pick<Bom, "quotes" | "items">): Record<string, string> => {
  const vendors = new Map(bom.quotes.map((quote) => [quote.id, quote.vendor]));
  return Object.fromEntries(bom.items.map((item) => [item.id, vendors.get(item.quoteId) ?? ""]));
};

/** What a line is called: its part number, else its description. */
export const lineName = (line: Pick<BomLine, "partNumber" | "description">): string => line.partNumber ?? line.description;

/** An item's link as it reads in a table: the site it's on, e.g. "nvidia.com". */
export const urlSite = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
