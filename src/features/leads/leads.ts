import "server-only";
import { LOCATIONS, PLATFORMS } from "@/features/configurator/buyConfig";
import { choiceLabel, referenceFor } from "@/features/configurator/orders";
import { RENT_PLATFORMS } from "@/features/configurator/rentConfig";
import { INTERESTS, sizeLabel } from "@/features/engineer-request/options";
import { checkSizeLabel, investorTypeLabel, opportunityLabel } from "@/features/investor-request/options";
import { db } from "@/lib/db";
import { leadStatus, type Lead, type LeadSource, type LeadStatus, type LeadType } from "./types";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

async function orderLeads(): Promise<Lead[]> {
  const rows = await db()`
    select id, created_at, mode, status, name, email, company, monthly_usd, total_usd,
      config->>'platform' as platform, config->>'location' as location, quote->>'gpus' as gpus
    from compute_orders
    order by created_at desc
  `;
  return rows.map((row) => {
    const mode: LeadType = row.mode === "rent" ? "rent" : "buy";
    const gpus = Number(row.gpus ?? 0);
    const price =
      mode === "buy" && row.total_usd != null
        ? `${usd.format(Number(row.total_usd))} total`
        : `${usd.format(Number(row.monthly_usd))} /mo${mode === "rent" ? " est." : ""}`;
    return {
      source: "order",
      id: String(row.id),
      reference: referenceFor(String(row.id)),
      types: [mode],
      status: leadStatus(row.status),
      createdAt: new Date(row.created_at as string | Date),
      name: String(row.name),
      email: String(row.email),
      organization: text(row.company),
      title: null,
      phone: null,
      summary: [
        `${gpus.toLocaleString("en-US")} GPUs`,
        choiceLabel(mode === "rent" ? RENT_PLATFORMS : PLATFORMS, row.platform),
        choiceLabel(LOCATIONS, row.location),
        price,
      ].join(" · "),
    };
  });
}

async function engineerLeads(): Promise<Lead[]> {
  const rows = await db()`
    select id, created_at, status, interests, deployment_size, name, title, website, phone, email
    from engineer_requests
    order by created_at desc
  `;
  return rows.map((row) => {
    const picked: unknown[] = Array.isArray(row.interests) ? row.interests : [];
    return {
      source: "engineer",
      id: String(row.id),
      reference: referenceFor(String(row.id)),
      types: INTERESTS.filter((interest) => picked.includes(interest.id)).map((interest) => interest.id),
      status: leadStatus(row.status),
      createdAt: new Date(row.created_at as string | Date),
      name: String(row.name),
      email: String(row.email),
      organization: text(row.website),
      title: text(row.title),
      phone: text(row.phone),
      summary: `${sizeLabel(String(row.deployment_size))} nodes`,
    };
  });
}

async function investorLeads(): Promise<Lead[]> {
  const rows = await db()`
    select id, created_at, status, investor_type, opportunities, check_size, name, email, firm, title, phone
    from investor_requests
    order by created_at desc
  `;
  return rows.map((row) => {
    const opportunities: unknown[] = Array.isArray(row.opportunities) ? row.opportunities : [];
    return {
      source: "investor",
      id: String(row.id),
      reference: referenceFor(String(row.id)),
      types: ["invest"],
      status: leadStatus(row.status),
      createdAt: new Date(row.created_at as string | Date),
      name: String(row.name),
      email: String(row.email),
      organization: text(row.firm),
      title: text(row.title),
      phone: text(row.phone),
      summary: [
        investorTypeLabel(String(row.investor_type)),
        checkSizeLabel(String(row.check_size)),
        opportunities.map((id) => opportunityLabel(String(id))).join(" + "),
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });
}

/** Every configurator order, Talk to an Engineer request and Invest inquiry, newest first. For the ZODE team. */
export async function listLeads(): Promise<Lead[]> {
  const sources = await Promise.all([orderLeads(), engineerLeads(), investorLeads()]);
  return sources.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Sets a lead's status on its source table; false when the row no longer exists. */
export async function setLeadStatus(source: LeadSource, id: string, status: LeadStatus): Promise<boolean> {
  const sql = db();
  const rows =
    source === "order"
      ? await sql`update compute_orders set status = ${status} where id = ${id} returning id`
      : source === "engineer"
        ? await sql`update engineer_requests set status = ${status} where id = ${id} returning id`
        : await sql`update investor_requests set status = ${status} where id = ${id} returning id`;
  return rows.length > 0;
}
