import type { Derived } from "@/features/chassis/model/calc";
import type { DesignData } from "@/features/chassis/model/schema";

export interface Usage {
  label: string;
  sheets: string[];
}

const RACK_SHEETS = ["G-101", "G-104", "G-105", "G-106", "G-107"];
const POD_SHEET: Record<string, string> = { electrical: "E-102", cooling: "M-101", compute: "G-101" };

/** Where a part / BOM line shows up in the model, and which sheets draw it. */
export function whereUsed(data: DesignData, d: Derived, partId: string | null, bomId: string | null): Usage[] {
  const out: Usage[] = [];
  const boms = new Set<string>(bomId ? [bomId] : []);
  if (partId) for (const b of d.bomByPart.get(partId) ?? []) boms.add(b.id);
  const parts = new Set<string>(partId ? [partId] : []);
  for (const b of boms) {
    const p = d.bomById.get(b)?.partId;
    if (p) parts.add(p);
  }
  for (const p of data.parts.parts) if (p.coveredBy && boms.has(p.coveredBy)) parts.add(p.partId);

  for (const t of data.racks.types) {
    const n = data.racks.racks.filter((r) => r.type === t.id).length;
    const hits =
      [t.frame, t.rdhx].filter((p) => parts.has(p)).length +
      t.slots.filter((s) => s.part && parts.has(s.part)).length +
      t.zeroU.filter((z) => parts.has(z.part)).length +
      t.kits.filter((k) => parts.has(k.part)).length;
    if (hits) out.push({ label: `Rack type ${t.id}: ${hits} per rack x ${n} racks`, sheets: RACK_SHEETS });
  }
  if (parts.has("busway-tap") || boms.has("E5"))
    out.push({ label: `${d.power.taps} busway taps`, sheets: ["G-107", "E-101", "G-108"] });

  for (const pod of data.pods.pods) {
    if (boms.has(pod.shellBom)) out.push({ label: `${pod.name} shell`, sheets: ["G-103", "G-001", "G-002"] });
    const pl = pod.placements.filter((p) => (p.bom && boms.has(p.bom)) || (p.part && parts.has(p.part)));
    if (pl.length)
      out.push({
        label: `${pod.name} plan: ${pl.map((p) => p.id).join(", ")}`,
        sheets: [POD_SHEET[pod.id] ?? "G-001", "G-001"],
      });
  }
  for (const roof of data.pods.roofProfiles) {
    const used = roof.kits.some((k) => parts.has(k.part)) || (roof.fanPart && parts.has(roof.fanPart));
    if (used) out.push({ label: `Roof profile ${roof.id}`, sheets: ["M-103", "M-105", "G-002"] });
  }
  const cc = data.cooling.components.filter((c) => (c.bom && boms.has(c.bom)) || (c.part && parts.has(c.part)));
  if (cc.length) out.push({ label: `Cooling loops: ${cc.map((c) => c.id).join(", ")}`, sheets: ["M-102"] });

  const e = data.electrical;
  const sld = [e.switchboard, ...e.mains, ...e.busways, ...e.feeders, e.originSpd, ...e.coolingChain].filter(
    (n) => n.bom && boms.has(n.bom),
  );
  if (sld.length)
    out.push({ label: `Single line: ${[...new Set(sld.map((n) => n.id))].join(", ")}`, sheets: ["E-101"] });

  const site = data.site.equipment.filter((x) => x.bom && boms.has(x.bom));
  if (site.length) out.push({ label: `Site: ${site.map((x) => x.id).join(", ")}`, sheets: ["G-001", "G-002"] });
  const links = data.site.links.filter((x) => x.bom && boms.has(x.bom));
  if (links.length) out.push({ label: `Site links: ${links.map((x) => x.id).join(", ")}`, sheets: ["G-001", "G-002"] });

  if (boms.size) out.push({ label: "Equipment schedule", sheets: ["G-601"] });
  return out;
}
