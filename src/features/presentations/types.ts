/*
 * A deployment's presentation, as the PDF sees it: landscape slides for a
 * prospective offtaker diligencing the site, written out from the
 * deployment's figures. The limits keep each slide's text on its page.
 */

import type { Cooling, Deployment } from "@/features/deployments/types";

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

/** One of a site profile's images, a file in its folder under ./sites, with the line set under it. */
export interface SiteImage {
  file: string;
  caption: string;
}

/** A numbered point: a heading over a sentence or two. */
export interface SitePoint {
  title: string;
  text: string;
}

/** A bar of the efficiency chart, the design outcome in the accent. */
export interface PueRow {
  label: string;
  detail: string;
  value: number;
  outcome?: boolean;
}

/** A row of the team's experience table. */
export interface ExperienceRow {
  company: string;
  project: string;
  location: string;
  scale: string;
  role: string;
}

/** A person on a team slide, their company set beside their name. */
export interface TeamMember {
  name: string;
  company: string;
  role: string;
  bio: string;
}

/**
 * The presentation's second section, on the building and land rather than
 * the deployment: written by hand from the landlord's materials for the
 * sites that have them, so it can say what the deployment's fields can't.
 */
export interface SiteContent {
  /** The divider: the site's name large over its photo. */
  name: string;
  caption: string;
  lede: string;
  /** The folder of its images under ./sites. */
  folder: string;
  photo: SiteImage;
  property: { image: SiteImage; facts: LabeledValue[] };
  why: { image: SiteImage; points: SitePoint[] };
  capacity: { figures: LabeledValue[]; columns: { title: string; items: string[] }[] };
  reliability: { lede: string; cells: SitePoint[]; source: string };
  efficiency: { rows: PueRow[]; figure: LabeledValue; points: string[]; source: string };
  plant: { image: SiteImage; points: string[]; inset: SiteImage };
  location: { image: SiteImage; points: SitePoint[] };
  /** A slide per group, after location: who's developing and delivering the site. */
  team: {
    /** A slide before the bios: projects in groups, with a line naming others. */
    experience: { groups: { title: string; rows: ExperienceRow[] }[]; note: string };
    slides: { title: string; lede: string; members: TeamMember[] }[];
    source: string;
  };
}

export interface PresentationContent {
  /** The cover: its headline over the deployment's name, e.g. "24 MW IT of 2027 Contiguous Compute Capacity in Chicago". */
  headline: string;
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
  /** A paragraph per line. */
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
  /** The site's own section, before next steps, for the sites with a profile. */
  site: SiteContent | null;
  /** One per line. */
  nextSteps: string;
  contactName: string;
  contactEmail: string;
}

/** Character limits per field, and row limits per list. */
export const LIMITS = {
  headline: 80,
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

/** A US address's city, e.g. "Chicago" from "801 S Canal St, Chicago, IL 60607": the part before its state and ZIP. */
export const cityOf = (address: string | null): string | null => {
  const parts = (address ?? "").split(/[,\n]/).map((part) => part.trim()).filter(Boolean);
  const state = parts.findIndex((part) => /^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(part));
  return state >= 2 ? parts[state - 1] : null;
};

/** What a deployment's presentation is called: its city, e.g. "Chicago", or its name without one. */
export const presentationName = (deployment: Pick<Deployment, "name" | "city" | "address">): string =>
  deployment.city ?? cityOf(deployment.address) ?? deployment.name;

/** The download name of a presentation called `name`, e.g. "ZODE - Presentation - Chicago.pdf". */
export const presentationFileName = (name: string): string =>
  `ZODE - Presentation - ${
    name
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
