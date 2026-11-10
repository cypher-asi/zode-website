import "server-only";
import { DEMAND_DETAILS, PUBLIC_SLIDES, type ModelSlide, type Slide } from "./slides";

/**
 * The deck past project finance, for readers with data room access: the raise
 * and its SPV models, the close and the sources. Server-only, so the public
 * deck's bundle never carries it; see `deckSlides` in ./access.
 */

/** Off the sequence: the raise slide opens it over the deck from its deal. Printed, it follows that slide as a page. */
const COLO: ModelSlide = {
  id: "colo",
  kind: "model",
  section: "ZODE Colo I",
  eyebrow: "ZODE Colo I",
  title: "Leasing 50 MW.",
  ground: "paper",
  sites: [
    { name: "Mississauga", figure: "2 MW", detail: "128 nodes" },
    { name: "Chicago", figure: "24 MW", detail: "1,536 nodes · one phase signed" },
    { name: "Next colo", figure: "24 MW", detail: "1,536 nodes · site unidentified" },
  ],
  sitesNote: "14 clusters, 2 with a signed contract. 3,200 nodes and 25,600 GPUs.",
  layers: [
    { label: "Site acquisition equity", kind: "equity", value: "$20.5M", terms: ["Lease NRCs"] },
    { label: "Compute equity", kind: "equity", value: "$336M", terms: ["15% simple · 1.5x"] },
    { label: "Conversion debt", kind: "debt", value: "None", terms: ["Leased space"] },
    { label: "Customer prepayment", kind: "debt", value: "$935M", terms: ["25–30%"] },
    { label: "GPU financing", kind: "debt", value: "$817M", terms: ["12% · 1.15x DSCR"] },
  ],
  facts: [
    { value: "$2.14B", label: "GPU hardware" },
    { value: "$3.69B", label: "Contract value" },
    { value: "$11M", label: "Equity by Jan 2027" },
    { value: "$75M", label: "Equity by Oct 2027" },
    { value: "$17M", label: "Receivable loan, peak" },
    { value: "$206M", label: "ZODE residual" },
  ],
  cases: {
    label: "Investor returns, hold",
    columns: ["Downside", "Base", "Upside"],
    groups: [
      {
        label: "Colo I investors",
        rows: [
          { label: "Capital", cells: ["$505M", "$356M", "$209M"] },
          { label: "IRR · multiple", cells: ["10% · 1.44x", "17% · 1.71x", "26% · 2.07x"] },
        ],
      },
    ],
  },
  note: "Live base case, held to repayment. One raise funds both equity layers. The Chicago lease is unsigned and the next colo is not yet a named site.",
};

const RETRO: ModelSlide = {
  id: "retro",
  kind: "model",
  section: "ZODE Retro I",
  eyebrow: "ZODE Retro I",
  title: "Converting 50 MW with ZODE modules.",
  ground: "paper",
  sites: [
    { name: "Calgary I", figure: "22 MW", detail: "Five clusters · 2 MW third party" },
    { name: "Calgary II", figure: "13 MW", detail: "Three clusters · 1 MW third party" },
    { name: "Next 1", figure: "8 MW", detail: "Two clusters · not yet identified" },
    { name: "Next 2", figure: "8 MW", detail: "Two clusters · not yet identified" },
  ],
  sitesNote: "3,072 nodes · 24,576 GPUs.",
  layers: [
    { label: "Site acquisition equity", kind: "equity", value: "$193M", terms: ["12% pref · then 70/30"] },
    { label: "Compute equity", kind: "equity", value: "$373M", terms: ["15% simple · 1.5x"] },
    { label: "Conversion debt", kind: "debt", value: "$255M", terms: ["55% of price · 11%"] },
    { label: "Customer prepayment", kind: "debt", value: "$853M", terms: ["25%"] },
    { label: "GPU financing", kind: "debt", value: "$874M", terms: ["12% · 1.15x DSCR"] },
  ],
  facts: [
    { value: "$1.98B", label: "GPU hardware" },
    { value: "17% · 6.31x", label: "Site exit: hold to 2046" },
    { value: "39% · 2.84x", label: "Site exit: sale" },
    { value: "22% · 5.58x", label: "Site exit: refinancing" },
  ],
  cases: {
    label: "Investor returns, sale",
    columns: ["Downside", "Base", "Upside"],
    groups: [
      {
        label: "Site investors",
        rows: [
          { label: "Capital", cells: ["$271M", "$193M", "$148M"] },
          { label: "IRR · multiple", cells: ["13% · 1.48x", "39% · 2.84x", "55% · 4.01x"] },
        ],
      },
      {
        label: "Compute investors",
        rows: [
          { label: "Capital", cells: ["$677M", "$373M", "$271M"] },
          { label: "IRR · multiple", cells: ["12% · 2.51x", "18% · 2.51x", "25% · 2.68x"] },
        ],
      },
    ],
  },
  note: "October 20, 2026 sale case, with two sites not yet identified. Contract value, prepayment and GPU debt are the first GPU generation, from the workbook recalculated with those sites.",
};

const RAISE: Slide = {
  id: "raise",
  kind: "raise",
  section: "Capital raise",
  eyebrow: "Capital raise",
  title: "Raising equity for ZODE Colo I and ZODE Retro I.",
  ground: "paper",
  deals: [
    {
      id: "colo",
      icon: "node",
      title: "ZODE Colo I",
      overview: "Leasing 50 MW of data center space.",
      fleet: [
        { value: "50", label: "MW" },
        { value: "$3.69B", label: "Contract value" },
        { value: "3,200", label: "Nodes" },
        { value: "25,600", label: "GPUs" },
      ],
      layers: [
        {
          label: "Site acquisition equity",
          kind: "equity",
          value: "$20.5M",
          terms: ["Lease NRCs and deposits"],
          returns: "17% IRR · 1.71x",
        },
        {
          label: "Compute equity",
          kind: "equity",
          value: "$336M",
          terms: ["15% simple · 1.5x minimum"],
          returns: "17% IRR · 1.71x",
        },
        { label: "Conversion debt", kind: "debt", value: "None", terms: ["Leased, built space"] },
        {
          label: "Customer prepayment",
          kind: "debt",
          value: "$935M",
          terms: ["25–30% of contract value"],
        },
        {
          label: "GPU financing",
          kind: "debt",
          value: "$817M",
          terms: ["12% · 1.15x DSCR · up to 80% LTV"],
        },
      ],
      detail: COLO,
    },
    {
      id: "retro",
      icon: "building",
      title: "ZODE Retro I",
      overview: "Acquiring and converting 50 MW of data center space.",
      fleet: [
        { value: "51", label: "MW" },
        { value: "$3.41B", label: "Contract value" },
        { value: "3,072", label: "Nodes" },
        { value: "24,576", label: "GPUs" },
      ],
      layers: [
        {
          label: "Site acquisition equity",
          kind: "equity",
          value: "$193M",
          terms: ["12% pref · 95/5 co-invest"],
          returns: "39% IRR · 2.84x",
        },
        {
          label: "Compute equity",
          kind: "equity",
          value: "$373M",
          terms: ["15% simple · 1.5x minimum"],
          returns: "18% IRR · 2.51x",
        },
        {
          label: "Conversion debt",
          kind: "debt",
          value: "$255M",
          terms: ["55% of price · 60% of conversion · 11%"],
        },
        {
          label: "Customer prepayment",
          kind: "debt",
          value: "$853M",
          terms: ["25% of contract value"],
        },
        {
          label: "GPU financing",
          kind: "debt",
          value: "$874M",
          terms: ["12% · 1.15x DSCR · up to 80% LTV"],
        },
      ],
      detail: RETRO,
    },
  ],
  note: "Preliminary, from the October 2026 models: Colo I is the live base case, held through repayment, and Retro I the stored 51 MW sale case. Unsigned contracts assume 25% prepaid; GPU debt is sized to 1.15x DSCR, below its 80% LTV cap.",
};

const CLOSE: Slide = {
  id: "close",
  kind: "close",
  section: "Contact",
  eyebrow: "ZODE",
  title: "The industrialization of intelligence.",
  ground: "ink",
  lede: "Raising pre-seed plus initial project preferred equity.",
  contact: "hello@zode.org · zode.org",
};

const CITED = [...PUBLIC_SLIDES, RAISE, ...DEMAND_DETAILS].flatMap((slide) => slide.sources ?? []);

export const FULL_SLIDES: readonly Slide[] = [
  ...PUBLIC_SLIDES,
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
