import { DEFAULT_CLUSTER, NODE_SIZES, PLATFORMS, STORAGE_PER_NODE } from "@/features/cluster/model/catalog";
import type { ClusterConfig, FabricId, PlatformId } from "@/features/cluster/model/types";
import { writeConfigParams } from "@/features/cluster/model/url";
import {
  COOLING as CONFIG_COOLING,
  NETWORKING as CONFIG_NETWORKING,
  SYSTEMS,
  type ConfigOverrides,
  type DeploymentConfig,
} from "./config/catalog";
import { resolveConfig } from "./config/resolve";
import { formatCount } from "./format";

/*
 * A GPU deployment as the portal shows it, and the figures derived from it.
 * Shared by the list, the detail page, the form and the PDF, so none of them
 * store or recompute a total differently.
 */

export type DeploymentStatus = "planned" | "active" | "completed";
/** The cluster builder's HGX platforms, then rack-scale systems it can't lay out yet. */
export type Platform = PlatformId | "gb200_nvl72" | "gb300_nvl72" | "vera_rubin";
export type Cooling = "liquid_dtc" | "air";
export type Networking = FabricId;
export type Facility = "colo" | "conversion" | "greenfield";
export type CreditRating = "ig" | "high" | "not_required";
/** Who can open a deployment: anyone with its public link, every signed-in account, the ZODE team, or one account. */
export type DeploymentAccess = "public" | "users" | "team" | "private";

/** One rollout phase of one platform, ready for service (RFS) on `rfsOn`. Dates are `YYYY-MM-DD`. */
export interface Phase {
  /** Kept across saves, so the phase's bill of materials stays with it. */
  id: string;
  name: string | null;
  platform: Platform;
  startOn: string | null;
  rfsOn: string;
  nodes: number;
  mw: number | null;
  /** The phase's cluster in the cluster builder, or null to derive one (see `phaseCluster`). */
  clusterConfig: ClusterConfig | null;
  /** Identical builder clusters the phase is made of. */
  clusterCopies: number;
  /** Where the phase's configuration differs from the deployment's (see `resolveConfig`). */
  configOverrides: ConfigOverrides;
}

/** A phase as the deployment form saves it: a new one has no id yet, and its cluster is set on the BOM. */
export type PhaseInput = Omit<Phase, "id" | "clusterConfig" | "clusterCopies"> & { id: string | null };

/** A Google place suggested for the address field. */
export interface PlaceSuggestion {
  placeId: string;
  main: string;
  secondary: string | null;
}

export const isPlaceId = (value: string): boolean => /^[\w-]{1,300}$/.test(value);

/** The address and city of a picked Google place. */
export interface PlaceAddress {
  placeId: string;
  address: string;
  city: string | null;
}

/** A data room a deployment can link to. */
export interface RoomChoice {
  id: string;
  name: string;
}

export interface Deployment {
  id: string;
  name: string;
  status: DeploymentStatus;
  /** Across every platform. */
  nodes: number;
  /** The platform of nodes no phase schedules yet, and the one new phases start on. */
  platform: Platform;
  cooling: Cooling;
  networking: Networking;
  storageTbPerNode: number;
  /** The rest of how it's built, which each phase takes unless it overrides it, and its BOM is sized to. */
  configuration: DeploymentConfig;
  address: string | null;
  city: string | null;
  placeId: string | null;
  facility: Facility | null;
  termMonths: number | null;
  priceGpuHr: number | null;
  /** Percent of the contract value; `depositUsd` is calculated from it on save. */
  depositPct: number | null;
  depositUsd: number | null;
  creditRating: CreditRating | null;
  locRequired: boolean;
  locYears: number | null;
  creditGuarantee: boolean;
  leaseGuarantee: boolean;
  /** Internal: in the portal and the team's PDF, never behind the public link. */
  notes: string | null;
  /** Shown wherever the deployment is, its public link included. */
  externalNotes: string | null;
  dataRoomId: string | null;
  dataRoomName: string | null;
  /** The secret in its public link (`sharePath`), which only opens while `access` is public. */
  shareToken: string | null;
  access: DeploymentAccess;
  /** The ZOS user id of the one account a private deployment opens for. */
  privateTo: string | null;
  /** In RFS order. */
  phases: Phase[];
  /** ISO timestamp. */
  updatedAt: string;
}

export interface Option<Id extends string> {
  value: Id;
  label: string;
}

export const STATUSES: readonly Option<DeploymentStatus>[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

/** The cluster builder's platforms, then ones it can't lay out a rack for yet. */
export const PLATFORM_OPTIONS: readonly Option<Platform>[] = [
  ...(Object.keys(PLATFORMS) as PlatformId[]).map((id) => ({ value: id, label: PLATFORMS[id].short })),
  { value: "gb200_nvl72", label: "GB200 NVL72" },
  { value: "gb300_nvl72", label: "GB300 NVL72" },
  { value: "vera_rubin", label: "Vera Rubin" },
];

const inClusterBuilder = (platform: Platform): platform is PlatformId => Object.hasOwn(PLATFORMS, platform);

export const COOLING: readonly Option<Cooling>[] = CONFIG_COOLING;
export const NETWORKING: readonly Option<Networking>[] = CONFIG_NETWORKING;

export const FACILITIES: readonly Option<Facility>[] = [
  { value: "colo", label: "Colo facility" },
  { value: "conversion", label: "Conversion" },
  { value: "greenfield", label: "Greenfield" },
];

export const CREDIT_RATINGS: readonly Option<CreditRating>[] = [
  { value: "ig", label: "Investment grade" },
  { value: "high", label: "High credit" },
  { value: "not_required", label: "Not required" },
];

export const STORAGE_OPTIONS: readonly number[] = STORAGE_PER_NODE;

const labelOf = <Id extends string>(options: readonly Option<Id>[], value: Id | null): string | null =>
  value === null ? null : (options.find((option) => option.value === value)?.label ?? value);

export const statusLabel = (value: DeploymentStatus): string => labelOf(STATUSES, value)!;
export const platformLabel = (value: Platform): string => labelOf(PLATFORM_OPTIONS, value)!;
export const coolingLabel = (value: Cooling): string => labelOf(COOLING, value)!;
export const networkingLabel = (value: Networking): string => labelOf(NETWORKING, value)!;
export const facilityLabel = (value: Facility | null): string | null => labelOf(FACILITIES, value);
export const creditLabel = (value: CreditRating | null): string | null => labelOf(CREDIT_RATINGS, value);

export const isOption = <Id extends string>(options: readonly Option<Id>[], value: unknown): value is Id =>
  options.some((option) => option.value === value);

/** Billed hours in an average month (8,760 / 12). */
export const HOURS_PER_MONTH = 730;

/** GPUs in `nodes` nodes of `platform`: 8 to an HGX node, and a rack-scale compute tray's own. */
export const gpusFor = (platform: Platform, nodes: number): number => nodes * SYSTEMS[platform].gpusPerNode;

/** The IT MW `nodes` nodes of `platform` draw, to the hundredth a phase keeps. */
export const mwFor = (platform: Platform, nodes: number): number =>
  Math.round((nodes * SYSTEMS[platform].nodeKw) / 10) / 100;

/** `pct` percent of the contract value, to the cent, when there's both. */
export const depositFor = (contractUsd: number | null, pct: number | null): number | null =>
  contractUsd === null || pct === null ? null : Math.round(contractUsd * pct) / 100;

/** One platform's share of a deployment. */
export interface PlatformShare {
  platform: Platform;
  nodes: number;
  gpus: number;
  mw: number;
}

export interface DeploymentTotals {
  gpus: number;
  storageTb: number;
  /** Nodes across every phase, against the deployment's `nodes`. */
  scheduledNodes: number;
  mw: number;
  /**
   * Each platform's phases, in the order they first come, with the nodes no
   * phase schedules counted on the deployment's platform.
   */
  byPlatform: PlatformShare[];
  /** GPUs x $/GPU-hr x hours in a month, when there's a price. */
  monthlyUsd: number | null;
  /** The monthly figure over the whole term, when there's a term too. */
  contractUsd: number | null;
}

export function totalsOf(
  d: Pick<Deployment, "nodes" | "platform" | "storageTbPerNode" | "priceGpuHr" | "termMonths"> & {
    phases: readonly Pick<Phase, "platform" | "nodes" | "mw">[];
  },
): DeploymentTotals {
  const scheduledNodes = d.phases.reduce((sum, phase) => sum + phase.nodes, 0);
  const shares = new Map<Platform, PlatformShare>();
  const add = (platform: Platform, nodes: number, mw: number) => {
    const share = shares.get(platform) ?? { platform, nodes: 0, gpus: 0, mw: 0 };
    share.nodes += nodes;
    share.gpus = gpusFor(platform, share.nodes);
    share.mw += mw;
    shares.set(platform, share);
  };
  for (const phase of d.phases) add(phase.platform, phase.nodes, phase.mw ?? 0);
  if (d.nodes > scheduledNodes || !shares.size) add(d.platform, Math.max(d.nodes - scheduledNodes, 0), 0);
  const gpus = [...shares.values()].reduce((sum, share) => sum + share.gpus, 0);
  const monthlyUsd = d.priceGpuHr === null ? null : gpus * d.priceGpuHr * HOURS_PER_MONTH;
  return {
    gpus,
    storageTb: d.nodes * d.storageTbPerNode,
    scheduledNodes,
    mw: d.phases.reduce((sum, phase) => sum + (phase.mw ?? 0), 0),
    byPlatform: [...shares.values()],
    monthlyUsd,
    contractUsd: monthlyUsd === null || d.termMonths === null ? null : monthlyUsd * d.termMonths,
  };
}

/** The deployment's platforms by name, e.g. "B300" or "B300 + Vera Rubin". */
export const platformSummary = (shares: readonly Pick<PlatformShare, "platform">[]): string =>
  shares.map((share) => platformLabel(share.platform)).join(" + ");

/** GPUs per platform, e.g. "2,048 B300 · 6,400 Vera Rubin". */
export const platformBreakdown = (shares: readonly Pick<PlatformShare, "platform" | "gpus">[]): string =>
  shares.map((share) => `${formatCount(share.gpus)} ${platformLabel(share.platform)}`).join(" · ");

/** The first phase not yet ready for service on `today` (`YYYY-MM-DD`), if any. */
export const nextPhase = (phases: readonly Phase[], today: string): Phase | null =>
  phases.find((phase) => phase.rfsOn >= today) ?? null;

/**
 * The deployment in the cluster builder: its first platform the builder has a
 * rack for, with that platform's nodes and the deployment's configuration.
 * Null when no platform has a rack, or its nodes aren't one of the builder's
 * sizes.
 */
export function rackDesignHref(
  d: Pick<Deployment, "platform" | "nodes" | "networking" | "cooling" | "storageTbPerNode" | "configuration"> & {
    phases: readonly Pick<Phase, "platform" | "nodes" | "mw">[];
  },
): string | null {
  const share = totalsOf({ ...d, priceGpuHr: null, termMonths: null }).byPlatform.find((s) =>
    inClusterBuilder(s.platform),
  );
  if (!share || !inClusterBuilder(share.platform)) return null;
  if (!(NODE_SIZES as readonly number[]).includes(share.nodes)) return null;
  const c = resolveConfig(d);
  const params = new URLSearchParams();
  writeConfigParams(
    {
      ...DEFAULT_CLUSTER,
      platform: share.platform,
      nodes: share.nodes,
      fabric: c.networking,
      storagePerNode: (STORAGE_PER_NODE as readonly number[]).includes(c.storageTbPerNode) ? c.storageTbPerNode : 0,
      density: c.density,
      oversubscription: c.oversubscription,
      rackU: c.rackU,
    },
    params,
  );
  const query = params.toString();
  return query ? `/cluster-builder?${query}` : "/cluster-builder";
}

/** The download name of a deployment's PDF, e.g. "ZODE - Deployment - Dallas 1.pdf". */
export const deploymentFileName = (name: string): string =>
  `ZODE - Deployment - ${
    name
      .replace(/[^\p{L}\p{N} .,&-]+/gu, " ")
      .replace(/ {2,}/g, " ")
      .trim()
      .slice(0, 80) || "Deployment"
  }.pdf`;

/** A deployment's public page, which anyone with `token` can open. */
export const sharePath = (token: string): string => `/shared/deployments/${token}`;

/** The share dialog's choices, from widest to narrowest. */
export const ACCESS_OPTIONS: readonly (Option<DeploymentAccess> & { detail: string })[] = [
  {
    value: "public",
    label: "Anyone with the link",
    detail: "No sign-in needed. They see its PDF, without internal notes, credit or the data room.",
  },
  { value: "users", label: "ZODE users", detail: "Anyone signed in to ZODE can open it and its PDF." },
  { value: "team", label: "ZODE team", detail: "Only the ZODE team can open it." },
  { value: "private", label: "Only me", detail: "Hidden from everyone else, the rest of the team included." },
];

/** Who's looking: a signed-in account, and whether it's on the ZODE team. */
export interface DeploymentViewer {
  team: boolean;
  userId: string;
}

/** Whether `viewer` can open deployment `d` in the portal. */
export function canOpen(d: Pick<Deployment, "access" | "privateTo">, viewer: DeploymentViewer): boolean {
  if (d.access === "team") return viewer.team;
  if (d.access === "private") return d.privateTo === viewer.userId;
  return true;
}

/** The link the share dialog copies: the public page while it's public, otherwise its page in the portal. */
export const deploymentLink = (d: Pick<Deployment, "id" | "access" | "shareToken">): string =>
  d.access === "public" && d.shareToken ? sharePath(d.shareToken) : `/portal/deployments/${d.id}`;

/** The public PDF behind `sharePath(token)`, inline, or as a download with `download`. */
export const sharedPdfPath = (token: string, download = false): string =>
  `/api/shared/deployments/${token}/pdf${download ? "?download=1" : ""}`;
