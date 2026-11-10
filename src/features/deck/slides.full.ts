import "server-only";
import { REVENUE_RAMP } from "./revenueRamp";
import { DEMAND_DETAILS, PUBLIC_SLIDES, type Slide } from "./slides";

/**
 * The deck past project finance, for readers with data room access: the raise,
 * the close and the sources. Server-only, so the public deck's bundle never
 * carries it; see `deckSlides` in ./access.
 */

const quarterRevenue = ({ revenue }: (typeof REVENUE_RAMP.quarters)[number]) =>
  revenue.inference + revenue.merchant + revenue.offtake;
const PEAK = REVENUE_RAMP.quarters.reduce((best, q) => (quarterRevenue(q) > quarterRevenue(best) ? q : best));

/** The consolidated model by quarter, from ./revenueRamp, which scripts/write-revenue-ramp.mjs writes. */
const RAMP: Slide = {
  id: "revenue-ramp",
  kind: "ramp",
  section: "Revenue ramp",
  eyebrow: "Revenue ramp",
  title: `Revenue ramps to $${(quarterRevenue(PEAK) / 1e9).toFixed(1)}B a quarter by ${PEAK.quarter}.`,
  ground: "paper",
  quarters: REVENUE_RAMP.quarters,
  caption:
    "Revenue by quarter, ZODE Inc. consolidated with every project at 100%. Hover a bar for its revenue by inference, merchant and offtake, and where it goes.",
  note: `Preliminary, from ZODE's master model of November 9, 2026 (${REVENUE_RAMP.model}, ZODE ASCENT data room), base case to December 2030, including 250 MW of generic future sites from 2029. Op costs are colocation rent and site and cluster operations. Debt service is interest and principal repaid; Q2 2027's includes the $10M Calgary acquisition loan the construction loan refinances. TopCo is ZODE Inc.'s staffing and G&A. Left over is before GPU hardware, refresh and site capital spending.`,
};

/**
 * From the ZODE ASCENT data room: ZODE_MasterModel_26.11.09.xlsx, base case to
 * December 2030 as the room's summaries cut it, and Alaska's term sheet, which
 * the model doesn't include yet. Debt is what the site build and the first GPU
 * generation draw. Update with each new model.
 */
const RAISE: Slide = {
  id: "raise",
  kind: "raise",
  section: "Capital raise",
  eyebrow: "Capital raise",
  title: "Raising the seed and project finance.",
  ground: "paper",
  topco: {
    name: "ZODE Inc.",
    detail: "Team, development and the common equity of each project",
    uses: "$39.3M into the projects · $21.5M team and G&A through 2028",
  },
  projects: [
    {
      name: "ZODE Toronto",
      detail: "CORE, Mississauga",
      tenure: "lease",
      computeCo: { detail: "512 B300 GPUs · 1 MW", value: "$19.3M", basis: "ZODE-funded", source: "zode" },
    },
    {
      name: "ZODE Calgary",
      detail: "Olds and Calgary",
      tenure: "own",
      propCo: { detail: "Buys and converts 30 MW", value: "$112M", basis: "Pref · + $10M ZODE" },
      computeCo: { detail: "18,420 GPUs · 30 MW", value: "$423M", basis: "Pref · 15%" },
    },
    {
      name: "ZODE Big Watt",
      detail: "Pierre, South Dakota",
      tenure: "lease",
      computeCo: { detail: "15,360 GPUs · 30 MW", value: "$390M", basis: "Pref · + $10M ZODE" },
    },
    {
      name: "ZODE Alaska",
      detail: "Sites in selection",
      tenure: "own",
      propCo: { detail: "Alaska sites", value: "TBD", basis: "Not yet modelled" },
      computeCo: { detail: "B300 clusters", value: "$15M", basis: "Sub. loan · equity TBD" },
    },
  ],
  stacks: [
    {
      row: "topco",
      label: "Top Co",
      raising: { value: "$55M", label: "Seed" },
      layers: [{ label: "Seed SAFE", kind: "equity", value: "$55M", terms: "$300M post-money cap" }],
    },
    {
      row: "propco",
      label: "Prop Cos",
      raising: { value: "$112M", label: "Pref equity" },
      layers: [
        { label: "Class A · ZODE", kind: "equity", source: "zode", value: "$10M", terms: "From the seed" },
        { label: "Class A pref", kind: "equity", value: "$10M", terms: "12%" },
        { label: "Class B pref", kind: "equity", value: "$102M", terms: "12%" },
        { label: "Construction loan", kind: "debt", value: "$85M", terms: "40% LTC · 10%" },
      ],
    },
    {
      row: "computeco",
      label: "Compute Cos",
      raising: { value: "$813M", label: "Pref equity" },
      layers: [
        { label: "ZODE equity", kind: "equity", source: "zode", value: "$29.3M", terms: "Toronto · Big Watt" },
        { label: "Pref equity", kind: "equity", value: "$813M", terms: "Calgary 15% · Big Watt 10%" },
        { label: "Subordinated loan", kind: "debt", value: "$15M", terms: "Alaska · ADC · 15%" },
        { label: "Customer prepayments", kind: "debt", value: "$605M", terms: "Big Watt offtake · 30%" },
        { label: "GPU debt", kind: "debt", value: "$1.21B", terms: "30% bank + 20% mezz" },
      ],
    },
  ],
  note: "Preliminary, from ZODE's master model of November 9, 2026, base case to December 2030. Amounts are what third parties put in; ZODE Inc.'s equity in each project comes from the seed. Debt is what the site build and the first GPU generation draw; GPU debt and prepayments together are capped at 85% of hardware. Alaska is from the October 7, 2026 term sheet with Alaska Data Corporation and is not yet in the model.",
};

const CLOSE: Slide = {
  id: "close",
  kind: "close",
  section: "Contact",
  eyebrow: "ZODE",
  title: "The industrialization of intelligence.",
  ground: "ink",
  lede: "Raising seed plus initial project preferred equity.",
  contact: "hello@zode.org · zode.org",
};

const CITED = [...PUBLIC_SLIDES, RAISE, ...DEMAND_DETAILS].flatMap((slide) => slide.sources ?? []);

export const FULL_SLIDES: readonly Slide[] = [
  ...PUBLIC_SLIDES,
  RAMP,
  RAISE,
  CLOSE,
  {
    id: "sources",
    kind: "sources",
    section: "Sources",
    eyebrow: "Sources",
    title: "All sources.",
    ground: "paper",
    cited: [...new Set(CITED)],
  },
];
