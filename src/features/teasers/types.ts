/*
 * A one-page compute offering teaser, as the editor and the PDF see it. Every
 * field is text the ZODE team can rewrite; the limits keep the longest teaser
 * on one page, and the save action enforces them.
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

export interface Teaser extends TeaserContent {
  id: string;
  /** What the team calls it in the list; not printed. */
  name: string;
  /** The deployment it offers, which it's listed and deleted with. */
  deploymentId: string;
  deploymentName: string;
  /** ISO timestamp. */
  updatedAt: string;
}

export type TeaserInput = Omit<Teaser, "id" | "deploymentName" | "updatedAt">;

/** Character limits per field, and row limits per list. */
export const LIMITS = {
  name: 120,
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

/** The download name of a teaser's PDF, e.g. "ZODE - Teaser - Chicago.pdf". */
export const teaserFileName = (name: string): string =>
  `ZODE - Teaser - ${
    name
      .replace(/[^\p{L}\p{N} .,&-]+/gu, " ")
      .replace(/ {2,}/g, " ")
      .trim()
      .slice(0, 80) || "Compute offering"
  }.pdf`;
