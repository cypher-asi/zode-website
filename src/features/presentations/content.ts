import { GPUS_PER_NODE } from "@/features/cluster/model/catalog";
import { dayOf, formatCount, formatDay, formatMonthYear, formatMw, formatTb } from "@/features/deployments/format";
import {
  coolingLabel,
  facilityLabel,
  gpusFor,
  networkingLabel,
  platformBreakdown,
  platformLabel,
  platformSummary,
  totalsOf,
  type Deployment,
} from "@/features/deployments/types";
import { teaserOf } from "@/features/teasers/content";
import { LIMITS, type LabeledValue, type PresentationContent, type SpecCell, type Stat } from "./types";

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
 * with its external notes as a slide of their own and the teaser's contact.
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

  return {
    eyebrow: cut(["Site overview", place].filter(Boolean).join(" · "), LIMITS.eyebrow),
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
    terms: teaser.terms.map((term) => ({ label: cut(term.label, LIMITS.termLabel), value: cut(term.value, LIMITS.termValue) })),
    nextSteps: NEXT_STEPS.slice(0, LIMITS.nextSteps).join("\n"),
    contactName: teaser.contactName,
    contactEmail: teaser.contactEmail,
  };
}
