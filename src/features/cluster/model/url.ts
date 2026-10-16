import {
  DEFAULT_CLUSTER,
  DENSITIES,
  FABRICS,
  NODE_SIZES,
  OVERSUBSCRIPTION,
  PLATFORMS,
  RACK_HEIGHTS,
  ROW_LENGTHS,
  STORAGE_PER_NODE,
} from "./catalog";
import type { ClusterConfig, FabricId, PlatformId } from "./types";

/** Short query keys, so a shared link stays readable. */
const KEYS = {
  platform: "gpu",
  nodes: "nodes",
  density: "density",
  fabric: "fabric",
  oversubscription: "ratio",
  rackU: "u",
  rowLength: "row",
  storagePerNode: "tb",
} as const satisfies Record<keyof ClusterConfig, string>;

const pickNumber = (raw: string | null, allowed: readonly number[], fallback: number) => {
  const n = raw ? Number(raw) : NaN;
  return allowed.includes(n) ? n : fallback;
};

const pickId = <Id extends string>(raw: string | null, allowed: Record<Id, unknown>, fallback: Id): Id =>
  raw && raw in allowed ? (raw as Id) : fallback;

/** Reads a configuration from query params; anything missing or unknown keeps its default. */
export function configFromParams(params: URLSearchParams): ClusterConfig {
  const d = DEFAULT_CLUSTER;
  return {
    platform: pickId<PlatformId>(params.get(KEYS.platform), PLATFORMS, d.platform),
    nodes: pickNumber(params.get(KEYS.nodes), NODE_SIZES, d.nodes),
    density: pickNumber(params.get(KEYS.density), DENSITIES, d.density),
    fabric: pickId<FabricId>(params.get(KEYS.fabric), FABRICS, d.fabric),
    oversubscription: pickNumber(params.get(KEYS.oversubscription), OVERSUBSCRIPTION, d.oversubscription),
    rackU: pickNumber(params.get(KEYS.rackU), RACK_HEIGHTS, d.rackU),
    rowLength: pickNumber(params.get(KEYS.rowLength), ROW_LENGTHS, d.rowLength),
    storagePerNode: pickNumber(params.get(KEYS.storagePerNode), STORAGE_PER_NODE, d.storagePerNode),
  };
}

/** A configuration stored as JSON, or null unless every setting is one the builder offers. */
export function configFromJson(raw: unknown): ClusterConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const one = (value: unknown, allowed: readonly number[]) =>
    typeof value === "number" && allowed.includes(value) ? value : null;
  const config = {
    platform: typeof r.platform === "string" && Object.hasOwn(PLATFORMS, r.platform) ? (r.platform as PlatformId) : null,
    nodes: one(r.nodes, NODE_SIZES),
    density: one(r.density, DENSITIES),
    fabric: typeof r.fabric === "string" && Object.hasOwn(FABRICS, r.fabric) ? (r.fabric as FabricId) : null,
    oversubscription: one(r.oversubscription, OVERSUBSCRIPTION),
    rackU: one(r.rackU, RACK_HEIGHTS),
    rowLength: one(r.rowLength, ROW_LENGTHS),
    storagePerNode: one(r.storagePerNode, STORAGE_PER_NODE),
  };
  return Object.values(config).every((value) => value !== null) ? (config as ClusterConfig) : null;
}

/** Writes only what differs from the defaults onto `params`. */
export function writeConfigParams(config: ClusterConfig, params: URLSearchParams): void {
  for (const key of Object.keys(KEYS) as (keyof ClusterConfig)[]) {
    if (config[key] === DEFAULT_CLUSTER[key]) params.delete(KEYS[key]);
    else params.set(KEYS[key], String(config[key]));
  }
}
