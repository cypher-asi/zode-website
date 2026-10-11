import "server-only";
import {
  DEPLOYMENTS,
  LOCATIONS,
  NETWORKS,
  NODE_SIZES,
  PLATFORMS,
  REDUNDANCY,
  WORKLOADS,
  activeRedundancy,
  quote,
  type Choice,
  type Config,
  type Quote,
} from "./buyConfig";
import {
  CPU_MACHINES,
  CPU_MACHINE_COUNTS,
  FABRICS,
  FRONT_ENDS,
  HOST_CPUS,
  MGMT_COUNTS,
  RENT_LOCATIONS,
  RENT_NODE_SIZES,
  RENT_PLATFORMS,
  STORAGE_SIZES,
  STORAGE_TIERS,
  UPLINKS,
  rentQuote,
  type RentConfig,
  type RentQuote,
} from "./rentConfig";
import { db } from "@/lib/db";
import { HONEYPOT_FIELD } from "@/lib/leads";

export interface OrderContact {
  name: string;
  email: string;
  company: string;
  notes: string;
}

export type Order =
  | { mode: "buy"; config: Config; contact: OrderContact }
  | { mode: "rent"; config: RentConfig; contact: OrderContact };

export type ParsedOrder =
  | { ok: true; spam: false; order: Order }
  | { ok: true; spam: true }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CONTACT_FIELDS = [
  { key: "name", label: "Name", required: true, max: 120 },
  { key: "email", label: "Work email", required: true, max: 200 },
  { key: "company", label: "Company", required: false, max: 160 },
  { key: "notes", label: "Notes", required: false, max: 2000 },
] as const satisfies readonly { key: keyof OrderContact; label: string; required: boolean; max: number }[];

/** The id of an offered, enabled choice equal to `value`. */
const choiceId = <Id extends string>(list: readonly Choice<Id, unknown>[], value: unknown): Id | undefined =>
  list.find((c) => c.id === value && !c.disabled)?.id;

const oneOf = <N extends number>(list: readonly N[], value: unknown): N | undefined => list.find((n) => n === value);

function parseBuyConfig(raw: Record<string, unknown>): Config | undefined {
  const config = {
    location: choiceId(LOCATIONS, raw.location),
    platform: choiceId(PLATFORMS, raw.platform),
    nodes: oneOf(NODE_SIZES, raw.nodes),
    workload: choiceId(WORKLOADS, raw.workload),
    deployment: choiceId(DEPLOYMENTS, raw.deployment),
    network: choiceId(NETWORKS, raw.network),
  };
  if (Object.values(config).some((v) => v === undefined) || !Array.isArray(raw.redundancy)) return undefined;
  const picked: unknown[] = raw.redundancy;
  const parsed: Config = { ...(config as Omit<Config, "redundancy">), redundancy: REDUNDANCY.filter((r) => picked.includes(r.id)).map((r) => r.id) };
  // Drops items whose prerequisite is off, as the checklist does.
  return { ...parsed, redundancy: activeRedundancy(parsed).map((r) => r.id) };
}

function parseRentConfig(raw: Record<string, unknown>): RentConfig | undefined {
  const config = {
    location: choiceId(RENT_LOCATIONS, raw.location),
    platform: choiceId(RENT_PLATFORMS, raw.platform),
    nodes: oneOf(RENT_NODE_SIZES, raw.nodes),
    fabric: choiceId(FABRICS, raw.fabric),
    frontEnd: choiceId(FRONT_ENDS, raw.frontEnd),
    uplink: choiceId(UPLINKS, raw.uplink),
    storageTier: choiceId(STORAGE_TIERS, raw.storageTier),
    storageTb: oneOf(STORAGE_SIZES, raw.storageTb),
    hostCpu: choiceId(HOST_CPUS, raw.hostCpu),
    cpuMachine: choiceId(CPU_MACHINES, raw.cpuMachine),
    cpuMachines: oneOf(CPU_MACHINE_COUNTS, raw.cpuMachines),
    mgmtServers: oneOf(MGMT_COUNTS, raw.mgmtServers),
  };
  return Object.values(config).some((v) => v === undefined) ? undefined : (config as RentConfig);
}

/**
 * Validates an order form submission. The configuration arrives as JSON and
 * must name only offered options; anything else is rejected rather than
 * coerced, since the stored order is what sales will quote against.
 */
export function parseOrder(formData: FormData): ParsedOrder {
  const honey = formData.get(HONEYPOT_FIELD);
  if (typeof honey === "string" && honey.trim() !== "") {
    return { ok: true, spam: true };
  }

  const contact: OrderContact = { name: "", email: "", company: "", notes: "" };
  for (const field of CONTACT_FIELDS) {
    const raw = formData.get(field.key);
    const value = typeof raw === "string" ? raw.trim() : "";
    if (field.required && !value) return { ok: false, error: `${field.label} is required.` };
    if (value.length > field.max) return { ok: false, error: `${field.label} is too long.` };
    contact[field.key] = value;
  }
  if (!EMAIL_RE.test(contact.email)) {
    return { ok: false, error: "Work email is not a valid email." };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("config") ?? ""));
  } catch {
    raw = null;
  }
  const invalid = { ok: false, error: "That configuration is no longer available. Please review your choices." } as const;
  if (typeof raw !== "object" || raw === null) return invalid;

  const mode = formData.get("mode");
  if (mode === "buy") {
    const config = parseBuyConfig(raw as Record<string, unknown>);
    return config ? { ok: true, spam: false, order: { mode, config, contact } } : invalid;
  }
  if (mode === "rent") {
    const config = parseRentConfig(raw as Record<string, unknown>);
    return config ? { ok: true, spam: false, order: { mode, config, contact } } : invalid;
  }
  return invalid;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Stores the order with a quote priced here from its configuration, never
 * one sent by the browser, and returns its short reference.
 */
export async function createOrder(order: Order): Promise<string> {
  let priced: Quote | RentQuote;
  let total: number | null = null;
  if (order.mode === "buy") {
    const q = quote(order.config);
    priced = q;
    total = cents(q.total);
  } else {
    priced = rentQuote(order.config);
  }

  const { name, email, company, notes } = order.contact;
  const [row] = await db()`
    insert into compute_orders (mode, name, email, company, notes, config, quote, monthly_usd, total_usd)
    values (
      ${order.mode}, ${name}, ${email}, ${company || null}, ${notes || null},
      ${JSON.stringify(order.config)}, ${JSON.stringify(priced)}, ${cents(priced.monthly)}, ${total}
    )
    returning id
  `;
  return referenceFor(String(row.id));
}

/** The first block of the order's uuid, as shown to the customer. */
export const referenceFor = (id: string): string => id.slice(0, 8).toUpperCase();

export interface OrderSummary {
  reference: string;
  createdAt: Date;
  mode: "buy" | "rent";
  status: string;
  monthlyUsd: number;
  totalUsd: number | null;
  platform: string;
  location: string;
  gpus: number;
}

const choiceLabel = (choices: readonly Choice<string, unknown>[], id: unknown): string =>
  choices.find((c) => c.id === id)?.label.replace(/^NVIDIA /, "") ?? String(id ?? "");

/** Orders placed with this email at checkout, newest first. */
export async function listOrdersByEmail(email: string): Promise<OrderSummary[]> {
  const rows = await db()`
    select id, created_at, mode, status, monthly_usd, total_usd, config, quote
    from compute_orders
    where lower(email) = ${email.trim().toLowerCase()}
    order by created_at desc
  `;
  return rows.map((row) => {
    const config = row.config as Record<string, unknown>;
    const priced = row.quote as { gpus?: number };
    return {
      reference: referenceFor(String(row.id)),
      createdAt: new Date(row.created_at as string | Date),
      mode: row.mode === "rent" ? "rent" : "buy",
      status: String(row.status),
      monthlyUsd: Number(row.monthly_usd),
      totalUsd: row.total_usd == null ? null : Number(row.total_usd),
      platform: choiceLabel(PLATFORMS, config.platform),
      location: choiceLabel(LOCATIONS, config.location),
      gpus: Number(priced.gpus ?? 0),
    };
  });
}
