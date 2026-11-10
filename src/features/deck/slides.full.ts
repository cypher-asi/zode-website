import "server-only";
import { REVENUE_RAMP } from "./revenueRamp";
import { DEMAND_DETAILS, LOGO_DIR, PUBLIC_SLIDES, type Slide } from "./slides";

/**
 * The deck past project finance, for readers with data room access: the team,
 * the raise, the close and the sources. Server-only, so the public deck's
 * bundle never carries it; see `deckSlides` in ./access.
 */

const quarterRevenue = ({ revenue }: (typeof REVENUE_RAMP.quarters)[number]) =>
  revenue.inference + revenue.merchant + revenue.offtake;
const PEAK = REVENUE_RAMP.quarters.reduce((best, q) => (quarterRevenue(q) > quarterRevenue(best) ? q : best));

/** The founder, the team's network and the key advisors; also read by the company profile (features/profile). */
export const TEAM: Extract<Slide, { kind: "team" }> = {
  id: "team",
  kind: "team",
  section: "Team",
  eyebrow: "Team",
  title: "Led by a three-time founder.",
  ground: "paper",
  founder: {
    role: "Founder & CEO",
    name: "Matthew J. Dorey",
    social: [{ network: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/frank-wilder/" }],
    main: {
      title: "Main quests",
      ventures: [
        {
          company: "Wilder World",
          href: "https://www.wilderworld.com",
          years: "2020–Present",
          role: "Co-founder, CEO & Executive Chairman",
          description: "Persistent simulation with Samsung, NVIDIA and Epic Games.",
          outcome: "$4 billion+ peak EV",
        },
        {
          company: "F0",
          years: "2011–2020",
          role: "Co-founder & CEO",
          description: "Venture studio for Apple, Nike, Google and the Fortune 100.",
          outcome: "Now HF0",
        },
        {
          company: "Curve Dental",
          href: "https://www.curvedental.com",
          years: "2004–2011",
          role: "Founder & CEO",
          description: "The #1 cloud-based dental EMR system.",
          outcome: "$1 billion+ current EV",
        },
      ],
    },
    side: {
      title: "Side quests",
      links: [
        { label: "cypher.net", href: "https://cypher.net" },
        { label: "zero.tech", href: "https://zero.tech" },
        { label: "zchain.org", href: "https://zchain.org" },
        { label: "aura.ai", href: "https://aura.ai" },
        { label: "zine.live", href: "https://zine.live" },
      ],
    },
  },
  network: {
    title: "Team members from",
    partnerLabel: "Key partnership",
    areas: [
      {
        label: "Compute",
        partner: { name: "San Francisco Compute Company", src: `${LOGO_DIR}/sf-compute.svg`, aspect: 2000 / 336, scale: 0.91 },
        logos: [
          { name: "OpenAI", src: `${LOGO_DIR}/openai.svg`, aspect: 288 / 78, scale: 0.91, center: 31 / 78 },
          { name: "Lambda", src: `${LOGO_DIR}/lambda.svg`, aspect: 196 / 42, scale: 0.95 },
          { name: "Voltage Park", src: `${LOGO_DIR}/voltage-park.svg`, aspect: 2542 / 350, scale: 0.95 },
        ],
      },
      {
        label: "Capital markets",
        partner: { name: "Ezra", src: `${LOGO_DIR}/ezra.svg`, aspect: 299 / 92, scale: 0.89 },
        logos: [
          { name: "Goldman Sachs", src: `${LOGO_DIR}/goldman-sachs.svg`, aspect: 192.76 / 85.04, scale: 0.94 },
          { name: "Brookfield", src: `${LOGO_DIR}/brookfield.svg`, aspect: 240 / 35.933, scale: 0.84 },
          { name: "Merrill", src: `${LOGO_DIR}/merrill.svg`, aspect: 150 / 43, scale: 1.04 },
        ],
      },
      {
        label: "Data centers",
        partner: { name: "Inovi", src: `${LOGO_DIR}/inovi.webp`, aspect: 900 / 212, scale: 0.82 },
        logos: [
          { name: "AWS", src: `${LOGO_DIR}/aws.svg`, aspect: 188.726 / 125.89, scale: 0.89 },
          { name: "Meta", src: `${LOGO_DIR}/meta.svg`, aspect: 948 / 191, scale: 0.87 },
          { name: "Google Cloud", src: `${LOGO_DIR}/google-cloud.svg`, aspect: 181 / 28, scale: 0.99 },
        ],
      },
      {
        label: "Manufacturing",
        partner: { name: "Foundry Robotics", src: `${LOGO_DIR}/foundry-robotics.svg`, aspect: 154 / 46, scale: 0.91 },
        logos: [
          { name: "SpaceX", src: `${LOGO_DIR}/spacex.svg`, aspect: 400 / 50, scale: 1.03 },
          { name: "Tesla", src: `${LOGO_DIR}/tesla.svg`, aspect: 993.047 / 100, scale: 0.95 },
          { name: "Blue Origin", src: `${LOGO_DIR}/blue-origin.svg`, aspect: 945 / 160, scale: 0.83 },
        ],
      },
    ],
  },
  advisors: {
    title: "Key advisors",
    people: [
      {
        name: "Ian Finder",
        company: { name: "NVIDIA", src: `${LOGO_DIR}/nvidia.svg`, aspect: 630.2 / 118.2, scale: 0.95 },
        feat: "Designed the Vera chip",
        linkedin: "https://www.linkedin.com/in/ifinder/",
      },
      {
        name: "Emal Alwis",
        company: { name: "Tesla", src: `${LOGO_DIR}/tesla.svg`, aspect: 993.047 / 100, scale: 1.25 },
        feat: "Third engineer on Tesla FSD",
        linkedin: "https://www.linkedin.com/in/emalwis/",
      },
      {
        name: "Nick Sammut",
        company: { name: "Crusoe", src: `${LOGO_DIR}/crusoe.svg`, aspect: 119 / 29, scale: 1.35 },
        feat: "$50B in compute deals",
        linkedin: "https://www.linkedin.com/in/nicholassammut/",
      },
      {
        name: "Dan Rosen",
        company: { name: "Ezra", src: `${LOGO_DIR}/ezra.svg`, aspect: 299 / 92, scale: 1.3 },
        feat: "$15B in distributed energy",
        linkedin: "https://www.linkedin.com/in/danielrosen2/",
      },
      {
        name: "Jaspar Weir",
        company: { name: "TaskUs", src: `${LOGO_DIR}/taskus.svg`, aspect: 4581 / 944, scale: 1.35 },
        feat: "Built a 20,000-person company",
        linkedin: "https://www.linkedin.com/in/jasparweir/",
      },
      {
        name: "Steven Lacy",
        company: { name: "Apple", src: `${LOGO_DIR}/apple.svg`, aspect: 1, scale: 1.35 },
        feat: "Cybersecurity task force",
        linkedin: "https://www.linkedin.com/in/thestevelacy/",
      },
    ],
  },
};

/** The model's months before 2027 earn nothing, so the ramp starts with 2027. */
const fromFirstYear = (periods: (typeof REVENUE_RAMP)["quarters"]) =>
  periods.filter((p) => Number(p.period.slice(-4)) >= 2027);

/** The consolidated model by quarter, month and year, from ./revenueRamp, which scripts/write-revenue-ramp.mjs writes. */
const RAMP: Slide = {
  id: "revenue-ramp",
  kind: "ramp",
  section: "Revenue ramp",
  eyebrow: "Revenue ramp",
  title: `Revenue ramps to $${(quarterRevenue(PEAK) / 1e9).toFixed(1)}B a quarter by ${PEAK.period}.`,
  ground: "paper",
  quarters: fromFirstYear(REVENUE_RAMP.quarters),
  months: fromFirstYear(REVENUE_RAMP.months),
  years: fromFirstYear(REVENUE_RAMP.years),
  note: `Preliminary, from ZODE's master model of November 9, 2026 (${REVENUE_RAMP.model}, ZODE ASCENT data room), base case to December 2030, with Big Watt adding 30 MW a quarter from June 2027 to 570 MW, and 250 MW of generic future sites added in 2029, growing 20% a year. Each bar is the period's consolidated revenue, split into its cash costs, its debt service and the cash left: the model's EBITDA less interest paid and debt repaid, before spending on new sites and GPUs, which project debt and equity fund. Depreciation isn't cash, so it isn't shown. Op costs are colocation rent and site and cluster operations. TopCo is ZODE Inc.'s staffing and G&A.`,
};

/**
 * From the ZODE ASCENT data room: ZODE_MasterModel_26.11.09.xlsx, base case to
 * December 2030 as the room's summaries cut it. Debt is what the site build and
 * the first GPU generation draw. Update with each new model.
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
    value: "$55M",
    basis: "Seed SAFE · $300M post-money cap",
    detail: "Team, development and the common equity of each project",
    uses: "$39.3M into the projects · $21.5M team and G&A through 2028",
  },
  projects: [
    {
      name: "ZODE Toronto",
      tenure: "lease",
      computeCo: { detail: "512 B300 GPUs · 1 MW", value: "$19.3M", basis: "ZODE-funded", source: "zode" },
    },
    {
      name: "ZODE Calgary",
      tenure: "own",
      propCo: { detail: "Buys and converts 30 MW", value: "$112M", basis: "Pref · + $10M ZODE" },
      computeCo: { detail: "18,420 GPUs · 30 MW", value: "$423M", basis: "Pref · 15%" },
    },
    {
      name: "ZODE Big Watt",
      tenure: "lease",
      computeCo: { detail: "15,360 GPUs · 30 MW", value: "$390M", basis: "Pref · + $10M ZODE" },
    },
  ],
  stacks: [
    {
      row: "topco",
      label: "Top Co",
      raising: { value: "$55M", label: "Seed" },
      layers: [{ label: "Seed SAFE", kind: "equity", amount: 55e6, terms: "$300M post-money cap" }],
    },
    {
      row: "propco",
      label: "Prop Cos",
      raising: { value: "$112M", label: "Pref equity" },
      layers: [
        { label: "ZODE pref", kind: "equity", source: "zode", amount: 10e6, terms: "Calgary Class A · 12%" },
        { label: "Class A pref", kind: "equity", amount: 10e6, terms: "12%" },
        { label: "Class B pref", kind: "equity", amount: 102e6, terms: "12%" },
        { label: "Construction loan", kind: "debt", amount: 85e6, terms: "40% LTC · 10%" },
      ],
    },
    {
      row: "computeco",
      label: "Compute Cos",
      raising: { value: "$813M", label: "Pref equity" },
      layers: [
        { label: "ZODE equity", kind: "equity", source: "zode", amount: 19.3e6, terms: "Toronto" },
        { label: "ZODE pref", kind: "equity", source: "zode", amount: 10e6, terms: "Big Watt" },
        { label: "Pref equity", kind: "equity", amount: 813e6, terms: "Calgary 15% · Big Watt 10%" },
        { label: "Customer prepayments", kind: "debt", amount: 605e6, terms: "Big Watt offtake · 30%" },
        { label: "GPU debt", kind: "debt", amount: 1.21e9, terms: "30% bank + 20% mezz" },
      ],
    },
  ],
  note: "Preliminary, from ZODE's master model of November 9, 2026, base case to December 2030. Amounts are what third parties put in; ZODE Inc.'s equity in each project comes from the seed. Debt is what the site build and the first GPU generation draw; GPU debt and prepayments together are capped at 85% of hardware.",
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

const CITED = [...PUBLIC_SLIDES, TEAM, RAISE, ...DEMAND_DETAILS].flatMap((slide) => slide.sources ?? []);

export const FULL_SLIDES: readonly Slide[] = [
  ...PUBLIC_SLIDES,
  TEAM,
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
