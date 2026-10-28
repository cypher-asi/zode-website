/**
 * Loads the team's capacity sheet into Capacity's sites in DATABASE_URL,
 * linking each to ZRM: providers, customers and broker firms to ZRM
 * companies, brokers to ZRM people at their firm. Names ZRM doesn't have yet
 * are added to it (`source` "Capacity sheet"), so every one is a link.
 *
 *   npm run capacity:import
 *
 * Additive: sites are matched on `seed_key` (the sheet section they sit in
 * and their name), missing ones are inserted and existing ones left alone, so
 * edits made in Capacity survive a re-run. A site's section also picks the
 * status it starts on. Companies match on name, case-insensitively; brokers on
 * first name and firm. The sheet's Total rows aren't imported, since
 * Capacity sums the sites itself, and its "Link" cells carried no addresses.
 *
 * A site with a data room (`room`, the room's name) is linked to it when the
 * database has that room and the site has none yet, existing sites included.
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[capacity:import] DATABASE_URL is not set; add it to .env.local.");
  process.exit(1);
}

const SOURCE = "Capacity sheet";

/*
 * [name, address, provider, term, type, initial MW, secondary MW, kW rate,
 * power rate, upfront, conversion, RFS, extras]. RFS is `YYYY-MM-DD`; the
 * sheet's "2027" for Missouri is the first of that year. Only leases and JVs
 * have a term and kW rate, and only purchases and JVs a conversion, as
 * `capacity_sites_deal_terms_check` requires.
 */
const SECTIONS = {
  "Critical Path": [
    ["Chicago", "801 S Canal", "Alonsar", 15, "Lease", 3.8, 20.2, 170, 0.1, 9_000_000, null, "2027-02-05",
      { customer: "SourceM3D", broker: "Chad", contract: 377_782_272, annual: 75_556_454, room: "801 S Canal, Chicago" }],
    ["Missasaga", "5640 Kennedy Road", "CORE Data Centers Inc.", 5, "Lease", 1.2, 0, 133, 0.08, 1_250_000, null, "2026-01-15",
      { customer: "SF Compute", contract: 33_730_560, annual: 11_243_520 }],
    ["Milton", "8250 Lawson Road", "137 Edge Compute Inc.", 5, "JV", 1.39, 5.22, 185, 0.13, 10_000_000, 26_440_000, "2026-03-31",
      { customer: "SF Compute", broker: "Carlos", firm: "XIRR" }],
    ["Olds", "6102 48th Avenue Road", "SNDL INC.", null, "Purchase", 22, 0, null, 0.12, 18_000_000, 88_000_000, "2026-03-31",
      { broker: "Casey", firm: "JLL", room: "6102-6402 48 Avenue" }],
    ["Calgary", "5430 30 Street SE", "Balil", null, "Purchase", 8, 5, null, 0.12, 10_000_000, 32_000_000, "2026-03-31",
      { broker: "Mitch", firm: "Baxtell", room: "5430 30 Street SE" }],
  ],
  LOI: [
    ["Alaska", "Alaska", null, null, "Purchase", 5, 15, null, null, null, null, "2027-03-31"],
    ["West Texas position I", "Permian Basin, Texas", "Syaala", 10, "Lease", 5.6, 0, null, null, null, null, "2027-03-31"],
    ["West Texas position II", "Texas", "Syaala", 10, "Lease", 6, 0, null, null, null, null, "2027-03-31"],
    ["Philadelphia position", "Pennsylvania", "Syaala", 10, "Lease", 3.25, 0, null, null, null, null, "2027-03-31"],
    ["Alabama position A", "Alabama", "Syaala", 10, "Lease", 50, 0, null, null, null, null, "2027-03-31",
      { room: "369 Union Road, Somerville, AL" }],
    ["Alabama position B", "Alabama", "Syaala", 10, "Lease", 50, 0, null, null, null, null, "2027-03-31",
      { room: "Arab, AL (AL04)" }],
    ["Alabama position C", "Alabama", "Syaala", 10, "Lease", 50, 0, null, null, null, null, "2027-03-31"],
    ["North Texas position 1", "Wichita Falls, Texas", "Syaala", 10, "Lease", 20, 0, null, null, null, null, "2027-03-31"],
    ["Missouri", "Missouri", "Big Watt", 10, "Lease", 350, 450, null, null, null, null, "2027-01-01"],
  ],
  Atlas: [
    ["Montana Current", "Montana", "Atlas", null, "Purchase", 68, 100],
    ["North Dakota Current", "Williams County, North Dakota", "Atlas", null, "Purchase", 227, 210],
    ["Kentucky Current", "McCracken County, Kentucky", "Atlas", null, "Purchase", 22, 33],
    ["Texas", "Grimes County, Texas", "Atlas", null, "Purchase", 68, 200],
  ],
  Metroplex: [
    ["102 CCI-Beach II", "5401 N. Beach Street Fort Worth", "102 CCI-Beach II, LP", null, "Purchase", 4.3, 7.3, ...blank(5), {
      notes:
        "431,579 SF | 277/480V AC (2x4000, 2x3000) | Three diesel-powered 2,000 KVA emergency electrical generators in enclosures in north service yard. Provides back-up power for building services + 1 backup. Skid-mounted ASTs ~7,500 gal each.",
    }],
    ["108 CCI-Richardson II", "2200 E. George Bush Turnpike Richardson", "108 CCI-Richardson II, LP", null, "Purchase", 1.8, 1.6, ...blank(5), {
      notes:
        "176,831 SF | 480/277V AC (4,000A) | Diesel-powered 750 KVA emergency generator in concrete-fenced yard near central plant. Backup power to lab areas, cooling, fire/safety, lighting, elevators. Skid-mounted AST.",
    }],
    ["112 CCI-D 5000 HQ Owner", "5000 Headquarters Drive Plano", "112 CCI-D 5000 HQ Owner, LLC", null, "Purchase", 1.7, 3.3, ...blank(5), {
      notes:
        "167,420 SF | 277/480V AC (2x3,000A) | Two diesel generators (750 & 2,000 KVA) in south service yard. Chassis day tanks supplied by ~2,500-gal AST. Pad-mounted transformers, copper wiring in metallic conduit.",
    }],
    ["114 CCI-Plano I", "6400 Legacy Drive Plano", "114 CCI-Plano I, LP", null, "Purchase", 2.3, 1, ...blank(5), {
      notes:
        "227,577 SF | 277/480V AC (4000A) | Two Cummins diesel generators (450 KVA life-safety, 1,000 KVA UPS computer room). Westinghouse 4,000A switchgear in basement, dual busduct risers.",
    }],
    ["117 CCI-Amon Carter Blvd I", "4255-4333 Amon Carter Blvd. Fort Worth", "CCI", null, "Purchase", 13, -9.7, ...blank(5), {
      notes:
        "1,303,302 SF | 277/480V AC (4,000A) | CUP has five 1,400 KVA diesel generators (2nd fl garage); AACU has one 400 KVA generator in south yard. Significantly lower than conservative estimate - check PCA.",
    }],
    ["125 CCI-Irving VII-A", "6000 Connection Irving", "127 CCI-Freeway Office Properties I, LP", null, "Purchase", 2.9, 5.1, ...blank(5), {
      notes:
        "287,581 SF | 480/277V service; 208/120V panels (4000, 4000, 1600) | Two diesel-powered emergency generators located on the property.",
    }],
    ["171 CCI-Richardson I", "2701 & 2703 North Central Expy Richardson", "300 CCI-Clay Road I, LP", null, "Purchase", 1.7, 2.9, ...blank(5), {
      notes:
        "173,847 SF | 277/480V (1600, 4000) | 2703: Diesel ~150 kVA emergency generator near cooling tower. 2701: Two diesel ~300 kVA emergency generators in mechanical yard.",
    }],
    ["115 CCI-6501 Legacy", "6501 Legacy Drive Plano", "115 CCI-D 6501 Legacy Owner", null, "Purchase", 18.3, 21.6, ...blank(5), {
      notes:
        "1,829,795 SF | 277/480V AC (12x4000A) | Two Magna Max 2,000 KVA generators (Bldg F & C) with 660-gal fuel tanks. Vault transformers (6,000 kVA & 4,000 kVA). 12x4,000A feeds from substation.",
    }],
    ["116 CCI-Richland Hills I", "9151 Blvd 26 North Richland Hills", "116 CCI - Richland Hills I, LP", null, "Purchase", 2.4, 1, ...blank(5), {
      notes:
        "235,075 SF | 277/480V AC (4000A) | One emergency generator serving each of the 2 buildings, backup power for base building systems and IT systems integrated with UPS.",
    }],
  ],
  Misc: [
    ["Calgary", "Calgary", "Baxtell", null, null, 30, null],
    ["Kansas City", "Kansas City", "Baxtell", null, null, 5, null, ...blank(5), {
      notes: "CW Kansas City: 6MW raw power at shell in KC available for NNN lease today (no MEP or CI there today). Potential for expansion.",
    }],
    ["Tennesse", "Tennesse", "Baxtell", null, null, 10, null, ...blank(5), {
      notes:
        "CW Tennessee: behind-the-meter adaptive-reuse site with potential to have 10MW of grid power RFS Q1-2 2027 and scale to 100MW+",
    }],
    ["Polaris Power Campus Project", "Wyomming", "Baxtell", null, null, null, null],
    ["Pollux Power Campus Project", "Wyomming", "Baxtell", null, null, null, null],
    // The sheet names the state as this site's provider, so it's left unlinked rather than added to ZRM as a company.
    ["Texas", "Texas", null, null, null, 72, 72, ...blank(5), {
      notes: "Interest/feedback on 72MW Site in TX - potential for Syaala deployment",
    }],
  ],
};

function blank(n) {
  return Array(n).fill(null);
}

/** Where a site starts out; the team moves it from there. */
function statusFor(section, extras) {
  if (section === "Critical Path") return extras.customer ? "Contracted" : "Negotiation";
  if (section === "LOI") return "LOI";
  return "Prospect";
}

const sql = neon(url);

const statusIds = new Map(
  (await sql`select id, lower(name) as name from capacity_statuses`).map((row) => [row.name, row.id]),
);

const counts = { companies: 0, people: 0, sites: 0, rooms: 0 };

const companyIds = new Map();
async function companyId(name) {
  if (!name) return null;
  const key = name.toLowerCase();
  if (!companyIds.has(key)) {
    let [row] = await sql`select id from zrm_companies where lower(name) = ${key} order by created_at limit 1`;
    if (!row) {
      [row] = await sql`insert into zrm_companies (name, source) values (${name}, ${SOURCE}) returning id`;
      counts.companies++;
    }
    companyIds.set(key, row.id);
  }
  return companyIds.get(key);
}

async function personId(firstName, firmId) {
  if (!firstName) return null;
  let [row] = await sql`
    select id from zrm_people
    where lower(first_name) = ${firstName.toLowerCase()} and company_id is not distinct from ${firmId}::uuid
    order by created_at limit 1
  `;
  if (!row) {
    [row] = await sql`
      insert into zrm_people (first_name, company_id, source) values (${firstName}, ${firmId}, ${SOURCE}) returning id
    `;
    counts.people++;
  }
  return row.id;
}

for (const [section, sites] of Object.entries(SECTIONS)) {
  for (const [name, address, provider, term, type, initial, secondary, kwRate, powerRate, upfront, conversion, rfs, extras = {}] of sites) {
    const statusId = statusIds.get(statusFor(section, extras).toLowerCase());
    if (!statusId) throw new Error(`[capacity:import] no status for ${name}; run npm run db:migrate first.`);
    const firmId = await companyId(extras.firm);
    const site = {
      seed_key: `${section}:${name}`.toLowerCase(),
      name,
      address,
      status_id: statusId,
      provider_company_id: await companyId(provider),
      term_years: term ?? null,
      deal_type: type ?? null,
      initial_it_mw: initial ?? null,
      secondary_it_mw: secondary ?? null,
      kw_rate: kwRate ?? null,
      power_rate: powerRate ?? null,
      upfront: upfront ?? null,
      conversion: conversion ?? null,
      rfs_date: rfs ?? null,
      cooling: "DTC",
      customer_company_id: await companyId(extras.customer),
      broker_person_id: await personId(extras.broker, firmId),
      firm_company_id: firmId,
      contract_value: extras.contract ?? null,
      annual_revenue: extras.annual ?? null,
      notes: extras.notes ?? null,
    };
    const columns = Object.keys(site);
    const inserted = await sql.query(
      `insert into capacity_sites (${columns.join(", ")})
       values (${columns.map((_, i) => `$${i + 1}`).join(", ")})
       on conflict (seed_key) do nothing returning id`,
      Object.values(site),
    );
    counts.sites += inserted.length;
    if (extras.room) {
      const linked = await sql`
        update capacity_sites s set data_room_id = r.id, updated_at = now()
        from (select id from data_rooms where lower(name) = ${extras.room.toLowerCase()} order by created_at limit 1) r
        where s.seed_key = ${site.seed_key} and s.data_room_id is null
        returning s.id
      `;
      counts.rooms += linked.length;
    }
  }
}

console.log(
  `[capacity:import] added ${counts.sites} sites, ${counts.companies} companies and ${counts.people} people, and linked ${counts.rooms} data rooms, to ${new URL(url).hostname}`,
);
