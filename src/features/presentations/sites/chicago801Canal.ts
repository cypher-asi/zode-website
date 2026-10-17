import type { SiteContent } from "../types";

const PHOTOS = "Image: 601W marketing package.";

/**
 * 801 S Canal, Chicago, from the landlord's tenant deck and the concept
 * data room (Callan's concept design, PUE analysis and Tier III review,
 * WJE's structural findings), as of the August 2026 concept design.
 */
export const CHICAGO_801_CANAL: SiteContent = {
  name: "801 S Canal",
  caption: "The site · Canal Station, South Loop",
  lede: "A renovated six-story building in downtown Chicago, once a Northern Trust data center, with a 31 MW utility service, a geothermal-assisted plant and room in the building to grow.",
  folder: "chicago-801-canal",
  photo: { file: "building.jpg", caption: `801 S Canal Street, renovated as Canal Station. ${PHOTOS}` },
  property: {
    image: { file: "street.jpg", caption: `The renovated building and lobby entrance from S Canal Street. ${PHOTOS}` },
    facts: [
      { label: "Address", value: "801 S Canal St, Chicago, IL 60607, in the South Loop" },
      { label: "Building", value: "About 600,000 sf on six stories, Type I-A, recently renovated as Canal Station" },
      { label: "History", value: "Built in 1990 for Northern Trust, which ran a data center in it" },
      { label: "For ZODE", value: "About 200,000 sf: 50,000 sf of white space and 150,000 sf of gray space" },
      { label: "Clear height", value: "About 14 ft on floors 2 to 5 and 16 ft on floor 6" },
      { label: "Parcel", value: "A yard for transformers, generators, fuel and the geothermal wells, beside a rail corridor" },
    ],
  },
  why: {
    image: { file: "massing.jpg", caption: "Concept massing: the rooftop heat-rejection yard, acoustic wall and generator yard." },
    points: [
      { title: "Purpose-built reliability", text: "A Tier III, N+1 design across power and cooling, so it stays up while equipment is serviced." },
      { title: "Efficient by design", text: "A concept PUE near 1.18 means a lower power cost per IT kW and a cleaner sustainability story." },
      { title: "Carrier-rich and connected", text: "Four long-haul and eight metro carriers already at the building, with diverse-path fiber." },
      { title: "Room to grow", text: "Take capacity now, with a clear path to expand inside the building." },
    ],
  },
  capacity: {
    figures: [
      { value: "31 MW", label: "Utility service, ComEd 12.4 kV" },
      { value: "~100 MW", label: "Room to expand in the building" },
      { value: "23.8 MW", label: "Critical IT at design" },
      { value: "6,780 TR", label: "IT cooling load" },
    ],
    columns: [
      {
        title: "Power",
        items: [
          "Three existing ComEd vaults, about 7 MVA, carry Phase 1 on power already at the site",
          "A new vault brings the full 31 MW service",
          "15 MW of dual-fuel bridge turbines cover the interim",
        ],
      },
      {
        title: "Ready for liquid cooling",
        items: [
          "About 80% of the IT load on a 70/85°F facility-glycol loop, through CDUs and rear-door heat exchangers",
          "The rest on a chilled-water white-space loop",
        ],
      },
      {
        title: "Grow without moving",
        items: [
          "The powered-shell backbone is sized ahead of fit-out",
          "A phased build lets capacity follow demand",
          "Structural and site headroom already assessed",
        ],
      },
    ],
  },
  reliability: {
    lede: "A Tier III, N+1 approach: any single component can come offline for maintenance without dropping the critical load.",
    cells: [
      { title: "Concurrent maintainability", text: "Double-ended M-T-T-M switchgear, fully duplicated and PLC-actuated; either half shuts down with output held." },
      { title: "Redundant heat rejection", text: "Geothermal wells, adiabatic fluid coolers and trim chillers, each on an N+1 basis." },
      { title: "Standby generation", text: "N+1 prime-rated generators on separate boards, with 12 hours of full-load fuel on site." },
      { title: "Continuous power", text: "1 MW double-conversion UPS blocks of 250 kW modules, N+1, on lithium batteries." },
      { title: "Water resilience", text: "Two 170,000-gallon tanks: one serviced while the other covers 12 hours of makeup." },
      { title: "Bridging power", text: "Four 5 MW+ dual-fuel turbines on a looped N+1 ring bus while the new vault is built." },
    ],
    source: "Callan Consulting Engineers, Tier III single-point-of-failure review, August 7, 2026.",
  },
  efficiency: {
    rows: [
      { label: "Annual weighted", detail: "Concept-level screening", value: 1.184, outcome: true },
      { label: "Economizer mode", detail: "Wet bulb at or below 63°F, about 5,840 h", value: 1.171 },
      { label: "Trim-chiller mode", detail: "Peak and humid hours, about 2,920 h", value: 1.21 },
      { label: "Design basis", detail: "What the plant is sized for", value: 1.3 },
    ],
    figure: { value: "~5,840 h", label: "Free-cooling hours a year" },
    points: [
      "A PUE near 1.18 means less overhead energy for every IT kW",
      "Geothermal and free cooling take load off the compressors most of the year",
      "Reusing the building keeps embodied carbon well below a new build",
    ],
    source: "Callan Consulting Engineers, Preliminary PUE and Energy Analysis, July 29, 2026.",
  },
  plant: {
    image: { file: "roof.jpg", caption: "Rooftop heat-rejection yard, concept layout." },
    points: [
      "Two cooling towers, nine adiabatic fluid coolers and eight air-cooled trim chillers",
      "All behind a 25 ft acoustic barrier wall, modelled against Chicago and Illinois limits",
      "Data halls, the central plant and support fill the floors below",
      "Two modes keep it simple: economizer coolers when it's cool out, trim chillers when it's warm",
    ],
    inset: { file: "wells.jpg", caption: "Geothermal concept: eight wells along S Canal Street." },
  },
  location: {
    image: { file: "siteplan.jpg", caption: "Conceptual site plan: transformers, generators and fuel in the yard off S Canal Street." },
    points: [
      { title: "South Loop, Chicago", text: "An established downtown site rather than a greenfield on the edge of town, about 3 km from 350 E Cermak." },
      { title: "Carrier-rich connectivity", text: "Four long-haul and eight metro carriers already at the building, with diverse-path fiber entries." },
      { title: "On-parcel infrastructure", text: "Generators, transformers and fuel all fit on the existing site." },
      { title: "Rail and utility adjacency", text: "An adjacent rail corridor and utility feeds, coordinated with the canal-bridge work." },
    ],
  },
  disclaimer: "Concept design. Preliminary, not for construction. Figures are concept-level and subject to confirmation.",
};
