/** Curated coverage of data center moratoriums and pauses for the deck's policy slide, newest last. */

export interface NewsItem {
  readonly outlet: string;
  readonly date: string;
  readonly place: string;
  /** The publisher's headline, as cited on the sources slide. */
  readonly headline: string;
  /** The card's shorter headline, two lines at most. */
  readonly title: string;
  /** Two lines at most. */
  readonly summary: string;
  readonly url: string;
}

export const NEWS: readonly NewsItem[] = [
  {
    outlet: "Reuters",
    date: "July 14, 2026",
    place: "New York",
    headline: "New York becomes the first state to impose a data center moratorium",
    title: "New York imposes the first state moratorium",
    summary: "A one-year pause on state permits for data centers using 50 MW or more.",
    url: "https://www.reuters.com/world/new-york-becomes-first-state-impose-data-center-moratorium-2026-07-14/",
  },
  {
    outlet: "Oregon Governor's Office",
    date: "September 8, 2026",
    place: "Oregon",
    headline: "Kotek pauses work on requests for state land to support new data centers",
    title: "Oregon pauses state land for data centers",
    summary: "Easements, leases and land sales for data centers held through July 1, 2027.",
    url: "https://apps.oregon.gov/oregon-newsroom/OR/GOV/Posts/Post/governor-kotek-pauses-work-on-requests-for-state-land-to-support-new-data-centers",
  },
  {
    outlet: "Loudoun Now",
    date: "September 15, 2026",
    place: "Loudoun County, VA",
    headline: "Loudoun supervisors advance 12-month pause on data center applications",
    title: "Loudoun advances a 12-month application pause",
    summary: "The largest US market holds votes on new cases; the resolution is due Oct 20.",
    url: "https://www.loudounnow.com/news/loudoun-supervisors-advance-12-month-pause-on-data-center-applications/article_33bdece6-af79-4b79-8bd0-169cf7b7181b.html",
  },
  {
    outlet: "Arizona Daily Star",
    date: "September 24, 2026",
    place: "Pima County, AZ",
    headline: "Pima County narrowly passes 120-day data center moratorium",
    title: "Pima County narrowly passes a 120-day moratorium",
    summary: "A 3–2 vote pauses projects that haven't yet applied for site permits.",
    url: "https://tucson.com/news/local/government-politics/article_51ccaeb6-3675-42d9-adbd-df918d777514.html",
  },
  {
    outlet: "The News Reporter",
    date: "October 6, 2026",
    place: "Columbus County, NC",
    headline: "Columbus County approves 120-day pause on data center approvals",
    title: "Columbus County approves a 120-day pause",
    summary: "A unanimous vote to study the effect on utilities, resources and neighbors.",
    url: "https://www.nrcolumbus.com/news/columbus-county-approves-120-day-pause-on-data-center-approvals/article_71d606df-a470-499f-9ecc-24c606c1e11f.html",
  },
  {
    outlet: "Idaho Mountain Express",
    date: "October 7, 2026",
    place: "Blaine County, ID",
    headline: "County enacts emergency moratorium on data centers",
    title: "Blaine County enacts an emergency moratorium",
    summary: "A unanimous 182-day halt on permit applications, the most Idaho law allows.",
    url: "https://www.mtexpress.com/news/blaine_county/county-enacts-emergency-moratorium-on-data-centers/article_f6a9f3b1-88ad-40c6-b9c2-36649bedfe3f.html",
  },
];

/** Data Center Watch's count of US projects blocked or delayed by local opposition. */
export const BLOCKED = {
  value: "$198B",
  label: "Of US data center projects blocked or delayed by local opposition in H1 2026",
  detail: "120+ projects: $130B in Q1, $68B in Q2",
} as const;
