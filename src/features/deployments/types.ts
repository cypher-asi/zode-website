import {
  DEFAULT_CLUSTER,
  GPUS_PER_NODE,
  NODE_SIZES,
  PLATFORMS,
  STORAGE_PER_NODE,
} from "@/features/cluster/model/catalog";
import type { FabricId, PlatformId } from "@/features/cluster/model/types";
import { writeConfigParams } from "@/features/cluster/model/url";
import { formatCount } from "./format";

/*
 * A GPU deployment as the portal shows it, and the figures derived from it.
 * Shared by the list, the detail page, the form and the PDF, so none of them
 * store or recompute a total differently.
 */

export type DeploymentStatus = "planned" | "active" | "completed";
export type Platform = PlatformId | "vera_rubin";
export type Cooling = "liquid_dtc" | "air";
export type Networking = FabricId;
export type Facility = "colo" | "conversion" | "greenfield";
export type CreditRating = "ig" | "high" | "not_required";

/** One rollout phase of one platform, ready for service (RFS) on `rfsOn`. Dates are `YYYY-MM-DD`. */
export interface Phase {
  name: string | null;
  platform: Platform;
  startOn: string | null;
  rfsOn: string;
  nodes: number;
  mw: number | null;
}

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
  address: string | null;
  city: string | null;
  placeId: string | null;
  facility: Facility | null;
  termMonths: number | null;
  priceGpuHr: number | null;
  depositUsd: number | null;
  creditRating: CreditRating | null;
  locRequired: boolean;
  locYears: number | null;
  creditGuarantee: boolean;
  leaseGuarantee: boolean;
  notes: string | null;
  dataRoomId: string | null;
  dataRoomName: string | null;
  /** The secret in its public link (`sharePath`), or null when it isn't shared. */
  shareToken: string | null;
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
  { value: "vera_rubin", label: "Vera Rubin" },
];

const inClusterBuilder = (platform: Platform): platform is PlatformId => Object.hasOwn(PLATFORMS, platform);

export const COOLING: readonly Option<Cooling>[] = [
  { value: "liquid_dtc", label: "Liquid DTC" },
  { value: "air", label: "Air" },
];

export const NETWORKING: readonly Option<Networking>[] = [
  { value: "infiniband", label: "InfiniBand" },
  { value: "roce", label: "RoCEv2" },
];

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

export const gpusFor = (nodes: number): number => nodes * GPUS_PER_NODE;

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
  const gpus = gpusFor(d.nodes);
  const scheduledNodes = d.phases.reduce((sum, phase) => sum + phase.nodes, 0);
  const shares = new Map<Platform, PlatformShare>();
  const add = (platform: Platform, nodes: number, mw: number) => {
    const share = shares.get(platform) ?? { platform, nodes: 0, gpus: 0, mw: 0 };
    share.nodes += nodes;
    share.gpus = gpusFor(share.nodes);
    share.mw += mw;
    shares.set(platform, share);
  };
  for (const phase of d.phases) add(phase.platform, phase.nodes, phase.mw ?? 0);
  if (d.nodes > scheduledNodes || !shares.size) add(d.platform, Math.max(d.nodes - scheduledNodes, 0), 0);
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
 * rack for, with that platform's nodes, the fabric and storage, liquid DTC
 * cabinets holding 8 nodes and air-cooled ones 4. Null when no platform has a
 * rack, or its nodes aren't one of the builder's sizes.
 */
export function rackDesignHref(
  d: Pick<Deployment, "platform" | "nodes" | "networking" | "cooling" | "storageTbPerNode"> & {
    phases: readonly Pick<Phase, "platform" | "nodes" | "mw">[];
  },
): string | null {
  const share = totalsOf({ ...d, priceGpuHr: null, termMonths: null }).byPlatform.find((s) =>
    inClusterBuilder(s.platform),
  );
  if (!share || !inClusterBuilder(share.platform)) return null;
  if (!(NODE_SIZES as readonly number[]).includes(share.nodes)) return null;
  const params = new URLSearchParams();
  writeConfigParams(
    {
      ...DEFAULT_CLUSTER,
      platform: share.platform,
      nodes: share.nodes,
      fabric: d.networking,
      storagePerNode: d.storageTbPerNode,
      density: d.cooling === "air" ? 4 : 8,
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

/** The public PDF behind `sharePath(token)`, inline, or as a download with `download`. */
export const sharedPdfPath = (token: string, download = false): string =>
  `/api/shared/deployments/${token}/pdf${download ? "?download=1" : ""}`;
