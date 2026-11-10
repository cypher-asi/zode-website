/**
 * MW contracted by year, not yet live: the deck's pipeline slide and the home
 * page's network section both read it, so the two can't drift apart. Its own
 * module, so the home page doesn't carry the deck's slides.
 */
export const BUILD_OUT_PLAN = [
  { year: "2027", value: "100 MW", mw: 100 },
  { year: "2028", value: "250 MW", mw: 250 },
  { year: "2029", value: "600 MW", mw: 600 },
  { year: "2030", value: "1,000 MW", mw: 1_000 },
] as const;
