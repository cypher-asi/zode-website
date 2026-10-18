import type { SiteContent } from "../types";

const PHOTOS = "Image: 601W marketing package.";

/**
 * 801 S Canal, Chicago, from the landlord's tenant deck and the concept
 * data room (Callan's concept design, PUE analysis and Tier III review,
 * WJE's structural findings), as of the August 2026 concept design, and
 * the team from Alosanar's representative experience summary.
 */
export const CHICAGO_801_CANAL: SiteContent = {
  name: "801 S Canal",
  caption: "The site · South Loop, Chicago",
  lede: "A former Northern Trust data center, renovated as Canal Station.",
  folder: "chicago-801-canal",
  photo: { file: "building.jpg", caption: PHOTOS },
  property: {
    image: { file: "street.jpg", caption: `Lobby entrance on S Canal Street. ${PHOTOS}` },
    facts: [
      { label: "Building", value: "About 600,000 sf on six stories, Type I-A, built in 1990" },
      { label: "For ZODE", value: "About 200,000 sf: 50,000 sf of white space and 150,000 sf of gray space" },
      { label: "Clear height", value: "About 14 ft on floors 2 to 5 and 16 ft on floor 6" },
      { label: "Parcel", value: "A yard for transformers, generators, fuel and the geothermal wells" },
    ],
  },
  why: [
    { title: "Power in the building today", text: "Phase 1 runs on ComEd service already at the site, with room to grow to about 100 MW." },
    { title: "Tier III reliability", text: "Power and cooling can be serviced without dropping the load." },
    { title: "PUE of 1.18", text: "Geothermal-assisted free cooling most of the year keeps the power cost per IT kW low." },
    { title: "Downtown and connected", text: "In the South Loop, with twelve carriers already in the building." },
  ],
  capacity: {
    figures: [
      { value: "5 MW", label: "Available today" },
      { value: "31 MW", label: "ComEd service, 12.4 kV" },
      { value: "~100 MW", label: "Room to expand" },
      { value: "23.8 MW", label: "Critical IT at design" },
      { value: "6,780 TR", label: "IT cooling load" },
    ],
    columns: [
      {
        title: "Power",
        items: [
          "Three existing ComEd vaults, about 7 MVA, carry Phase 1",
          "A fourth vault completes the service",
        ],
      },
      {
        title: "Ready for liquid cooling",
        items: [
          "About 80% of the IT load on a 70/85°F facility-glycol loop, through CDUs and rear-door heat exchangers",
          "The rest on a chilled-water loop",
        ],
      },
      {
        title: "Grow without moving",
        items: [
          "The powered-shell backbone is sized ahead of fit-out",
          "Each phase adds capacity as demand comes",
          "Structural and site headroom already assessed",
        ],
      },
    ],
  },
  reliability: {
    lede: "Tier III with N+1 throughout: any single component can be taken out for maintenance without dropping the critical load.",
    cells: [
      { title: "Switchgear", text: "Double-ended M-T-T-M, fully duplicated and PLC-actuated; either half can shut down with the load held." },
      { title: "Heat rejection", text: "A spare at every stage, from the geothermal wells through the fluid coolers to the trim chillers." },
      { title: "Standby generation", text: "Prime-rated generators on separate boards, with 12 hours of full-load fuel on site." },
      { title: "UPS", text: "1 MW double-conversion blocks of 250 kW modules, on lithium batteries." },
      { title: "Water", text: "Two 170,000-gallon tanks, either covering 12 hours of makeup while the other is serviced." },
      { title: "Bridging power", text: "Four 5 MW+ dual-fuel turbines on a looped ring bus carry the site until the fourth vault is in service." },
    ],
    source: "Callan Consulting Engineers, Tier III single-point-of-failure review, August 7, 2026.",
  },
  efficiency: {
    rows: [
      { label: "Annual weighted", detail: "Blended across the year", value: 1.184, outcome: true },
      { label: "Economizer mode", detail: "Wet bulb at or below 63°F", value: 1.171 },
      { label: "Trim-chiller mode", detail: "Peak and humid hours", value: 1.21 },
      { label: "Design basis", detail: "What the plant is sized for", value: 1.3 },
    ],
    figure: { value: "~5,840 h", label: "Free-cooling hours a year" },
    points: [
      "Less overhead energy for every IT kW",
      "Reusing the building keeps embodied carbon well below a new build",
    ],
    source: "Callan Consulting Engineers, Preliminary PUE and Energy Analysis, July 29, 2026.",
  },
  plant: {
    image: { file: "roof.jpg", caption: "Roof plan." },
    points: [
      "Two cooling towers, nine adiabatic fluid coolers and eight air-cooled trim chillers",
      "Behind a 25 ft acoustic wall, modelled against Chicago and Illinois noise limits",
      "Data halls, central plant and support space on the floors below",
    ],
    inset: { file: "wells.jpg", caption: "Geothermal well field: eight wells along S Canal Street." },
  },
  location: {
    image: { file: "siteplan.jpg", caption: "Site plan." },
    points: [
      { title: "Twelve carriers", text: "Four long-haul and eight metro, entering the building over diverse paths." },
      { title: "Near 350 E Cermak", text: "About 3 km from Chicago's largest carrier hotel." },
      { title: "Rail and utilities", text: "Beside a rail corridor and utility feeds, coordinated with the canal-bridge work." },
    ],
  },
  team: {
    experience: {
      groups: [
        {
          title: "Data center · Six Microsoft campuses, more than 2 GW",
          rows: [
            { company: "Microsoft", project: "Boydton", location: "Virginia", scale: "700 MW–1 GW+", role: "Engineering digitization · Cx modernization · turnover · operations" },
            { company: "Microsoft", project: "Quincy", location: "Washington", scale: "350+ MW", role: "Campus expansion · commissioning · operational onboarding" },
            { company: "Microsoft", project: "East Wenatchee", location: "Washington", scale: "350+ MW", role: "New facility delivery · integration · commissioning readiness" },
            { company: "Microsoft", project: "San Antonio", location: "Texas", scale: "400+ MW", role: "Construction delivery · integrated systems testing · readiness" },
            { company: "Microsoft", project: "Goodyear", location: "Arizona", scale: "300+ MW", role: "Infrastructure delivery · commissioning · asset lifecycle" },
            { company: "Microsoft", project: "Cheyenne", location: "Wyoming", scale: "250+ MW", role: "Expansion planning · commissioning · operational integration" },
          ],
        },
        {
          title: "Commercial real estate",
          rows: [
            { company: "Microsoft", project: "Microsoft GWS", location: "Global", scale: "38M sf", role: "Digital transformation · standards · operations · decarbonization" },
            { company: "Microsoft", project: "Microsoft East Campus", location: "Redmond, WA", scale: "HQ campus", role: "Design and construction lead · systems integration · readiness" },
            { company: "Wells Fargo", project: "National OT Cybersecurity", location: "USA", scale: "800 sites", role: "Strategy development · site PMO execution" },
            { company: "Duke Energy", project: "Duke Energy Center", location: "Charlotte, NC", scale: "1.5M sf", role: "Converged building systems · OT cybersecurity · controls" },
            { company: "Warner Bros. Discovery", project: "30 Hudson Yards", location: "New York, NY", scale: "1.1M sf", role: "Smart-building design · commissioning · OT cybersecurity" },
            { company: "JPMorgan Chase", project: "JPMorgan Chase HQ", location: "New York, NY", scale: "2.5M sf", role: "CRE technology · building systems convergence · concept to completion" },
          ],
        },
        {
          title: "Government and mission-critical",
          rows: [
            { company: "GSA", project: "GSA Headquarters", location: "Washington, DC", scale: "724K sf", role: "Smart buildings · integrated systems · commissioning · OT cybersecurity" },
            { company: "GSA", project: "GSAlink", location: "National", scale: "370M sf", role: "Secure BAS standards · analytics and FDD · portfolio data normalization" },
            { company: "U.S. Army", project: "Fort Benning Base of the Future", location: "Fort Benning, GA", scale: "Base", role: "Digital platform strategy · stakeholder alignment · site readiness · resilience" },
          ],
        },
      ],
      note: "Also: Hines, Alexandria, Wells Fargo, Oxford, PGIM, BMO, Kaiser Permanente, Dell, Bank of America, Related, GWL Realty Advisors and Ivanhoé Cambridge.",
    },
    slides: [
      {
        title: "Project team",
        lede: "Alosanar is developing the site.",
        members: [
          {
            name: "Emmanuel Daniel",
            company: "Alosanar",
            role: "CEO and CTO",
            bio: "A senior Microsoft executive who ran its global data center development, portfolio, operations and risk, growing the portfolio from about 200 facilities to more than 500 on investment approaching $2 billion a month. Before that he led Microsoft's worldwide smart-buildings and Digital Integration Platform.",
          },
          {
            name: "Tom Shircliff",
            company: "Alosanar",
            role: "Corporate strategy and partners",
            bio: "More than 20 years advising many of the largest commercial real estate owners, investors and operators. As co-founder of Intelligent Buildings he built one of the industry's largest connected-building analytics portfolios, over 100 million sf. A gubernatorial appointee on energy strategy.",
          },
          {
            name: "James Vogtsberger",
            company: "Alosanar",
            role: "PMO director",
            bio: "More than 20 years running portfolios, programs and projects for Fortune 500 customers across complex technical and infrastructure work, now on Alosanar's edge data centers, smart buildings and AI-driven infrastructure. M.S. Project Management; PMP, Certified Scrum Master, Six Sigma Green Belt.",
          },
          {
            name: "Jeff Just",
            company: "Alosanar",
            role: "Telecom and broadband",
            bio: "A 30-year entrepreneur in development, acquisitions, finance and asset management. He founded Dianet Communications and helped structure and finance Transit Wireless's ~$200 million neutral-host network for the New York City Subway, and now supports shared wireless networks across more than 400 million sf.",
          },
        ],
      },
      {
        title: "Delivery partners",
        lede: "The engineers and builders delivering it with Alosanar.",
        members: [
          {
            name: "Julia Ingersoll",
            company: "Callan Consulting Engineers",
            role: "President and managing principal",
            bio: "Illinois PE and Uptime Institute Certified Data Center Design Professional; B.S. Mechanical Engineering, UW-Madison. Callan prepared the site's concept design and specializes in commercial-to-data-center conversions.",
          },
          {
            name: "Dan McJacobson",
            company: "Callan Consulting Engineers",
            role: "Managing principal",
            bio: "Illinois PE with commissioning (BCxP), WELL AP and LEED AP credentials. Callan's conversions phase power from capacity already on site and reuse existing hydronic plant, towers and chillers.",
          },
          {
            name: "David Langhamer",
            company: "DW Hammer",
            role: "Principal and founder",
            bio: "Founded the Chicago general contractor in 2010 after co-founding another Chicago firm, with more than $1 billion in construction. LEED AP, PMP. DW Hammer builds data halls and upgrades live mission-critical sites.",
          },
          {
            name: "Aidan McGovern",
            company: "DW Hammer",
            role: "Principal and director",
            bio: "A long-time collaborator of David Langhamer's; BSc Construction Management, Limerick Institute of Technology. DW Hammer's mission-critical work includes Morningstar, Northwestern University and Fiserv.",
          },
          {
            name: "Bob Gardner",
            company: "Gardner Builders",
            role: "Founder, president and CEO",
            bio: "Founded the Minneapolis contractor in 2010, now about 200 to 240 people. Its data center practice covers edge, colocation, AI inference and office conversions, including the 18,000 sf Core42 data center in Minneapolis.",
          },
        ],
      },
    ],
    source: "Alosanar, Representative Experience & Case Studies, September 2026.",
  },
};
