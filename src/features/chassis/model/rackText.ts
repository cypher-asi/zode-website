import type { RackType, Slot, SlotKind } from "@/features/chassis/model/schema";
import type { Derived } from "@/features/chassis/model/calc";
import { fmt, pad2 } from "@/features/chassis/model/format";
import { uRange } from "@/features/chassis/model/calc";

export interface SlotGroup {
  kind: SlotKind;
  uStart: number;
  uEnd: number;
  slots: Slot[];
  label: string;
}

function groupLabel(kind: SlotKind, slots: Slot[], d: Derived): string {
  const n = slots.length;
  const units = slots.reduce((s, x) => s + x.uHeight, 0);
  const u = slots[0].uHeight;
  switch (kind) {
    case "node":
      return `${n} x ${u}U GPU nodes`;
    case "cdu":
      return `${units}U CDU`;
    case "pdu":
      return `${n} x ${u}U PDU`;
    case "aux":
      return `${units}U UPS AUX`;
    case "spare":
      return units > 1 ? `${units}U spare` : "Spare";
    case "patch":
      return `${units}U patching`;
    case "oob":
      return `${n} x ${u}U OOB`;
    case "mgmt":
      return `${n} x ${u}U management`;
    case "storage":
      return `${units}U storage*`;
    case "network": {
      const counts = new Map<string, number>();
      for (const s of slots) {
        const name = d.partsById.get(s.part ?? "")?.name.toLowerCase() ?? "";
        const key = name.includes("spine") ? "spine" : name.includes("leaf") ? "leaf" : "switch";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts].map(([k, c]) => `${c} ${k}`).join(" + ");
    }
  }
}

/** Merge contiguous slots of the same kind (G-106 style). */
export function groupSlots(type: RackType, d: Derived): SlotGroup[] {
  const sorted = [...type.slots].sort((a, b) => a.uStart - b.uStart);
  const groups: { kind: SlotKind; slots: Slot[] }[] = [];
  for (const s of sorted) {
    const last = groups.at(-1);
    const lastSlot = last?.slots.at(-1);
    if (last && last.kind === s.kind && lastSlot && lastSlot.uStart + lastSlot.uHeight === s.uStart) last.slots.push(s);
    else groups.push({ kind: s.kind, slots: [s] });
  }
  return groups.map((g) => ({
    kind: g.kind,
    slots: g.slots,
    uStart: g.slots[0].uStart,
    uEnd: g.slots.at(-1)!.uStart + g.slots.at(-1)!.uHeight - 1,
    label: groupLabel(g.kind, g.slots, d),
  }));
}

/** The six-line plan label inside each rack bay on G-101. */
export function rackPlanLines(type: RackType, d: Derived): string[] {
  const count = (k: SlotKind) => type.slots.filter((s) => s.kind === k);
  const pdus = count("pdu");
  const aux = count("aux")[0];
  const spareU = count("spare").reduce((s, x) => s + x.uHeight, 0);
  if (type.role === "compute") {
    const nodes = count("node");
    const cdu = count("cdu")[0];
    const frame = d.partsById.get(type.frame)?.dims;
    return [
      `${fmt(frame?.w)} W x ${fmt(frame?.d)} D`,
      `${nodes.length} x ${nodes[0]?.uHeight ?? 0}U NODES`,
      "",
      cdu ? `CDU / ${uRange(cdu)}` : "NO CDU",
      `${pdus.length} x ${pdus[0]?.uHeight ?? 2}U + ${type.zeroU.length} x 0U`,
      "IT PDUs INSIDE",
      aux ? `AUX U${pad2(aux.uStart)} / ${spareU}U spare` : `${spareU}U spare`,
    ];
  }
  const fabric = count("network");
  const storage = count("storage").reduce((s, x) => s + x.uHeight, 0);
  return [
    "NETWORK",
    "+ STORAGE",
    "",
    `${fabric.length} x ${fabric[0]?.uHeight ?? 4}U FABRIC`,
    `${storage}U STORAGE`,
    "PATCH / OOB / MGMT",
    `${pdus.length + type.zeroU.length} IT PDUs + AUX`,
  ];
}

export const SLOT_FILL: Record<SlotKind, "white" | "light" | "dark" | "mid"> = {
  node: "white",
  cdu: "light",
  pdu: "dark",
  aux: "light",
  spare: "white",
  network: "light",
  storage: "light",
  patch: "light",
  oob: "white",
  mgmt: "light",
};
