/*
 * A one-page compute offering teaser, as the PDF sees it: text written out
 * from a deployment's figures. The limits keep the longest teaser on one page.
 */

export interface Stat {
  value: string;
  label: string;
}

export interface AvailabilityRow {
  label: string;
  capacity: string;
  date: string;
}

export interface LabeledValue {
  label: string;
  value: string;
}

export interface TeaserContent {
  eyebrow: string;
  headline: string;
  subheadline: string;
  stats: Stat[];
  summary: string;
  /** One per line. */
  highlights: string;
  availability: AvailabilityRow[];
  specs: LabeledValue[];
  terms: LabeledValue[];
  contactName: string;
  contactEmail: string;
}

/** Character limits per field, and row limits per list. */
export const LIMITS = {
  eyebrow: 60,
  headline: 80,
  subheadline: 180,
  stats: 4,
  statValue: 14,
  statLabel: 32,
  summary: 380,
  highlights: 4,
  highlight: 80,
  availability: 4,
  availabilityLabel: 24,
  availabilityCapacity: 56,
  availabilityDate: 20,
  specs: 8,
  specLabel: 16,
  specValue: 26,
  terms: 3,
  termLabel: 14,
  termValue: 24,
  contactName: 60,
  contactEmail: 80,
} as const;

/** The download name of a deployment's teaser, e.g. "ZODE - Teaser - Chicago.pdf". */
export const teaserFileName = (deploymentName: string): string =>
  `ZODE - Teaser - ${
    deploymentName
      .replace(/[^\p{L}\p{N} .,&-]+/gu, " ")
      .replace(/ {2,}/g, " ")
      .trim()
      .slice(0, 80) || "Compute offering"
  }.pdf`;

/** The teaser's PDF for anyone who can open deployment `id`: inline, or as a download with `download`. */
export const teaserPdfPath = (deploymentId: string, download = false): string =>
  `/api/deployments/${deploymentId}/teaser${download ? "?download=1" : ""}`;

/** The teaser's PDF behind a deployment's public link. */
export const sharedTeaserPath = (token: string, download = false): string =>
  `/api/shared/deployments/${token}/teaser${download ? "?download=1" : ""}`;
