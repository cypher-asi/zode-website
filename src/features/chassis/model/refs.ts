import type { Derived } from "@/features/chassis/model/calc";

export interface Ref {
  bom?: string | null;
  part?: string | null;
  rack?: string | null;
}

export function primaryKey(ref: Ref): string | null {
  if (ref.bom) return `bom:${ref.bom}`;
  if (ref.part) return `part:${ref.part}`;
  if (ref.rack) return `rack:${ref.rack}`;
  return null;
}

/** Every selection key that should highlight an element carrying this ref. */
export function refKeys(ref: Ref, d: Derived): string[] {
  const keys = new Set<string>();
  if (ref.rack) keys.add(`rack:${ref.rack}`);
  if (ref.bom) {
    keys.add(`bom:${ref.bom}`);
    const partId = d.bomById.get(ref.bom)?.partId;
    if (partId) keys.add(`part:${partId}`);
  }
  if (ref.part) {
    keys.add(`part:${ref.part}`);
    for (const b of d.bomByPart.get(ref.part) ?? []) keys.add(`bom:${b.id}`);
    const covered = d.partsById.get(ref.part)?.coveredBy;
    if (covered) keys.add(`bom:${covered}`);
  }
  return [...keys];
}

export function parseKey(key: string): { kind: "bom" | "part" | "rack"; id: string } | null {
  const i = key.indexOf(":");
  if (i < 0) return null;
  const kind = key.slice(0, i);
  if (kind !== "bom" && kind !== "part" && kind !== "rack") return null;
  return { kind, id: key.slice(i + 1) };
}
