import {
  DEFAULT_CLUSTER,
  GPUS_PER_NODE,
  NODE_SIZES,
  PLATFORMS,
  STORAGE_PER_NODE,
} from "@/features/cluster/model/catalog";
import type { FabricId, PlatformId } from "@/features/cluster/model/types";
import { writeConfigParams } from "@/features/cluster/model/url";

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

/** One rollout phase, ready for service (RFS) on `rfsOn`. Dates are `YYYY-MM-DD`. */
export interface Phase {
  name: string | null;
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

export interface Deployment {
  id: string;
  name: string;
  status: DeploymentStatus;
  nodes: number;
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

/** The cluster builder's standard sizes; deployments always use one. */
export const NODE_OPTIONS: readonly number[] = NODE_SIZES;
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

export interface DeploymentTotals {
  gpus: number;
  storageTb: number;
  /** Nodes across every phase, against the deployment's `nodes`. */
  scheduledNodes: number;
  mw: number;
  /** GPUs x $/GPU-hr x hours in a month, when there's a price. */
  monthlyUsd: number | null;
  /** The monthly figure over the whole term, when there's a term too. */
  contractUsd: number | null;
}

export function totalsOf(
  d: Pick<Deployment, "nodes" | "storageTbPerNode" | "priceGpuHr" | "termMonths"> & {
    phases: readonly Pick<Phase, "nodes" | "mw">[];
  },
): DeploymentTotals {
  const gpus = gpusFor(d.nodes);
  const monthlyUsd = d.priceGpuHr === null ? null : gpus * d.priceGpuHr * HOURS_PER_MONTH;
  return {
    gpus,
    storageTb: d.nodes * d.storageTbPerNode,
    scheduledNodes: d.phases.reduce((sum, phase) => sum + phase.nodes, 0),
    mw: d.phases.reduce((sum, phase) => sum + (phase.mw ?? 0), 0),
    monthlyUsd,
    contractUsd: monthlyUsd === null || d.termMonths === null ? null : monthlyUsd * d.termMonths,
  };
}

/** The first phase not yet ready for service on `today` (`YYYY-MM-DD`), if any. */
export const nextPhase = (phases: readonly Phase[], today: string): Phase | null =>
  phases.find((phase) => phase.rfsOn >= today) ?? null;

/**
 * The deployment in the cluster builder: its platform, nodes, fabric and
 * storage, with liquid DTC cabinets holding 8 nodes and air-cooled ones 4;
 * null for a platform it has no rack for.
 */
export function rackDesignHref(
  d: Pick<Deployment, "platform" | "nodes" | "networking" | "cooling" | "storageTbPerNode">,
): string | null {
  if (!inClusterBuilder(d.platform)) return null;
  const params = new URLSearchParams();
  writeConfigParams(
    {
      ...DEFAULT_CLUSTER,
      platform: d.platform,
      nodes: d.nodes,
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
