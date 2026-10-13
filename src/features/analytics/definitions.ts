/**
 * How the site's analytics measure things, in one place: the constants the
 * collector and the reports share, and the definitions the Analytics app
 * shows beside each figure. Changing a threshold here changes every report.
 */

/** Reports bound and bucket days in this zone, as the team dashboard does. */
export const TIME_ZONE = "UTC";

/** A visitor's id, kept for a year; set by the collector, never read by scripts. */
export const VISITOR_COOKIE = "zode_vid";
export const VISITOR_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** A session ends after this long without an event; every event extends it. */
export const SESSION_COOKIE = "zode_sid";
export const SESSION_TIMEOUT_SECONDS = 30 * 60;

/** A session with one pageview, no events and less engaged time than this is a bounce. */
export const BOUNCE_ENGAGED_MS = 10_000;

/** Visitors seen this recently count as active in Realtime. */
export const REALTIME_MINUTES = 5;

/** One page's engaged time is capped here, so a tab left open in the foreground doesn't skew averages. */
export const MAX_ENGAGED_MS = 4 * 60 * 60 * 1000;

export type MetricId =
  | "visitors"
  | "sessions"
  | "pageviews"
  | "views_per_session"
  | "bounce_rate"
  | "session_duration"
  | "engaged_time"
  | "scroll_depth"
  | "entries"
  | "exits"
  | "conversions"
  | "conversion_rate";

export interface MetricDefinition {
  label: string;
  description: string;
  /** Lower is better, so a fall reads as good news. */
  lowerIsBetter?: boolean;
}

export const METRIC_DEFINITIONS: Record<MetricId, MetricDefinition> = {
  visitors: {
    label: "Visitors",
    description: "Unique browsers, each identified by a first-party cookie kept for a year.",
  },
  sessions: {
    label: "Sessions",
    description: `Visits. A session ends after ${SESSION_TIMEOUT_SECONDS / 60} minutes without activity.`,
  },
  pageviews: {
    label: "Pageviews",
    description: "Every page opened, including navigations inside the site that don't reload the page.",
  },
  views_per_session: {
    label: "Views per session",
    description: "Pageviews divided by sessions.",
  },
  bounce_rate: {
    label: "Bounce rate",
    description: `Sessions with a single pageview, no events and under ${BOUNCE_ENGAGED_MS / 1000} seconds of engaged time.`,
    lowerIsBetter: true,
  },
  session_duration: {
    label: "Session duration",
    description: "Average engaged time per session: the time its pages were visible in the foreground.",
  },
  engaged_time: {
    label: "Time on page",
    description: "Average time the page was visible in the foreground. Time in a hidden tab doesn't count.",
  },
  scroll_depth: {
    label: "Scroll depth",
    description: "Average of how far down the page each view scrolled, at its furthest.",
  },
  entries: {
    label: "Entries",
    description: "Sessions that started on the page.",
  },
  exits: {
    label: "Exits",
    description: "Sessions that ended on the page.",
  },
  conversions: {
    label: "Conversions",
    description: "Sessions that completed the goal at least once.",
  },
  conversion_rate: {
    label: "Conversion rate",
    description: "Converted sessions divided by all sessions in the range.",
  },
};
