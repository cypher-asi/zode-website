import { GPUS_PER_NODE } from "@/features/cluster/model/catalog";
import {
  dayOf,
  formatAcross,
  formatCount,
  formatDay,
  formatMonthYear,
  formatMw,
  formatPct,
  formatPrice,
  formatTb,
  formatTerm,
  formatUsd,
  formatUsdShort,
} from "@/features/deployments/format";
import {
  coolingLabel,
  facilityLabel,
  gpusFor,
  networkingLabel,
  platformBreakdown,
  platformLabel,
  platformSummary,
  pricingOf,
  totalsOf,
  type Deployment,
} from "@/features/deployments/types";
import { teaserOf } from "@/features/teasers/content";
import { siteOf } from "./sites";
import { LIMITS, type LabeledValue, type PresentationContent, type PricingRow, type SpecCell, type Stat } from "./types";

const COOLING_PROSE: Record<Deployment["cooling"], string> = {
  liquid_dtc: "direct-to-chip liquid cooling",
  air: "air cooling",
};

const cut = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 3).trimEnd()}...`);

const facts = (rows: readonly LabeledValue[], max: number): LabeledValue[] =>
  rows.slice(0, max).map((row) => ({ label: cut(row.label, LIMITS.factLabel), value: cut(row.value, LIMITS.factValue) }));

const NEXT_STEPS = [
  "Sign a mutual NDA to open the data room",
  "Review the site, power and engineering documents",
  "Visit the site and meet the engineering team",
  "Agree indicative terms and reserve capacity",
];

/**
 * `deployment`'s presentation, every figure written out from it as of now,
 * with its external notes as a slide of their own, its site's profile when
 * one's written for its address, and the teaser's contact.
 * Nothing internal (internal notes, credit, the data room) goes in: it opens
 * for anyone who can open the deployment.
 */
export function presentationOf(deployment: Deployment): PresentationContent {
  const d = deployment;
  const teaser = teaserOf(d);
  const totals = totalsOf(d);
  const shares = totals.byPlatform.filter((share) => share.gpus > 0);
  const place = d.city ?? d.address?.split("\n")[0] ?? null;
  const address = d.address?.split("\n").join(", ") ?? null;
  const facility = facilityLabel(d.facility);
  const first = d.phases[0];

  const siteSummary = [
    `${d.name}${address ? ` is at ${address}` : place ? ` is in ${place}` : ""}`,
    facility ? `, a ${facility.toLowerCase()} site` : "",
    ". ",
    totals.mw ? `It brings ${formatMw(totals.mw)} of critical IT power online` : "It comes online",
    d.phases.length > 1 && first ? ` in ${d.phases.length} phases from ${formatDay(first.rfsOn)}` : first ? ` on ${formatDay(first.rfsOn)}` : "",
    `, cooled by ${COOLING_PROSE[d.cooling]}.`,
  ].join("");

  const clusterSummary = [
    `Each phase is built as ${platformSummary(shares)} clusters of ${GPUS_PER_NODE}-GPU nodes,`,
    ` networked over ${networkingLabel(d.networking)}, with ${COOLING_PROSE[d.cooling]}`,
    d.storageTbPerNode ? ` and ${formatTb(d.storageTbPerNode)} of storage per node` : "",
    ". ZODE builds, operates and supports the clusters end to end.",
  ].join("");

  // The cover's caption carries the site's place, so its overview leaves it out.
  const overview = [
    shares.length > 1
      ? `${formatCount(totals.gpus)} NVIDIA GPUs: ${platformBreakdown(shares)}`
      : `${formatCount(totals.gpus)} NVIDIA ${platformSummary(shares)} GPUs`,
    facility ? `${facility} site` : null,
  ]
    .filter(Boolean)
    .join(". ");
  // The platform with the most GPUs, ready in full by the last phase's year.
  const lead = shares.reduce<(typeof shares)[number] | null>((best, share) => (!best || share.gpus > best.gpus ? share : best), null);
  const last = d.phases.at(-1);
  const headline = [
    totals.mw ? `${formatMw(totals.mw >= 1 ? Math.round(totals.mw) : totals.mw)} IT of` : null,
    last?.rfsOn.slice(0, 4),
    lead ? platformLabel(lead.platform) : null,
    "Capacity",
    place ? `in ${place}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const value = (stat: Stat): Stat => ({ value: cut(stat.value, LIMITS.coverValue), label: cut(stat.label, LIMITS.coverLabel) });
  const cover: SpecCell[] = [
    { title: "Overview", text: cut(`${overview}.`, LIMITS.coverText), values: [] },
    {
      title: "Power",
      text: "",
      values: [
        ...(totals.mw ? [{ value: formatMw(totals.mw), label: "Critical IT" }] : []),
        { value: formatCount(d.phases.length), label: d.phases.length === 1 ? "Phase" : "Phases" },
      ].map(value),
    },
    {
      title: "Compute",
      text: "",
      values: [
        { value: formatCount(totals.gpus), label: shares.length > 1 ? "GPUs" : `${platformSummary(shares)} GPUs` },
        { value: formatCount(totals.byPlatform.reduce((sum, share) => sum + share.nodes, 0)), label: "Nodes" },
      ].map(value),
    },
    {
      title: "Ready",
      text: "",
      values: [
        ...(first ? [{ value: formatMonthYear(dayOf(first.rfsOn)), label: "Ready for service" }] : []),
        { value: coolingLabel(d.cooling), label: "Cooling" },
      ].map(value),
    },
  ];

  const phases = d.phases.slice(0, LIMITS.rollout).map((phase, i) => ({
    label: phase.name || `Phase ${i + 1}`,
    platform: phase.platform,
    pricing: pricingOf(d, phase),
  }));
  const priced = phases.filter((phase) => phase.pricing.priceGpuHr !== null);
  const pricing: PricingRow[] = phases.map(({ label, platform, pricing: p }) => ({
    label: cut(label, LIMITS.rolloutLabel),
    platform: platformLabel(platform),
    gpus: formatCount(p.gpus),
    price: p.priceGpuHr !== null ? formatPrice(p.priceGpuHr) : "To follow",
    term: p.priceGpuHr !== null && p.termMonths !== null ? formatTerm(p.termMonths) : "",
    contract: p.contractUsd !== null ? formatUsd(p.contractUsd) : "",
    deposit: p.depositUsd !== null && p.depositPct !== null ? `${formatUsd(p.depositUsd)} · ${formatPct(p.depositPct)}` : "",
  }));

  // Named when only some phases are priced, so the figures say which.
  const scope = priced.length && priced.length < phases.length ? ` · ${priced.map((phase) => phase.label).join(", ")}` : "";
  const sum = (values: readonly (number | null)[]) =>
    values.some((value) => value !== null) ? values.reduce<number>((total, value) => total + (value ?? 0), 0) : null;
  const contract = sum(priced.map((phase) => phase.pricing.contractUsd));
  const deposit = sum(priced.map((phase) => phase.pricing.depositUsd));
  const depositPct = formatAcross(priced.map((phase) => phase.pricing.depositPct), formatPct);
  const terms = priced.length
    ? [
        { label: `Per GPU-hour${scope}`, value: formatAcross(priced.map((phase) => phase.pricing.priceGpuHr), formatPrice)! },
        { label: "Term", value: formatAcross(priced.map((phase) => phase.pricing.termMonths), formatTerm) ?? "Flexible" },
        ...(contract !== null ? [{ label: `Contract value${scope}`, value: formatUsdShort(contract) }] : []),
        ...(deposit !== null ? [{ label: depositPct ? `Deposit · ${depositPct}` : "Deposit", value: formatUsdShort(deposit) }] : []),
      ]
    : teaser.terms;

  return {
    eyebrow: "Site overview",
    headline: cut(headline, LIMITS.headline),
    title: cut(d.name, LIMITS.title),
    address: cut(address ?? place ?? "", LIMITS.address),
    subtitle: cut([teaser.headline, teaser.subheadline].filter(Boolean).join(". "), LIMITS.subtitle),
    cover: cover.slice(0, LIMITS.cover),
    cooling: d.cooling,
    stats: teaser.stats,
    summary: cut(teaser.summary, LIMITS.summary),
    highlights: teaser.highlights,
    siteSummary: cut(siteSummary, LIMITS.siteSummary),
    siteFacts: facts(
      [
        ...(address ? [{ label: "Address", value: address }] : []),
        ...(facility ? [{ label: "Facility", value: facility }] : []),
        ...(totals.mw ? [{ label: "Critical IT power", value: formatMw(totals.mw) }] : []),
        { label: "Cooling", value: coolingLabel(d.cooling) },
        { label: "Phases", value: formatCount(d.phases.length) },
        ...(first ? [{ label: "Ready for service", value: `From ${formatDay(first.rfsOn)}` }] : []),
      ],
      LIMITS.siteFacts,
    ),
    rollout: d.phases.slice(0, LIMITS.rollout).map((phase, i) => ({
      label: cut(phase.name || `Phase ${i + 1}`, LIMITS.rolloutLabel),
      capacity: cut(
        `${formatCount(gpusFor(phase.platform, phase.nodes))} ${platformLabel(phase.platform)} GPUs · ${formatCount(phase.nodes)} nodes`,
        LIMITS.rolloutCapacity,
      ),
      power: phase.mw !== null ? formatMw(phase.mw) : "",
      date: formatDay(phase.rfsOn),
    })),
    clusterSummary: cut(clusterSummary, LIMITS.clusterSummary),
    specs: facts(teaser.specs, LIMITS.specs),
    sections: d.externalNotes
      ? [{ title: "Notes", body: cut(d.externalNotes, LIMITS.sectionBody), bullets: "", facts: [] }]
      : [],
    terms: terms.map((term) => ({ label: cut(term.label, LIMITS.termLabel), value: cut(term.value, LIMITS.termValue) })),
    pricing: priced.length ? pricing : [],
    site: siteOf(d),
    nextSteps: NEXT_STEPS.slice(0, LIMITS.nextSteps).join("\n"),
    contactName: teaser.contactName,
    contactEmail: teaser.contactEmail,
  };
}
