/**
 * The deck's PDFs, printed from the live site after every production deploy
 * (scripts/make-deck-pdf.mjs) into the private Blob store, and handed out by
 * /deck/download: the full deck to readers with data room access, the public
 * slides and the gate to everyone else.
 */
export const DECK_PDFS = {
  public: { pathname: "deck/zode-investor-deck-public.pdf", filename: "ZODE - Investor deck.pdf" },
  full: { pathname: "deck/zode-investor-deck-full.pdf", filename: "ZODE - Investor deck (confidential).pdf" },
} as const;

export type DeckPdfVersion = keyof typeof DECK_PDFS;
