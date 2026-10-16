/*
 * A deployment's presentation, as the PDF sees it: landscape slides for a
 * prospective offtaker diligencing the site, written out from the
 * deployment's figures. The limits keep each slide's text on its page.
 */

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
  subtitle: string;
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
  terms: LabeledValue[];
  /** One per line. */
  nextSteps: string;
  contactName: string;
  contactEmail: string;
}

/** Character limits per field, and row limits per list. */
export const LIMITS = {
  eyebrow: 60,
  title: 90,
  subtitle: 220,
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
  termLabel: 18,
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
