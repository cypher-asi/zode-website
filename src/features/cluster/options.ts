import type { Choice } from "@/features/configurator/buyConfig";
import { FABRICS, PLATFORMS, RACK, rackHeight } from "./model/catalog";
import type { FabricId, Layer, PlatformId } from "./model/types";

/** A control's option; `focus` is the scene layer hovering it outlines. */
export type ClusterChoice<Id extends string> = Choice<Id, Layer>;

const kw = (n: number) => `${Math.round(n)} kW`;

export const PLATFORM_CHOICES: readonly ClusterChoice<PlatformId>[] = (Object.keys(PLATFORMS) as PlatformId[]).map(
  (id) => {
    const p = PLATFORMS[id];
    return {
      id,
      label: p.label,
      detail: `8 x ${p.gpu} · ${p.gpuMemoryGb} GB · ${p.railGbps}G rails`,
      note: kw(p.nodeKw) + " / node",
      focus: "compute",
    };
  },
);

export const densityChoices = (platform: PlatformId): readonly ClusterChoice<"4" | "8">[] =>
  (["4", "8"] as const).map((id) => ({
    id,
    label: `${id} nodes per rack`,
    detail: id === "8" ? "Dense liquid-cooled cabinets" : "Half density, easier on power",
    note: kw(Number(id) * PLATFORMS[platform].nodeKw),
    focus: "compute",
  }));

export const FABRIC_CHOICES: readonly ClusterChoice<FabricId>[] = (Object.keys(FABRICS) as FabricId[]).map((id) => {
  const f = FABRICS[id];
  return {
    id,
    label: f.label,
    detail: `${f.detail} · ${f.compute.model}`,
    note: `${f.compute.uSize}U switches`,
    focus: "network",
  };
});

export const TOPOLOGY_CHOICES: readonly ClusterChoice<"1" | "2">[] = [
  { id: "1", label: "Non-blocking", detail: "As many uplinks as host links on every leaf", focus: "network" },
  { id: "2", label: "2:1 oversubscribed", detail: "Half the spine, for inference-heavy clusters", focus: "network" },
];

export const rackNote = (u: number) => `${rackHeight(u).toFixed(2)} m · ${RACK.width * 1000} x ${RACK.depth * 1000} mm`;

export const storageLabel = (tb: number) => (tb === 0 ? "None" : `${tb} TB`);
