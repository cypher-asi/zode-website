/**
 * Loads the team's capital raise targets into ZRM in DATABASE_URL: each firm
 * as a company, tagged Investor or VC, with its contact as a person there,
 * and a Fundraising opportunity for it at Target.
 *
 *   npm run fundraising:import
 *
 * Additive: firms match existing companies on name (or an alias),
 * case-insensitively, and only fill in the fields those leave empty;
 * contacts match on name at their firm; a firm that already has a
 * Fundraising opportunity gets no second one. So edits made in ZRM survive a
 * re-run. The firm details come from public sources as of November 2026; the
 * ones that couldn't be matched to a firm say so in their opportunity's notes.
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[fundraising:import] DATABASE_URL is not set; add it to .env.local.");
  process.exit(1);
}

const SOURCE = "Fundraising list";

/** The company types the firms are tagged with, as the list groups them. */
const TYPES = { Investor: "#0EA5E9", VC: "#A855F7" };

const US = "United States";

/*
 * [type, deal type, company, contact, notes]. The company's `name` is what
 * it's listed as; `aliases` are other names an existing company might have.
 */
const FIRMS = [
  ["Investor", "Private credit", {
    name: "Crayhill Capital Management",
    aliases: ["Crayhill"],
    website: "https://www.crayhill.com",
    domain: "crayhill.com",
    industry: "Private credit",
    company_type: "Asset manager",
    description:
      "Asset-based finance manager providing structured private credit backed by assets with contracted cash flows: loans, leases, receivables, royalties and subsidies. Sectors include renewable energy, specialty finance, equipment finance and structured real estate.",
    founded_year: 2015,
    city: "New York", state: "NY", country: US,
    specialties: ["Asset-based finance", "Private credit", "Equipment finance", "Renewable energy"],
  }],
  ["Investor", "Private credit", {
    name: "Eagle Point Credit Management",
    aliases: ["EaglePoint", "Eagle Point"],
    website: "https://www.eaglepointcredit.com",
    domain: "eaglepointcredit.com",
    industry: "Private credit",
    company_type: "Asset manager",
    description:
      "Specialist credit manager (about $14B AUM) focused on income-oriented strategies: CLO equity and debt, portfolio debt securities and other opportunities across the credit universe.",
    founded_year: 2012,
    city: "Greenwich", state: "CT", country: US,
    specialties: ["CLOs", "Portfolio debt", "Structured credit"],
  }],
  ["Investor", "Private credit", {
    name: "Keyframe Capital Partners",
    aliases: ["Keyframe"],
    website: "https://www.keyframecapital.com",
    domain: "keyframecapital.com",
    industry: "Private credit",
    company_type: "Investment firm",
    description:
      "Flexible-capital investor in energy transition, transportation and physical infrastructure, investing across the capital stack (equity, convertible notes, asset-backed and project facilities), typically $25M to $75M.",
    city: "New York", state: "NY", country: US,
    specialties: ["Energy transition", "Asset-backed facilities", "Project finance", "Special situations"],
  }],
  ["Investor", "Growth equity", { name: "BWA" }, null,
    "Firm not confirmed: no investor called BWA turned up in public sources. Confirm who this is, and set the deal type (Growth equity is a placeholder)."],
  ["Investor", "Infrastructure", {
    name: "Macquarie",
    aliases: ["Macquarie Group", "Macquarie Asset Management", "Macquarie Capital"],
    website: "https://www.macquarie.com",
    domain: "macquarie.com",
    industry: "Infrastructure investing",
    company_type: "Financial group",
    description:
      "Global financial group. Macquarie Asset Management is one of the world's largest infrastructure investors, and Macquarie Capital invests in and finances digital infrastructure and energy.",
    founded_year: 1969,
    city: "Sydney", country: "Australia",
    ticker: "MQG",
    specialties: ["Infrastructure", "Digital infrastructure", "Energy"],
  }],
  ["Investor", "Private credit", {
    name: "Blue Owl Capital",
    aliases: ["Blue Owl"],
    website: "https://www.blueowl.com",
    domain: "blueowl.com",
    industry: "Private credit",
    company_type: "Asset manager",
    description:
      "Alternative asset manager across credit, GP strategic capital and real assets. Its funds finance AI and data center infrastructure, e.g. leading a $2.4B GPU equipment financing for IREN in August 2026.",
    founded_year: 2021,
    city: "New York", state: "NY", country: US,
    ticker: "OWL",
    specialties: ["Private credit", "Digital infrastructure", "GPU financing", "Real assets"],
  }],
  ["Investor", "Debt", { name: "Covalt" }, null,
    "Debt. Firm not confirmed: the only Covalt in public sources is a Paris loan-monitoring software company (covalt.eu), not a lender. Confirm who this is."],
  ["Investor", "Venture equity", {
    name: "Karman Ventures",
    aliases: ["Karman"],
    website: "https://karman.vc",
    domain: "karman.vc",
    linkedin_url: "https://www.linkedin.com/company/karman-vc",
    industry: "Venture capital",
    company_type: "Venture firm",
    description:
      "Venture firm backing AI-native companies in critical industries, pre-seed to pre-IPO, from a $40M debut fund closed in October 2025. Portfolio includes Crusoe, Anduril and Hadrian.",
    location: "Austin, TX and Santa Monica, CA",
    country: US,
    specialties: ["AI infrastructure", "Physical AI", "Energy", "Defense"],
  }, null, "Matched to Karman Ventures (karman.vc); confirm that's the right Karman."],
  ["Investor", "Private credit", {
    name: "CurvePoint Capital",
    aliases: ["Curvepoint"],
    website: "https://curvepointcapital.com",
    domain: "curvepointcapital.com",
    linkedin_url: "https://www.linkedin.com/company/curvepoint-capital",
    industry: "Private credit",
    company_type: "Investment firm",
    description:
      "Structured capital for growth-stage energy and industrial businesses: enterprise loans and asset-backed financings of $15M to over $100M.",
    founded_year: 2024,
    city: "Los Angeles", state: "CA", country: US,
    specialties: ["Structured capital", "Asset-backed finance", "Energy systems", "Industrial technology"],
  }],
  ["Investor", "Infrastructure", { name: "Denim" }, null,
    "Firm not confirmed: could be Denim Capital (denim.vc, a Boulder seed syndicate) or Denham Capital (denhamcapital.com, energy transition infrastructure equity and credit focused on power for data centers). Confirm, and set the deal type (Infrastructure is a placeholder)."],
  ["Investor", "Private credit", {
    name: "Fiera Capital",
    aliases: ["Fiera"],
    website: "https://www.fiera.com",
    domain: "fiera.com",
    industry: "Asset management",
    company_type: "Asset manager",
    description:
      "Independent asset manager (about US$120B AUM). Fiera Infrastructure Private Debt lends to North American mid-market infrastructure: power, renewables, transportation and telecom.",
    city: "Montreal", state: "QC", country: "Canada",
    ticker: "FSZ",
    specialties: ["Infrastructure debt", "Project finance", "Private markets"],
  }, {
    first_name: "Sergio",
    last_name: "Figueroa Sanz",
    title: "Head of U.S. Infrastructure Debt",
    linkedin_url: "https://www.linkedin.com/in/sergio-figueroa-sanz-0014b136",
  }],
  ["Investor", "Private credit", {
    name: "Bracebridge Capital",
    aliases: ["BraceBridge"],
    website: "https://www.bracebridgecapital.com",
    domain: "bracebridgecapital.com",
    linkedin_url: "https://www.linkedin.com/company/bracebridge-capital-llc",
    industry: "Hedge fund",
    company_type: "Asset manager",
    description:
      "Hedge fund (about $12B AUM) running a fixed income relative value strategy across rates, corporate credit, emerging markets and structured products.",
    founded_year: 1994,
    city: "Boston", state: "MA", country: US,
    specialties: ["Fixed income", "Relative value", "Structured products"],
  }],
  ["VC", "Venture equity", {
    name: "Andreessen Horowitz",
    aliases: ["a16z"],
    website: "https://a16z.com",
    domain: "a16z.com",
    industry: "Venture capital",
    company_type: "Venture firm",
    description: "Multi-stage venture firm investing across AI, infrastructure, fintech, American dynamism, crypto, bio and consumer.",
    founded_year: 2009,
    city: "Menlo Park", state: "CA", country: US,
    specialties: ["Fintech", "AI", "Infrastructure"],
  }, { first_name: "David", last_name: "Haber", title: "General Partner, Fintech" }, "Waiting."],
  ["VC", "Venture equity", {
    name: "Lowercarbon Capital",
    aliases: ["Lower Carbon", "Lowercarbon"],
    website: "https://lowercarbon.com",
    domain: "lowercarbon.com",
    industry: "Venture capital",
    company_type: "Venture firm",
    description: "Climate venture firm investing pre-seed to pre-IPO in energy, advanced manufacturing, climate resilience and more.",
    founded_year: 2018,
    city: "Los Angeles", state: "CA", country: US,
    specialties: ["Climate", "Energy", "Advanced manufacturing"],
  }, {
    first_name: "Clay",
    last_name: "Dumas",
    title: "Founding and General Partner",
    linkedin_url: "https://www.linkedin.com/in/clay-dumas",
  }, "Waiting."],
  ["VC", "Venture equity", {
    name: "Union Square Ventures",
    aliases: ["USV"],
    website: "https://www.usv.com",
    domain: "usv.com",
    industry: "Venture capital",
    company_type: "Venture firm",
    description:
      "Early-stage venture firm investing in companies at the edge of large markets transformed by technology, including AI, energy, robotics and manufacturing. Raised $900M across its 2026 early-stage and opportunity funds.",
    founded_year: 2003,
    city: "New York", state: "NY", country: US,
    specialties: ["AI", "Energy", "Networks"],
  }, {
    first_name: "Nick",
    last_name: "Grossman",
    title: "General Partner",
    linkedin_url: "https://www.linkedin.com/in/nickgrossman",
  }, "The list names Nick; matched to Nick Grossman, a USV general partner."],
  ["VC", "Private credit", {
    name: "Upper90",
    aliases: ["Upper 90"],
    website: "https://upper90.io",
    domain: "upper90.io",
    industry: "Private credit",
    company_type: "Hybrid credit and equity fund",
    description:
      "Hybrid fund leading with credit (about 90% credit, 10% equity): $5M to $30M asset-backed facilities for seed to Series B companies with predictable revenue or collateral, including AI infrastructure such as Crusoe.",
    founded_year: 2018,
    location: "New York, NY and Providence, RI",
    city: "New York", state: "NY", country: US,
    specialties: ["Asset-backed credit", "Fintech", "AI infrastructure"],
  }, null, "Ask Nick for an intro."],
  ["VC", "Venture equity", {
    name: "Planeteer Capital",
    aliases: ["Planeteer"],
    industry: "Venture capital",
    company_type: "Venture firm",
    description:
      "Climate-first pre-seed and seed venture firm that leads rounds, with a $54M first fund closed in 2025. Focuses on carbon management, industrial decarbonization, the built environment and climate intelligence.",
    city: "New York", state: "NY", country: US,
    specialties: ["Climate", "Pre-seed", "Seed"],
  }, { first_name: "Sophie", last_name: "Purdom", title: "Managing Partner" }],
  ["VC", "Venture equity", {
    name: "Stepchange Ventures",
    aliases: ["StepChange", "Stepchange"],
    website: "https://www.stepchange.vc",
    domain: "stepchange.vc",
    industry: "Venture capital",
    company_type: "Venture firm",
    description:
      "Early-stage climate fund backing asset-light, software-led solutions with immediate commercial pull, across transportation, the built environment, energy and the grid, AI infrastructure and resilience.",
    city: "Seattle", state: "WA", country: US,
    specialties: ["Climate software", "Energy", "AI infrastructure"],
  }, { first_name: "Anay", last_name: "Shah", title: "Co-founder and Managing Partner", email: "anay@stepchange.vc" }],
  ["VC", "Venture equity", {
    name: "Radical Ventures",
    aliases: ["Radical"],
    website: "https://radical.vc",
    domain: "radical.vc",
    industry: "Venture capital",
    company_type: "Venture firm",
    description: "AI-focused venture firm investing from seed to growth.",
    founded_year: 2017,
    city: "Toronto", state: "ON", country: "Canada",
    specialties: ["AI"],
  }],
  ["VC", "Venture equity", {
    name: "Energy Impact Partners",
    aliases: ["EIP"],
    website: "https://www.energyimpactpartners.com",
    domain: "energyimpactpartners.com",
    industry: "Venture capital",
    company_type: "Investment firm",
    description: "Energy transition investor backed by utilities and corporates, investing across venture, growth and credit.",
    founded_year: 2015,
    city: "New York", state: "NY", country: US,
    specialties: ["Energy transition", "Grid", "Power"],
  }],
  ["VC", "Venture equity", {
    name: "Bain Capital Ventures",
    aliases: ["BCV"],
    website: "https://www.baincapitalventures.com",
    domain: "baincapitalventures.com",
    industry: "Venture capital",
    company_type: "Venture firm",
    description: "Multi-stage venture arm of Bain Capital, investing from seed to growth in AI, infrastructure, fintech and commerce.",
    founded_year: 2001,
    city: "Boston", state: "MA", country: US,
    specialties: ["AI", "Infrastructure", "Fintech"],
  }],
  ["VC", "Venture equity", {
    name: "Felicis",
    aliases: ["Felicis Ventures"],
    website: "https://www.felicis.com",
    domain: "felicis.com",
    industry: "Venture capital",
    company_type: "Venture firm",
    description: "Multi-stage venture firm, active in AI and infrastructure.",
    founded_year: 2006,
    city: "Menlo Park", state: "CA", country: US,
    specialties: ["AI", "Infrastructure"],
  }],
];

const COMPANY_COLUMNS = [
  "website", "domain", "linkedin_url", "industry", "company_type", "description",
  "founded_year", "location", "city", "state", "country", "ticker",
];

const sql = neon(url);
const counts = { companies: 0, filled: 0, people: 0, opportunities: 0 };

const typeIds = {};
for (const [name, color] of Object.entries(TYPES)) {
  const [row] = await sql`
    insert into zrm_types (name, color) values (${name}, ${color})
    on conflict (name) do update set updated_at = zrm_types.updated_at
    returning id
  `;
  typeIds[name] = row.id;
}

const [target] = await sql`select id from zrm_stages where pipeline = 'fundraising' order by position limit 1`;
if (!target) throw new Error("[fundraising:import] no Fundraising stages; run npm run db:migrate first.");

/** The firm's company: an existing one by name or alias, its empty fields filled in, or a new one. */
async function companyFor(firm) {
  const names = [firm.name, ...(firm.aliases ?? [])].map((name) => name.toLowerCase());
  const [existing] = await sql`select id from zrm_companies where lower(name) = any(${names}) order by created_at limit 1`;
  const columns = COMPANY_COLUMNS.filter((column) => firm[column] != null);
  const values = columns.map((column) => firm[column]);
  const specialties = firm.specialties ?? [];
  if (!existing) {
    const [row] = await sql.query(
      `insert into zrm_companies (name, source, specialties${columns.map((c) => `, ${c}`).join("")})
       values ($1, $2, $3${columns.map((_, i) => `, $${i + 4}`).join("")}) returning id`,
      [firm.name, SOURCE, specialties, ...values],
    );
    counts.companies++;
    return row.id;
  }
  const sets = [
    ...columns.map((c, i) => `${c} = coalesce(${c}, $${i + 3})`),
    "specialties = case when cardinality(specialties) = 0 then $2 else specialties end",
  ];
  const empty = [...(specialties.length ? ["cardinality(specialties) = 0"] : []), ...columns.map((c) => `${c} is null`)];
  if (empty.length === 0) return existing.id;
  const [filled] = await sql.query(
    `update zrm_companies set ${sets.join(", ")}, updated_at = now()
     where id = $1 and (${empty.join(" or ")})
     returning id`,
    [existing.id, specialties, ...values],
  );
  if (filled) counts.filled++;
  return existing.id;
}

async function contactFor(contact, companyId) {
  if (!contact) return null;
  const [existing] = await sql`
    select id from zrm_people
    where lower(first_name) = ${contact.first_name.toLowerCase()}
      and lower(coalesce(last_name, '')) = ${(contact.last_name ?? "").toLowerCase()}
      and company_id = ${companyId}
    order by created_at limit 1
  `;
  if (existing) return existing.id;
  const [row] = await sql`
    insert into zrm_people (first_name, last_name, title, email, linkedin_url, company_id, source)
    values (${contact.first_name}, ${contact.last_name ?? null}, ${contact.title ?? null}, ${contact.email ?? null},
      ${contact.linkedin_url ?? null}, ${companyId}, ${SOURCE})
    returning id
  `;
  counts.people++;
  return row.id;
}

for (const [type, dealType, firm, contact = null, notes = null] of FIRMS) {
  const companyId = await companyFor(firm);
  await sql`
    insert into zrm_company_types (company_id, type_id) values (${companyId}, ${typeIds[type]})
    on conflict do nothing
  `;
  const personId = await contactFor(contact, companyId);
  const [opportunity] = await sql`
    select id from zrm_opportunities where company_id = ${companyId} and pipeline = 'fundraising' limit 1
  `;
  if (opportunity) continue;
  await sql`
    insert into zrm_opportunities (pipeline, title, deal_type, stage_id, company_id, person_id, owner_notes)
    values ('fundraising', ${firm.name}, ${dealType}, ${target.id}, ${companyId}, ${personId}, ${notes})
  `;
  counts.opportunities++;
}

console.log(
  `[fundraising:import] added ${counts.opportunities} opportunities, ${counts.companies} companies and ${counts.people} people, and filled in ${counts.filled} existing companies, on ${new URL(url).hostname}`,
);
