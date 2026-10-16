/*
 * A deployment's presentation, as the editor and the PDF see it: landscape
 * slides for a prospective offtaker diligencing the site. Every field is text
 * the ZODE team can rewrite; the limits keep each slide on its page, and the
 * save action enforces them.
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

/** A slide the team adds, like the site's power, cooling or redundancy. */
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

export interface Presentation extends PresentationContent {
  id: string;
  deploymentId: string;
  deploymentName: string;
  /** ISO timestamp. */
  updatedAt: string;
}

export type PresentationInput = PresentationContent & { deploymentId: string };

/** Character limits per field, and row limits per list. */
export const LIMITS = {
  eyebrow: 60,
  title: 90,
  subtitle: 220,
  stats: 4,
  statValue: 14,
  statLabel: 36,
  summary: 700,
  highlights: 5,
  highlight: 110,
  siteSummary: 700,
  siteFacts: 8,
  factLabel: 22,
  factValue: 60,
  rollout: 6,
  rolloutLabel: 24,
  rolloutCapacity: 52,
  rolloutPower: 16,
  rolloutDate: 20,
  clusterSummary: 700,
  specs: 8,
  sections: 6,
  sectionTitle: 60,
  sectionBody: 800,
  bullets: 6,
  bullet: 110,
  sectionFacts: 6,
  terms: 4,
  termLabel: 18,
  termValue: 32,
  nextSteps: 5,
  nextStep: 110,
  contactName: 60,
  contactEmail: 80,
} as const;

/** A presentation with nothing in it, which a saved one's content is read over. */
export const EMPTY_CONTENT: PresentationContent = {
  eyebrow: "",
  title: "",
  subtitle: "",
  stats: [],
  summary: "",
  highlights: "",
  siteSummary: "",
  siteFacts: [],
  rollout: [],
  clusterSummary: "",
  specs: [],
  sections: [],
  terms: [],
  nextSteps: "",
  contactName: "",
  contactEmail: "",
};

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
