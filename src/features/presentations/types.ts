/*
 * A deployment's presentation, as the PDF sees it: landscape slides for a
 * prospective offtaker diligencing the site, written out from the
 * deployment's figures. The limits keep each slide's text on its page.
 */

import type { Cooling } from "@/features/deployments/types";

export interface Stat {
  value: string;
  label: string;
}

export interface LabeledValue {
  label: string;
  value: string;
}

export interface RolloutRow {
  label: string;
  capacity: string;
  power: string;
  date: string;
}

/** A phase's terms on the commercial slide, its figures blank while it's to follow. */
export interface PricingRow {
  label: string;
  platform: string;
  gpus: string;
  price: string;
  term: string;
  contract: string;
  deposit: string;
}

/** A cell of the cover's spec grid: a heading over a line of text or a few figures. */
export interface SpecCell {
  title: string;
  text: string;
  values: Stat[];
}

/** A slide of its own, like the deployment's external notes. */
export interface Section {
  title: string;
  body: string;
  /** One per line. */
  bullets: string;
  facts: LabeledValue[];
}

export interface PresentationContent {
  /** The cover. */
  eyebrow: string;
  title: string;
  /** Where the site is, its address or else its city, in every content slide's footer. */
  address: string;
  subtitle: string;
  /** In a row under the cover's drawing. */
  cover: SpecCell[];
  /** Which cooling the cluster drawings show. */
  cooling: Cooling;
  /** At a glance. */
  stats: Stat[];
  summary: string;
  /** One per line. */
  highlights: string;
  /** The site. */
  siteSummary: string;
  siteFacts: LabeledValue[];
  /** Capacity and rollout. */
  rollout: RolloutRow[];
  /** The cluster. */
  clusterSummary: string;
  specs: LabeledValue[];
  sections: Section[];
  /** Commercial terms: the figures across the priced phases, then each phase's. */
  terms: LabeledValue[];
  pricing: PricingRow[];
  /** One per line. */
  nextSteps: string;
  contactName: string;
  contactEmail: string;
}

/** Character limits per field, and row limits per list. */
export const LIMITS = {
  eyebrow: 60,
  title: 90,
  address: 90,
  subtitle: 220,
  cover: 4,
  coverText: 200,
  coverValue: 24,
  coverLabel: 24,
  summary: 700,
  siteSummary: 700,
  siteFacts: 8,
  factLabel: 22,
  factValue: 60,
  rollout: 6,
  rolloutLabel: 24,
  rolloutCapacity: 52,
  clusterSummary: 700,
  specs: 8,
  sectionBody: 800,
  termLabel: 48,
  termValue: 32,
  nextSteps: 5,
} as const;

/** The download name of a deployment's presentation, e.g. "ZODE - Presentation - Chicago.pdf". */
export const presentationFileName = (deploymentName: string): string =>
  `ZODE - Presentation - ${
    deploymentName
      .replace(/[^\p{L}\p{N} .,&-]+/gu, " ")
      .replace(/ {2,}/g, " ")
      .trim()
      .slice(0, 80) || "Deployment"
  }.pdf`;

/** The presentation's PDF for anyone who can open deployment `id`: inline, or as a download with `download`. */
export const presentationPdfPath = (deploymentId: string, download = false): string =>
  `/api/deployments/${deploymentId}/presentation${download ? "?download=1" : ""}`;

/** The presentation's PDF behind a deployment's public link. */
export const sharedPresentationPath = (token: string, download = false): string =>
  `/api/shared/deployments/${token}/presentation${download ? "?download=1" : ""}`;

/** Lines of a one-per-line field, blank ones dropped. */
export const linesOf = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
