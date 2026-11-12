/**
 * The deck's PDFs, printed by every production build from the site it just
 * built (scripts/make-deck-pdf.mjs) into the private Blob store, and handed
 * out by /deck/download: the full deck to readers with data room access, the
 * public slides and the gate to everyone else.
 */
export const DECK_PDFS = {
  public: { pathname: "deck/zode-investor-deck-public.pdf", filename: "ZODE - Investor deck.pdf" },
  full: { pathname: "deck/zode-investor-deck-full.pdf", filename: "ZODE - Investor deck (confidential).pdf" },
} as const;

export type DeckPdfVersion = keyof typeof DECK_PDFS;

/** Carries the print's `DECK_PRINT_KEY`, which shows it the full deck (access.ts). */
export const DECK_PRINT_HEADER = "x-zode-deck-print";
