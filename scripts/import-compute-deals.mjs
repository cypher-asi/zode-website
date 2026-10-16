/**
 * Records ZODE's executed compute deals in DATABASE_URL: uploads each deal's
 * PDFs from ~/Downloads to the private Blob store (BLOB_READ_WRITE_TOKEN)
 * under contracts/compute/, records the deal under n3o, and closes its
 * Compute opportunity at the deal's total. Also sorts the earlier
 * opportunities into their deal types.
 *
 *   npm run contracts:import                                          (dev)
 *   node --env-file=.env.production.local scripts/import-compute-deals.mjs   (production)
 *
 * Re-runnable: a deal is matched on `seed_key` and skipped, PDFs and all, once
 * recorded. Opportunities are matched by title and company, and the one a
 * deal closes is added when ZRM doesn't have it yet.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";

const url = process.env.DATABASE_URL;
if (!url || !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("[contracts:import] DATABASE_URL and BLOB_READ_WRITE_TOKEN must be set.");
  process.exit(1);
}

const DOWNLOADS = join(homedir(), "Downloads");

/** n3o (n3o@zero.tech), who records the deals. */
const RECORDED_BY_ZOS_ID = "f977959f-08db-4e09-b730-b5d7a6577481";

const PROVIDER = "ZODE SUPER CLUSTER A LLC";

/** Each deal's terms as its order form states them. `opportunity` and `company` find (or add) the opportunity it closes. */
const DEALS = [
  {
    seed_key: "sfc-order-1",
    opportunity: "SF Compute",
    company: "SF Compute",
    counterparty: "San Francisco Compute Company",
    signed_at: "2026-07-31",
    effective_on: "2026-07-31",
    msa_on: "2026-07-31",
    gpu_model: "B300",
    gpu_count: 1024,
    node_count: null,
    it_mw: 2,
    location: "Core Data Center, Cologix or equivalent Tier 3 facility",
    site: null,
    gpu_hour_usd: 3.85,
    term_months: 36,
    renewal_months: 12,
    value_usd: 103_606_272,
    prepayment_usd: 25_901_568,
    prepayment_due_on: null,
    delivery_on: "2026-12-01",
    acceptance_deadline_on: "2027-01-31",
    structure: "Take-or-pay or revenue share",
    uptime_pct: 99.5,
    notes: [
      "Order Form No. 1 under the MSA of July 31, 2026. Approximately two separate 1 MW clusters, 1,024 B300 GPUs.",
      "Term: 3 years from the Acceptance Date, then 12-month renewals unless either party gives 90 days' notice.",
      "Prepayment: if SF Compute has no Initial Sale by the Cluster Delivery Date, $25,901,568 (25% of the $103,606,272 total at $3.85/GPU-hr), due at the later of the Cluster Delivery Date or all GPUs shipping to the data center. With an Initial Sale, 25% of the customer agreement's value at $3.85 plus half of any price above it.",
      "Take-or-pay at $3.85/GPU-hr on GPUs not under an Initial Sale; revenue share on those that are (Gross Revenue up to $3.85/GPU-hr, plus 50% above it, with a shortfall payment below it). Paid monthly within 45 days of month end from the Acceptance Date.",
      "Technical Configurations (Schedule 1) to be agreed within 60 days of July 31, 2026. SLA: 99.5% GPU compute and network availability.",
    ].join("\n\n"),
    documents: [
      ["MSA", "SFC - 3PC MSA (ZODE) [Final 7.30.2026].pdf"],
      ["Order Form No. 1", "SFC - 3PC MSA Order Form (ZODE) [Final 7.30.2026].pdf"],
    ],
  },
  {
    seed_key: "sourcem3d-order-1-ar",
    opportunity: "SourceM3D",
    company: "SourceM3D",
    counterparty: "SourceM3D, Inc.",
    signed_at: "2026-09-29",
    effective_on: "2026-09-28",
    msa_on: "2026-08-07",
    gpu_model: "B300",
    gpu_count: 2048,
    node_count: 256,
    it_mw: 4,
    location: "Chicago, Illinois 60607",
    site: { name: "Chicago", address: "801 S Canal" },
    gpu_hour_usd: 4.2,
    term_months: 60,
    renewal_months: 12,
    value_usd: 376_750_080,
    prepayment_usd: 103_606_272,
    prepayment_due_on: "2026-10-15",
    delivery_on: "2027-02-05",
    acceptance_deadline_on: "2027-04-06",
    structure: "Take-or-pay",
    uptime_pct: null,
    notes: [
      "Amended and Restated Order Form No. 1, effective September 28, 2026 (signed by SourceM3D on 9/28 and ZODE on 9/29), superseding the original Order Form No. 1 of August 7, 2026, under the MSA of August 7, 2026.",
      "Approximately 4 MW: 2,048 B300 GPUs on 256 nodes in Chicago, Illinois 60607. Technical Configurations agreed in Schedule 1.",
      "Term: 5 years from the Acceptance Date, then 12-month renewals unless either party gives 90 days' notice.",
      "Prepayment: $103,606,272 (27.5% of the $376,750,080 total at $4.20/GPU-hr over the initial term), due by wire by October 15, 2026, credited in equal months over the term.",
      "Unconditional, non-cancellable take-or-pay at $4.20/GPU-hr on accepted GPUs, paid monthly within 45 days of month end from the Acceptance Date.",
      "Cluster delivery for Acceptance Testing by February 5, 2027 (commercially reasonable efforts); SourceM3D may terminate if it hasn't passed by April 6, 2027, both extended day for day for its delays, force majeure or OEM delay.",
    ].join("\n\n"),
    documents: [
      ["MSA", "Complete_with_Docusign_ZODE_-_SourceM3D_-_MS.pdf"],
      ["A&R Order Form No. 1", "ZODE - SourceM3D - A&R Order Form No. 1 (BL 09.28).docx.pdf"],
    ],
  },
];

/** The deal types of the opportunities that aren't compute, set while they're still on the default. */
const DEAL_TYPES = [
  ["COLOGNIX", "Capacity"],
  ["eStruxture", "Capacity"],
  ["GIGABYTE - GPUs", "Hardware"],
];

const sql = neon(url);

const safeSegment = (name) => name.replace(/[^\w.-]+/g, "_").slice(-120) || "contract.pdf";

const [recorder] = await sql`select id from users where zos_user_id = ${RECORDED_BY_ZOS_ID}`;
if (!recorder) {
  console.error("[contracts:import] n3o has no users row in this database.");
  process.exit(1);
}

for (const [title, dealType] of DEAL_TYPES) {
  const rows = await sql`
    update zrm_opportunities set deal_type = ${dealType}, updated_at = now()
    where title = ${title} and deal_type = 'Compute'
    returning id
  `;
  if (rows.length) console.log(`[contracts:import] ${title} is now ${dealType}`);
}

for (const deal of DEALS) {
  const [existing] = await sql`select id from compute_contracts where seed_key = ${deal.seed_key}`;
  if (existing) {
    console.log(`[contracts:import] ${deal.counterparty} is already recorded; skipping`);
    continue;
  }

  const [company] = await sql`select id from zrm_companies where lower(name) = lower(${deal.company}) order by created_at limit 1`;
  if (!company) throw new Error(`ZRM has no company named ${deal.company}`);

  let [opportunity] = await sql`
    select id from zrm_opportunities
    where lower(title) = lower(${deal.opportunity}) and company_id = ${company.id}
    order by created_at limit 1
  `;
  if (!opportunity) {
    [opportunity] = await sql`
      insert into zrm_opportunities (title, company_id, deal_type, stage_id)
      values (${deal.opportunity}, ${company.id}, 'Compute', (select id from zrm_stages order by position desc limit 1))
      returning id
    `;
    console.log(`[contracts:import] added the ${deal.opportunity} opportunity`);
  }

  let siteId = null;
  if (deal.site) {
    const [site] = await sql`select id from capacity_sites where name = ${deal.site.name} and address = ${deal.site.address}`;
    if (!site) throw new Error(`Capacity has no site ${deal.site.name} at ${deal.site.address}`);
    siteId = site.id;
  }

  const documents = [];
  for (const [label, file] of deal.documents) {
    const body = await readFile(join(DOWNLOADS, file));
    const blob = await put(`contracts/compute/${safeSegment(file)}`, body, {
      access: "private",
      addRandomSuffix: true,
      contentType: "application/pdf",
    });
    documents.push({ label, pathname: blob.pathname });
    console.log(`[contracts:import] uploaded ${file} (${(body.length / 1024 ** 2).toFixed(1)} MB)`);
  }

  const id = crypto.randomUUID();
  await sql.transaction([
    sql`
      insert into compute_contracts (
        id, seed_key, signed_at, counterparty, provider_entity, company_id, opportunity_id, site_id,
        effective_on, msa_on, gpu_model, gpu_count, node_count, it_mw, location,
        gpu_hour_usd, term_months, renewal_months, value_usd, prepayment_usd, prepayment_due_on,
        delivery_on, acceptance_deadline_on, structure, uptime_pct, notes, recorded_by
      ) values (
        ${id}, ${deal.seed_key}, ${deal.signed_at}, ${deal.counterparty}, ${PROVIDER}, ${company.id}, ${opportunity.id}, ${siteId},
        ${deal.effective_on}, ${deal.msa_on}, ${deal.gpu_model}, ${deal.gpu_count}, ${deal.node_count}, ${deal.it_mw},
        ${deal.location}, ${deal.gpu_hour_usd}, ${deal.term_months}, ${deal.renewal_months}, ${deal.value_usd},
        ${deal.prepayment_usd}, ${deal.prepayment_due_on}, ${deal.delivery_on}, ${deal.acceptance_deadline_on},
        ${deal.structure}, ${deal.uptime_pct}, ${deal.notes}, ${recorder.id}
      )
    `,
    ...documents.map(
      (document, position) => sql`
        insert into compute_contract_documents (contract_id, position, label, blob_pathname)
        values (${id}, ${position}, ${document.label}, ${document.pathname})
      `,
    ),
    sql`
      update zrm_opportunities set
        deal_type = 'Compute',
        stage_id = (select id from zrm_stages order by position desc limit 1),
        value = ${deal.value_usd},
        updated_at = now()
      where id = ${opportunity.id}
    `,
  ]);
  console.log(`[contracts:import] recorded ${deal.counterparty} (${documents.length} documents)`);
}

console.log(`[contracts:import] done on ${new URL(url).hostname}`);
