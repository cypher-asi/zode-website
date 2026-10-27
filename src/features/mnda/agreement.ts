/**
 * What every version of the ZODE Mutual Nondisclosure Agreement shares. Each
 * version's text, PDF and blank positions are in templates/.
 */
export const ZODE_PARTY = { name: "ZODE INC.", description: "a Delaware corporation" } as const;

/** The executed PDF's file name, as emailed and downloaded. */
export const executedFileName = (entityName: string): string =>
  `ZODE - MNDA - ${entityName.replace(/[^\p{L}\p{N} .,&-]+/gu, "").trim().slice(0, 80) || "Entity"}.pdf`;

/** What the signer affirms by ticking the consent box; stored on the certificate page word for word. */
export const consentText = (entityName: string): string =>
  `I have read this Agreement, I am authorized to sign it on behalf of ${entityName}, and I agree to sign it electronically. My typed name is my signature.`;
