import { GPUS_PER_NODE } from "@/features/cluster/model/catalog";
import {
  dayOf,
  formatCount,
  formatDay,
  formatMonthYear,
  formatMw,
  formatRate,
  formatTb,
  formatTerm,
  formatUsd,
} from "@/features/deployments/format";
import {
  coolingLabel,
  gpusFor,
  networkingLabel,
  platformBreakdown,
  platformLabel,
  platformSummary,
  totalsOf,
  type Deployment,
} from "@/features/deployments/types";
import { LIMITS, type TeaserInput } from "./types";

const monthOf = (iso: string): string => formatMonthYear(dayOf(iso));

const COOLING_PROSE: Record<Deployment["cooling"], string> = {
  liquid_dtc: "direct-to-chip liquid cooling",
  air: "air cooling",
};

/** "a", "a and b", "a, b and c". */
const listOf = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

const cut = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 3).trimEnd()}...`);

/**
 * The part of `deployment` a teaser offers: the phases at `phases` (indexes
 * into its RFS-ordered phases) and only their nodes, or all of it when that's
 * every phase, none, or null.
 */
export function offeringOf(deployment: Deployment, phases: readonly number[] | null): Deployment {
  const chosen = deployment.phases.filter((_, i) => phases?.includes(i));
  if (!chosen.length || chosen.length === deployment.phases.length) return deployment;
  return {
    ...deployment,
    phases: chosen,
    nodes: chosen.reduce((sum, phase) => sum + phase.nodes, 0),
    platform: chosen[0].platform,
  };
}

/**
 * A teaser for the `phases` of `deployment` (see `offeringOf`), every figure
 * written out from them as text for the team to edit, with `contact` as who to
 * reach. Nothing internal (notes, credit, the data room) is copied.
 */
export function draftFromDeployment(
  deployment: Deployment,
  contact: { name: string; email: string },
  phases: readonly number[] | null = null,
): TeaserInput {
  const d = offeringOf(deployment, phases);
  const partial = d !== deployment;
  const totals = totalsOf(d);
  const shares = totals.byPlatform.filter((share) => share.gpus > 0);
  const place = d.city ?? d.address?.split("\n")[0] ?? null;
  const first = d.phases[0];
  const last = d.phases.at(-1);
  const firstRfsOf = (platform: string) => d.phases.find((phase) => phase.platform === platform)?.rfsOn;

  const platforms = shares.length === 1 ? `NVIDIA ${platformLabel(shares[0].platform)}` : "NVIDIA";
  const headline = `${formatCount(totals.gpus)} ${platforms} GPUs${place ? ` in ${place}` : ""}`;

  const readiness = shares
    .map((share) => {
      const rfs = firstRfsOf(share.platform);
      return rfs ? `${platformLabel(share.platform)} from ${formatDay(rfs)}` : null;
    })
    .filter((text): text is string => text !== null);
  const subheadline = [readiness.length ? `Ready for service: ${listOf(readiness)}` : null, d.address?.split("\n").join(", ")]
    .filter(Boolean)
    .join(". ");

  const stats = [
    ...shares.slice(0, 2).map((share) => {
      const rfs = firstRfsOf(share.platform);
      return {
        value: formatCount(share.gpus),
        label: rfs ? `${platformLabel(share.platform)} · ${monthOf(rfs)}` : `${platformLabel(share.platform)} GPUs`,
      };
    }),
    ...(totals.mw ? [{ value: formatMw(totals.mw), label: "Critical IT power" }] : []),
    { value: coolingLabel(d.cooling), label: "Cooling" },
    { value: networkingLabel(d.networking), label: "Networking" },
  ].slice(0, LIMITS.stats);

  const summary = [
    `Dedicated ${platformSummary(shares)} capacity${place ? ` in ${place}` : ""}, delivered by ZODE`,
    d.phases.length > 1 && first ? ` in ${d.phases.length} phases from ${formatDay(first.rfsOn)}` : "",
    `. Each cluster runs on ${networkingLabel(d.networking)} with ${COOLING_PROSE[d.cooling]}, `,
    "and is built, operated and supported by ZODE end to end.",
  ].join("");

  const highlights = [
    d.phases.length > 1 && first && last
      ? `${d.phases.length} phases from ${monthOf(first.rfsOn)} to ${monthOf(last.rfsOn)}, ${platformBreakdown(shares)} GPUs`
      : null,
    `${networkingLabel(d.networking)} fabric and ${COOLING_PROSE[d.cooling]}`,
    d.storageTbPerNode ? `${formatTb(d.storageTbPerNode)} of storage per node` : null,
    "Built, operated and supported by ZODE",
  ].filter((line): line is string => line !== null);

  const availability = d.phases.slice(0, LIMITS.availability).map((phase, i) => ({
    label: cut(phase.name || `Phase ${i + 1}`, LIMITS.availabilityLabel),
    capacity: cut(
      `${formatCount(gpusFor(phase.nodes))} ${platformLabel(phase.platform)} GPUs${phase.mw !== null ? ` · ${formatMw(phase.mw)}` : ""}`,
      LIMITS.availabilityCapacity,
    ),
    date: formatDay(phase.rfsOn),
  }));

  const specs = [
    { label: "Platform", value: platformSummary(shares) },
    { label: "GPUs", value: formatCount(totals.gpus) },
    { label: "Nodes", value: `${formatCount(d.nodes)} × ${GPUS_PER_NODE} GPUs` },
    ...(totals.mw ? [{ label: "Power", value: `${formatMw(totals.mw)} critical IT` }] : []),
    { label: "Networking", value: networkingLabel(d.networking) },
    { label: "Cooling", value: coolingLabel(d.cooling) },
    { label: "Storage", value: d.storageTbPerNode ? `${formatTb(d.storageTbPerNode)} per node` : "On request" },
    ...(place ? [{ label: "Location", value: place }] : []),
  ]
    .slice(0, LIMITS.specs)
    .map((spec) => ({ label: spec.label, value: cut(spec.value, LIMITS.specValue) }));

  const terms = [
    { label: "Pricing", value: d.priceGpuHr !== null ? formatRate(d.priceGpuHr) : "On request" },
    { label: "Term", value: d.termMonths !== null ? formatTerm(d.termMonths) : "Flexible" },
    ...(d.depositUsd !== null ? [{ label: "Deposit", value: formatUsd(d.depositUsd) }] : []),
  ].slice(0, LIMITS.terms);

  return {
    name: cut(partial ? `${d.name} · ${platformSummary(shares)}` : d.name, LIMITS.name),
    deploymentId: d.id,
    eyebrow: cut([place, first ? `Available ${monthOf(first.rfsOn)}` : null].filter(Boolean).join(" · "), LIMITS.eyebrow),
    headline: cut(headline, LIMITS.headline),
    subheadline: cut(subheadline, LIMITS.subheadline),
    stats: stats.map((stat) => ({ value: cut(stat.value, LIMITS.statValue), label: cut(stat.label, LIMITS.statLabel) })),
    summary: cut(summary, LIMITS.summary),
    highlights: highlights
      .slice(0, LIMITS.highlights)
      .map((line) => cut(line, LIMITS.highlight))
      .join("\n"),
    availability,
    specs,
    terms,
    contactName: cut(contact.name, LIMITS.contactName),
    contactEmail: cut(contact.email, LIMITS.contactEmail),
  };
}
