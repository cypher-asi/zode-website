import { SYSTEMS } from "@/features/deployments/config/catalog";
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
  platformLabel,
  platformSummary,
  pricingOf,
  totalsOf,
  type Deployment,
} from "@/features/deployments/types";
import { teaserOf } from "@/features/teasers/content";
import { siteOf } from "./sites";
import {
  LIMITS,
  cityOf,
  presentationName,
  type LabeledValue,
  type PresentationContent,
  type PricingRow,
  type SpecCell,
  type Stat,
} from "./types";

const COOLING_PROSE: Record<Deployment["cooling"], string> = {
  liquid_dtc: "direct-to-chip liquid cooling",
  air: "air cooling",
};

/** How the cover's overview names each kind of facility. */
const COVER_FACILITY: Record<NonNullable<Deployment["facility"]>, string> = {
  colo: "Colo facility",
  conversion: "Existing data center conversion",
  greenfield: "Greenfield site",
};

const listOf = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/** Phases by name, e.g. "Phase 1", or "Phases 2 and 3" when they're all numbered. */
const phasesNamed = (names: readonly string[]): string => {
  const numbers = names.map((name) => /^Phase (\d+)$/i.exec(name.trim())?.[1]);
  return names.length > 1 && numbers.every(Boolean) ? `Phases ${listOf(numbers as string[])}` : listOf(names);
};

const cut = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 3).trimEnd()}...`);

const facts = (rows: readonly LabeledValue[], max: number): LabeledValue[] =>
  rows.slice(0, max).map((row) => ({ label: cut(row.label, LIMITS.factLabel), value: cut(row.value, LIMITS.factValue) }));

const NEXT_STEPS = [
  "Sign a mutual NDA to open the data room",
  "Review the site, power and engineering documents",
  "Sign an exclusivity agreement with a deposit",
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
  const city = d.city ?? cityOf(d.address);
  const address = d.address?.split("\n").join(", ") ?? null;
  const facility = facilityLabel(d.facility);
  const first = d.phases[0];

  const siteSummary = [
    `${d.name}${address ? ` is at ${address}` : city ? ` is in ${city}` : ""}`,
    facility ? `, a ${facility.toLowerCase()} site` : "",
    ". ",
    totals.mw ? `It brings ${formatMw(totals.mw)} of critical IT power online` : "It comes online",
    d.phases.length > 1 && first ? ` in ${d.phases.length} phases from ${formatDay(first.rfsOn)}` : first ? ` on ${formatDay(first.rfsOn)}` : "",
    `, cooled by ${COOLING_PROSE[d.cooling]}.`,
  ].join("");

  // Each platform with the phases built as it, in the order they come online.
  const builds = [...new Set(d.phases.map((phase) => phase.platform))].map((platform) => ({
    platform,
    phases: d.phases.flatMap((phase, i) => (phase.platform === platform ? [phase.name || `Phase ${i + 1}`] : [])),
  }));
  const nodeSizes = [...new Set(builds.map(({ platform }) => SYSTEMS[platform].gpusPerNode))];

  // At a glance, under the phases: what the table doesn't say about how they're built.
  const summary = [
    nodeSizes.length === 1 ? `${nodeSizes[0]}-GPU nodes` : "Nodes",
    ` on ${networkingLabel(d.networking)} with ${COOLING_PROSE[d.cooling]}`,
    d.storageTbPerNode ? ` and ${formatTb(d.storageTbPerNode)} of storage per node` : "",
    ", built, operated and supported by ZODE end to end.",
  ].join("");

  // The cover's headline carries the site's city and its compute cell the total, so its overview gives neither.
  const overview = [
    shares.length > 1
      ? `${listOf(shares.map((share, i) => `${formatCount(share.gpus)} ${i ? "" : "NVIDIA "}${platformLabel(share.platform)}`))} GPUs`
      : `NVIDIA ${platformSummary(shares)} GPUs`,
    d.facility ? COVER_FACILITY[d.facility] : null,
  ]
    .filter(Boolean)
    .join(". ");
  // Ready in full by the last phase's year.
  const last = d.phases.at(-1);
  const headline = [
    totals.mw ? `${formatMw(totals.mw >= 1 ? Math.round(totals.mw) : totals.mw)} IT of` : null,
    last?.rfsOn.slice(0, 4),
    "Contiguous Compute Capacity",
    city ? `in ${city}` : null,
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
        ...(first ? [{ value: formatMonthYear(dayOf(first.rfsOn)), label: "First deployment" }] : []),
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
  // Over the table only when they add up more than one priced phase; one phase's would repeat its row.
  const terms = priced.length > 1
    ? [
        { label: `Per GPU-hour${scope}`, value: formatAcross(priced.map((phase) => phase.pricing.priceGpuHr), formatPrice)! },
        { label: "Term", value: formatAcross(priced.map((phase) => phase.pricing.termMonths), formatTerm) ?? "Flexible" },
        ...(contract !== null ? [{ label: `Contract value${scope}`, value: formatUsdShort(contract) }] : []),
        ...(deposit !== null ? [{ label: depositPct ? `Deposit · ${depositPct}` : "Deposit", value: formatUsdShort(deposit) }] : []),
      ]
    : priced.length
      ? []
      : teaser.terms;

  return {
    headline: cut(headline, LIMITS.headline),
    title: cut(presentationName(d), LIMITS.title),
    address: cut(address ?? city ?? "", LIMITS.address),
    subtitle: cut([teaser.headline, teaser.subheadline].filter(Boolean).join(". "), LIMITS.subtitle),
    cover: cover.slice(0, LIMITS.cover),
    cooling: d.cooling,
    summary: cut(summary, LIMITS.summary),
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
    rolloutTotal:
      d.phases.length > 1
        ? {
            capacity: cut(
              `${formatCount(totals.gpus)} GPUs · ${formatCount(totals.byPlatform.reduce((sum, share) => sum + share.nodes, 0))} nodes`,
              LIMITS.rolloutCapacity,
            ),
            power: totals.mw ? formatMw(totals.mw) : "",
          }
        : null,
    // Every slide's footer carries the address, so the specs leave out the location.
    specs: facts(
      teaser.specs
        .filter((spec) => spec.label !== "Location")
        .map((spec) =>
          spec.label === "Platform" && builds.length > 1
            ? { ...spec, value: builds.map(({ platform, phases }) => `${platformLabel(platform)} in ${phasesNamed(phases)}`).join(", ") }
            : spec,
        ),
      LIMITS.specs,
    ),
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
